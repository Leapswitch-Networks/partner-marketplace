"""Background jobs — the re-scoped Module 16.

Gated on `system-health-view`: this watches the running system rather than
configuring it, which is the same job the System Health screen does and the same
section of the sidebar.

**Read-only, and structurally so.** The reference's Queue Monitor has five
operations — retry one, retry all, forget one, purge pending, purge dead — and
every one of them acts on a *backlog*. We have none: a job is due or it is not,
a failed job runs again on its next interval, and there is nothing queued to
forget. Adding buttons that call nothing would be worse than not having them.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_permission
from app.core.permissions import HEALTH_VIEW
from app.models.user import User
from app.schemas.worker import JobRun, JobStatus, WorkerReport, WorkerSummary
from app.services import worker_service

router = APIRouter(prefix="/worker", tags=["worker"])


@router.get("/jobs", response_model=WorkerReport)
def job_report(
    db: Session = Depends(get_db),
    _actor: User = Depends(require_permission(HEALTH_VIEW)),
) -> WorkerReport:
    """Every registered job, its last run, and whether it is healthy.

    The schedule comes from `worker.build_jobs()` rather than a second list here,
    so a job added to the worker appears without anyone registering it twice.
    """
    report = worker_service.job_report(db)
    return WorkerReport(
        summary=WorkerSummary(**worker_service.summarise(db, report)),
        jobs=[
            JobStatus(
                **{k: v for k, v in job.items() if k != "last_run"},
                last_run=JobRun.model_validate(job["last_run"]) if job["last_run"] else None,
            )
            for job in report
        ],
    )


@router.get("/runs", response_model=list[JobRun])
def recent_runs(
    job: str | None = Query(default=None, description="Restrict to one job"),
    status: str | None = Query(default=None, description="'succeeded' | 'failed'"),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    _actor: User = Depends(require_permission(HEALTH_VIEW)),
) -> list[JobRun]:
    """Run history, newest first. Filterable to the failures, which is the view
    anyone actually opens this page for."""
    return [
        JobRun.model_validate(run)
        for run in worker_service.recent_runs(db, job=job, status=status, limit=limit)
    ]
