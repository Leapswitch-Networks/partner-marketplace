"""Shapes for the background-jobs monitor (Module 16, re-scoped).

No write shapes, and that is the module: there is nothing to retry, forget or
purge because there is no backlog — a due job runs, and a failed job runs again
on its next interval. The reference's five operations all describe a queue we do
not have.
"""

from datetime import datetime

from pydantic import BaseModel


class JobRun(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    job: str
    status: str
    started_at: datetime
    finished_at: datetime | None
    duration_ms: int | None
    #: What the job reported doing. Its meaning comes from `unit`.
    count: int
    unit: str | None
    #: Type and message only — never a traceback.
    error: str | None


class JobStatus(BaseModel):
    name: str
    description: str
    interval_seconds: int
    enabled: bool
    unit: str
    #: `ok` | `failing` | `overdue` | `never_run` | `disabled`.
    health: str
    last_run: JobRun | None


class WorkerSummary(BaseModel):
    jobs: int
    enabled: int
    unhealthy: int
    never_run: int
    runs_24h: int
    failed_24h: int
    last_seen_at: datetime | None
    #: **The one no per-job state can answer.** Every job can read `ok` on a stale
    #: last run if the process died five minutes ago and nothing is due yet.
    worker_seen_recently: bool


class WorkerReport(BaseModel):
    summary: WorkerSummary
    jobs: list[JobStatus]
