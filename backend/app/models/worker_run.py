"""What the background worker did, and when.

LeapDesk parity Module 16, **re-scoped** — and the re-scoping is the point.

The plan blocks this module on *"we have no queue"* and warns that building the
monitor first *"would produce a page that says 0 jobs forever"*. That warning was
right and is now spent: `app/worker.py` runs four jobs on a timer. But a worker
is not a queue, and the difference decides what this table can be.

**What the reference's `queue_job_runs` records and we cannot:** a queue has
*pending* work — jobs enqueued and not yet picked up — so `queued_at`, `attempts`,
`payload_summary` and its retry/forget/purge operations all describe a backlog.
Ours has no backlog: a job is due or it is not, and when it is due it runs. There
is nothing to retry (the job runs again on its next interval), nothing to forget,
and nothing to purge.

**So this records runs, not jobs.** Same question — *is the background work
healthy?* — answered with the evidence we actually have: what ran, when, how long
it took, how much it did, and what it said if it failed. Building the reference's
five views over four cron-ish jobs would have produced exactly the empty page its
own warning describes.

**One row per run, and the worker writes it even when the job fails**, because a
job that has been throwing for a week is the single thing this table exists to
make visible.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

STATUS_SUCCEEDED = "succeeded"
STATUS_FAILED = "failed"
RUN_STATUSES = (STATUS_SUCCEEDED, STATUS_FAILED)


def _now() -> datetime:
    return datetime.now(timezone.utc)


class WorkerJobRun(Base):
    """One execution of one background job."""

    __tablename__ = "worker_job_runs"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    #: The job's registered name — `webhook-retries`, `expired-sessions`. Indexed
    #: because every read of this table is "the history of one job".
    job: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, index=True)

    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    finished_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)

    #: What the job reported doing — deliveries retried, rows removed. Its meaning
    #: comes from the job's `unit`, because "0" from a retry sweep and "0" from a
    #: purge are different news and a bare number cannot say which.
    count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    unit: Mapped[str | None] = mapped_column(String(64), nullable=True)

    #: Type and message only, never a traceback. A traceback in a table that a
    #: screen renders is a stack of file paths shown to whoever can read the page;
    #: the full one is already in the logs, where it belongs.
    error: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now
    )

    __table_args__ = (
        # "The last run of each job", which is the whole index screen.
        Index("worker_job_runs_job_started_index", "job", "started_at"),
        # Retention deletes by age, so the sweep needs age alone.
        Index("worker_job_runs_started_index", "started_at"),
    )

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<WorkerJobRun {self.job} {self.status} {self.count}>"
