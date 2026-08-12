"""Reading what the background worker has been doing.

LeapDesk parity Module 16, re-scoped — see `app/models/worker_run.py` for why
this records runs rather than a queue backlog.

**The one judgement in this module is `health_of`.** A monitor that only lists
what happened is a log; what an operator needs is the answer to *"is the
background work healthy?"*, and the interesting case is not a job that failed —
that is loud and obvious in the list. It is a job that has not run **at all**,
because the worker is not running. That looks identical to a quiet system: no
failures, no errors, nothing red. It is the failure mode this whole screen exists
to make visible, so it has its own state.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import Select, delete, desc, func, select
from sqlalchemy.orm import Session

from app.models.worker_run import STATUS_FAILED, STATUS_SUCCEEDED, WorkerJobRun

#: How long run history is kept. Four jobs, the busiest hourly at most, so this is
#: a small table — but every table that only grows needs an answer, and Module
#: 10's request log made the same argument on day one.
RUN_RETENTION_DAYS = 30

#: A job is "overdue" once this many times its own interval have passed without a
#: run. Generous on purpose: a worker restarting, or a tick delayed behind a slow
#: job, must not paint the screen red. Three missed intervals is not a blip.
OVERDUE_FACTOR = 3

HEALTH_OK = "ok"
HEALTH_FAILING = "failing"
HEALTH_OVERDUE = "overdue"
HEALTH_NEVER_RUN = "never_run"
HEALTH_DISABLED = "disabled"


def record_run(
    db: Session,
    *,
    job: str,
    status: str,
    started_at: datetime,
    finished_at: datetime,
    duration_ms: int,
    count: int = 0,
    unit: str | None = None,
    error: str | None = None,
) -> None:
    """Write one run. **Never raises.**

    The same rule `activity_service.record` follows, and for a sharper reason
    here: this is the *monitoring* of the worker, and monitoring that can crash
    the thing it monitors is worse than no monitoring. A failure to record a run
    must not turn a successful job into a failed one.
    """
    try:
        db.add(
            WorkerJobRun(
                job=job,
                status=status,
                started_at=started_at,
                finished_at=finished_at,
                duration_ms=duration_ms,
                count=count,
                unit=unit,
                # Truncated: this is rendered on a screen, and the full traceback
                # is already in the logs.
                error=error[:2000] if error else None,
            )
        )
        db.commit()
    except Exception:  # noqa: BLE001 - monitoring must not break the monitored
        try:
            db.rollback()
        except Exception:  # noqa: BLE001
            pass


def last_run(db: Session, job: str) -> WorkerJobRun | None:
    return db.scalar(
        select(WorkerJobRun)
        .where(WorkerJobRun.job == job)
        .order_by(desc(WorkerJobRun.started_at))
        .limit(1)
    )


def recent_runs(
    db: Session, *, job: str | None = None, status: str | None = None, limit: int = 50
) -> list[WorkerJobRun]:
    stmt: Select = select(WorkerJobRun)
    if job:
        stmt = stmt.where(WorkerJobRun.job == job)
    if status:
        stmt = stmt.where(WorkerJobRun.status == status)
    return list(db.scalars(stmt.order_by(desc(WorkerJobRun.started_at)).limit(limit)))


def health_of(
    run: WorkerJobRun | None, *, interval_seconds: int, enabled: bool
) -> str:
    """One job's state, from its last run.

    Order matters. `disabled` wins over everything: a job nobody asked to run is
    not overdue, and reporting it as such would train a reader to ignore the
    colour. Then `never_run`, then `failing`, then `overdue` — a job that failed
    *and* is late is failing, because the failure is the actionable half.
    """
    if not enabled:
        return HEALTH_DISABLED
    if run is None:
        return HEALTH_NEVER_RUN
    if run.status == STATUS_FAILED:
        return HEALTH_FAILING

    age = (datetime.now(timezone.utc) - run.started_at).total_seconds()
    if age > interval_seconds * OVERDUE_FACTOR:
        return HEALTH_OVERDUE
    return HEALTH_OK


def job_report(db: Session) -> list[dict[str, Any]]:
    """Every registered job with its last run and its health.

    Imports the worker's schedule rather than keeping a second copy — the
    registry is `build_jobs()`, and a list maintained here would drift the first
    time a job was added.
    """
    from app.worker import build_jobs

    report: list[dict[str, Any]] = []
    for job in build_jobs():
        run = last_run(db, job.name)
        report.append(
            {
                "name": job.name,
                "description": job.description,
                "interval_seconds": job.interval_seconds,
                "enabled": job.enabled,
                "unit": job.unit,
                "health": health_of(
                    run, interval_seconds=job.interval_seconds, enabled=job.enabled
                ),
                "last_run": run,
            }
        )
    return report


def summarise(db: Session, report: list[dict[str, Any]]) -> dict[str, Any]:
    """The counts at the top of the screen.

    `worker_seen_recently` is the one that answers "is the worker even running",
    which no per-job state can: every job could be `ok` on a stale last run if the
    process died five minutes ago and nothing is due yet.
    """
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    runs_24h = db.scalar(
        select(func.count()).select_from(WorkerJobRun).where(WorkerJobRun.started_at >= since)
    ) or 0
    failed_24h = db.scalar(
        select(func.count())
        .select_from(WorkerJobRun)
        .where(WorkerJobRun.started_at >= since, WorkerJobRun.status == STATUS_FAILED)
    ) or 0
    latest = db.scalar(select(func.max(WorkerJobRun.started_at)))

    return {
        "jobs": len(report),
        "enabled": len([j for j in report if j["enabled"]]),
        "unhealthy": len(
            [j for j in report if j["health"] in (HEALTH_FAILING, HEALTH_OVERDUE)]
        ),
        "never_run": len([j for j in report if j["health"] == HEALTH_NEVER_RUN]),
        "runs_24h": runs_24h,
        "failed_24h": failed_24h,
        "last_seen_at": latest,
        # The shortest enabled interval is how often *something* should be
        # happening, so silence for longer than a few of those means the process
        # is gone rather than idle.
        "worker_seen_recently": bool(
            latest
            and (datetime.now(timezone.utc) - latest).total_seconds()
            < max(
                (j["interval_seconds"] for j in report if j["enabled"]), default=60
            )
            * OVERDUE_FACTOR
        ),
    }


def purge_runs(db: Session, days: int = RUN_RETENTION_DAYS) -> int:
    """Delete run history older than `days`. Returns how many rows went."""
    if days <= 0:
        raise ValueError("Retention must be a positive number of days.")
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    result = db.execute(delete(WorkerJobRun).where(WorkerJobRun.started_at < cutoff))
    db.commit()
    return result.rowcount or 0


__all__ = [
    "HEALTH_DISABLED",
    "HEALTH_FAILING",
    "HEALTH_NEVER_RUN",
    "HEALTH_OK",
    "HEALTH_OVERDUE",
    "RUN_RETENTION_DAYS",
    "STATUS_FAILED",
    "STATUS_SUCCEEDED",
    "health_of",
    "job_report",
    "last_run",
    "purge_runs",
    "recent_runs",
    "record_run",
    "summarise",
]
