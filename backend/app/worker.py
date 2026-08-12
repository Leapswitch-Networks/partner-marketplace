"""The background worker — the thing that was missing.

Four pieces of periodic work already existed as functions, each with a docstring
saying some version of *"nothing calls this on a schedule, because there is no
scheduler"*: webhook retries, expired-session cleanup, API request-log retention,
and activity-log retention. This is the scheduler. It calls them.

## Why a loop and not Celery

We have no message broker and nothing that needs one. Every job here is *"run
this function every N seconds"* — no fan-out, no queues, no results to collect —
and Celery would add a broker, a result backend and a second deployment topology
to express a `while True` with a sleep in it. If real background *work* ever
appears (sending a thousand emails, generating an export), that is the moment to
reach for a broker, and `LEAPDESK_PARITY_PLAN.md` § Module 16 is where that
conversation belongs.

## What it is careful about

**A job that raises must not stop the loop.** One failing job would otherwise
take the other three with it, silently, until someone noticed the delivery
backlog. Each run is wrapped, logged, and the loop continues.

**Each job owns its own session, opened and closed per run.** A long-lived
session on a worker process holds a connection open for hours and accumulates
identity-map state that no request boundary ever clears.

**SIGTERM finishes the current job and then stops.** `docker compose down` sends
one; exiting mid-delivery would leave a webhook attempt recorded as pending that
was in fact sent.

**Nothing here writes to the database except through the same services the API
uses**, so the rules those services enforce — audit rows, circuit breakers,
retention floors — apply identically whether the caller is a request or this.

## Running it

    docker compose run --rm backend python -m app.worker            # loop
    docker compose run --rm backend python -m app.worker --once     # one pass
    docker compose run --rm backend python -m app.worker --job webhook-retries

**It is not in `docker-compose.yml`**, because that file is protected and adding
a service to it is the owner's call. The one-shot mode is what makes this useful
before that decision: it can be driven from cron, or run by hand, and it exercises
exactly the same code path the loop would.
"""

from __future__ import annotations

import argparse
import logging
import signal
import sys
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging import configure_logging
from app.db.session import SessionLocal
from app.models.worker_run import STATUS_FAILED, STATUS_SUCCEEDED
from app.services import (
    activity_service,
    api_consumer_service,
    session_service,
    webhook_service,
    worker_service,
)

logger = logging.getLogger("app.worker")

#: How often the loop wakes. Jobs run when their own interval has elapsed, so
#: this only bounds how precise those intervals are.
TICK_SECONDS = 15

DAY = 24 * 60 * 60


@dataclass
class Job:
    """One periodic task."""

    name: str
    interval_seconds: int
    run: Callable[[Session], int]
    #: What the returned number counts, for the log line. A job that says
    #: "processed 0" and a job that says "deleted 0" are different news.
    unit: str
    #: **Off by default when the job destroys data whose retention is a policy
    #: decision rather than a technical one.** Enabling it is then a deliberate
    #: act rather than a side effect of starting a worker.
    enabled: bool = True
    description: str = ""
    last_run: datetime | None = field(default=None, compare=False)

    def due(self, now: datetime) -> bool:
        if not self.enabled:
            return False
        if self.last_run is None:
            return True
        return (now - self.last_run).total_seconds() >= self.interval_seconds


def _webhook_retries(db: Session) -> int:
    return webhook_service.process_due_retries(db)


def _expired_sessions(db: Session) -> int:
    return session_service.purge_expired(db, older_than_days=30)


def _api_request_logs(db: Session) -> int:
    return api_consumer_service.purge_request_logs(db)


def _activity_log(db: Session) -> int:
    return activity_service.purge_older_than(db, settings.ACTIVITY_LOG_RETENTION_DAYS)


def _worker_run_history(db: Session) -> int:
    return worker_service.purge_runs(db)


def build_jobs() -> list[Job]:
    """The schedule.

    Ordered so the cheap, frequent job is first — a tick that is late because a
    retention sweep is running should not also delay a webhook retry.
    """
    return [
        Job(
            name="webhook-retries",
            interval_seconds=60,
            run=_webhook_retries,
            unit="deliveries retried",
            description=(
                "Attempts webhook deliveries whose backoff has elapsed. Until this "
                "runs, the Redeliver button is the only retry that happens."
            ),
        ),
        Job(
            name="expired-sessions",
            interval_seconds=DAY,
            run=_expired_sessions,
            unit="sessions removed",
            description=(
                "Deletes session rows that expired over 30 days ago. Safe to run "
                "unattended: an expired session already grants nothing."
            ),
        ),
        Job(
            name="api-request-logs",
            interval_seconds=DAY,
            run=_api_request_logs,
            unit="log rows removed",
            description=(
                "Enforces the API traffic retention policy that shipped with "
                "Module 10. The table grows fastest when something is wrong."
            ),
        ),
        Job(
            name="worker-runs",
            interval_seconds=DAY,
            run=_worker_run_history,
            unit="run records removed",
            description=(
                "Trims this worker's own run history. Every table that only grows "
                "needs an answer, including the monitoring one."
            ),
        ),
        Job(
            name="activity-log",
            interval_seconds=DAY,
            run=_activity_log,
            # ⚠️ **Off unless asked for**, and this is the one deliberate default
            # in the file. `activity_service.purge_older_than` says in as many
            # words that how long who-did-what is kept is a policy decision —
            # legal, contractual, or simply how far back you want to be able to
            # answer questions — and that it is not the function's place to pick
            # a number. Switching a worker on must not quietly start deleting an
            # audit trail on the strength of a default nobody chose.
            enabled=False,
            unit="audit rows removed",
            description=(
                f"Deletes audit rows older than {settings.ACTIVITY_LOG_RETENTION_DAYS} "
                "days. DISABLED by default — enable it with --job activity-log "
                "once someone has decided the retention period."
            ),
        ),
    ]


def run_job(job: Job) -> int:
    """Run one job in its own session. Never raises.

    A failure is logged with the job name and the loop carries on: one broken job
    must not take the other three with it, which is exactly how a webhook backlog
    would build up unnoticed behind a failing retention sweep.
    """
    started = time.monotonic()
    started_at = datetime.now(timezone.utc)
    db = SessionLocal()
    count, error = 0, None
    try:
        count = job.run(db)
        duration = int((time.monotonic() - started) * 1000)
        logger.info(
            "worker job finished",
            extra={"job": job.name, "count": count, "unit": job.unit, "duration_ms": duration},
        )
        return count
    except Exception as exc:  # noqa: BLE001 - one job must not stop the worker
        duration = int((time.monotonic() - started) * 1000)
        # Type and message for the screen; the traceback goes to the log, which is
        # where a traceback belongs.
        error = f"{type(exc).__name__}: {exc}"
        logger.exception(
            "worker job failed", extra={"job": job.name, "error": type(exc).__name__}
        )
        return 0
    finally:
        job.last_run = datetime.now(timezone.utc)
        # **Recorded whether it succeeded or failed**, because a job that has been
        # throwing for a week is the single thing the monitor exists to show. Its
        # own session, opened after this one is closed: the job's session may be in
        # any state — that is often why we are here.
        db.close()
        monitor_db = SessionLocal()
        try:
            worker_service.record_run(
                monitor_db,
                job=job.name,
                status=STATUS_FAILED if error else STATUS_SUCCEEDED,
                started_at=started_at,
                finished_at=job.last_run,
                duration_ms=int((time.monotonic() - started) * 1000),
                count=count,
                unit=job.unit,
                error=error,
            )
        finally:
            monitor_db.close()


class Worker:
    """The loop. Stops cleanly on SIGTERM or SIGINT."""

    def __init__(self, jobs: list[Job], tick_seconds: int = TICK_SECONDS) -> None:
        self.jobs = jobs
        self.tick_seconds = tick_seconds
        self.running = True

    def stop(self, *_args) -> None:
        # Sets a flag rather than exiting: the current job finishes, so a delivery
        # that has already been sent is recorded as sent.
        logger.info("worker stopping after the current job")
        self.running = False

    def tick(self) -> dict[str, int]:
        now = datetime.now(timezone.utc)
        results: dict[str, int] = {}
        for job in self.jobs:
            if job.due(now):
                results[job.name] = run_job(job)
        return results

    def run_forever(self) -> None:
        signal.signal(signal.SIGTERM, self.stop)
        signal.signal(signal.SIGINT, self.stop)

        enabled = [j.name for j in self.jobs if j.enabled]
        disabled = [j.name for j in self.jobs if not j.enabled]
        logger.info(
            "worker started", extra={"enabled": enabled, "disabled": disabled}
        )

        while self.running:
            self.tick()
            # Sleep in short slices so a SIGTERM is noticed within a second
            # rather than after a full tick.
            for _ in range(self.tick_seconds):
                if not self.running:
                    break
                time.sleep(1)

        logger.info("worker stopped")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Periodic background work.")
    parser.add_argument(
        "--once", action="store_true", help="Run every due job once and exit."
    )
    parser.add_argument(
        "--job",
        action="append",
        help="Run only this job, now, whatever its interval or default. Repeatable.",
    )
    parser.add_argument("--list", action="store_true", help="Show the schedule and exit.")
    args = parser.parse_args(argv)

    configure_logging()
    jobs = build_jobs()

    if args.list:
        for job in jobs:
            state = "enabled" if job.enabled else "DISABLED"
            print(f"{job.name:<20} every {job.interval_seconds:>6}s  [{state}]")
            print(f"{'':<20} {job.description}")
        return 0

    if args.job:
        by_name = {job.name: job for job in jobs}
        unknown = [name for name in args.job if name not in by_name]
        if unknown:
            print(f"Unknown job(s): {', '.join(unknown)}", file=sys.stderr)
            print(f"Known: {', '.join(by_name)}", file=sys.stderr)
            return 2
        for name in args.job:
            # Named explicitly, so a disabled job runs — asking for it by name is
            # the deliberate act its default was waiting for.
            count = run_job(by_name[name])
            print(f"{name}: {count} {by_name[name].unit}")
        return 0

    if args.once:
        results = Worker(jobs).tick()
        for name, count in results.items():
            print(f"{name}: {count}")
        return 0

    Worker(jobs).run_forever()
    return 0


if __name__ == "__main__":  # pragma: no cover - operational entry point
    raise SystemExit(main())
