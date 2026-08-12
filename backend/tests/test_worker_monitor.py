"""The background-jobs monitor's health rules (Module 16, re-scoped).

The interesting case is not a job that failed — that is loud and obvious in the
list. It is a job that has not run **at all**, because the worker is not running:
no failures, no errors, nothing red, and every retention sweep and webhook retry
silently stopped. These tests are mostly about that.
"""

from datetime import datetime, timedelta, timezone

import pytest

from app.models.worker_run import STATUS_FAILED, STATUS_SUCCEEDED, WorkerJobRun
from app.services import worker_service as svc


def run_at(seconds_ago: int, status: str = STATUS_SUCCEEDED) -> WorkerJobRun:
    return WorkerJobRun(
        job="j",
        status=status,
        started_at=datetime.now(timezone.utc) - timedelta(seconds=seconds_ago),
        count=0,
    )


class TestHealth:
    def test_a_recent_success_is_healthy(self):
        assert svc.health_of(run_at(10), interval_seconds=60, enabled=True) == svc.HEALTH_OK

    def test_a_job_that_never_ran_says_so(self):
        """**The failure this screen exists for.** Not an error, not a failure —
        an absence, which looks exactly like a quiet system."""
        assert svc.health_of(None, interval_seconds=60, enabled=True) == svc.HEALTH_NEVER_RUN

    def test_a_stale_success_is_overdue(self):
        assert (
            svc.health_of(run_at(60 * 5), interval_seconds=60, enabled=True)
            == svc.HEALTH_OVERDUE
        )

    def test_lateness_is_generous_by_design(self):
        """A worker restarting, or a tick delayed behind a slow job, must not
        paint the screen red. One missed interval is a blip."""
        assert (
            svc.health_of(run_at(90), interval_seconds=60, enabled=True) == svc.HEALTH_OK
        )
        assert svc.OVERDUE_FACTOR >= 2

    def test_a_failed_last_run_is_failing(self):
        assert (
            svc.health_of(run_at(5, STATUS_FAILED), interval_seconds=60, enabled=True)
            == svc.HEALTH_FAILING
        )

    def test_failing_outranks_overdue(self):
        """A job that failed and is also late is failing: the failure is the
        actionable half, and showing 'overdue' would hide it."""
        assert (
            svc.health_of(run_at(10_000, STATUS_FAILED), interval_seconds=60, enabled=True)
            == svc.HEALTH_FAILING
        )

    def test_disabled_outranks_everything(self):
        """A job nobody asked to run is not overdue. Reporting it as such trains
        a reader to ignore the colour."""
        for run in (None, run_at(10_000), run_at(10_000, STATUS_FAILED)):
            assert (
                svc.health_of(run, interval_seconds=60, enabled=False) == svc.HEALTH_DISABLED
            )


class TestRetention:
    def test_a_policy_exists(self):
        """Every table that only grows needs an answer — including the one that
        monitors the thing enforcing the others."""
        assert svc.RUN_RETENTION_DAYS > 0

    def test_a_nonsense_retention_is_refused(self):
        with pytest.raises(ValueError):
            svc.purge_runs(None, days=0)


class TestTheContract:
    def test_every_health_state_is_distinct(self):
        states = {
            svc.HEALTH_OK,
            svc.HEALTH_FAILING,
            svc.HEALTH_OVERDUE,
            svc.HEALTH_NEVER_RUN,
            svc.HEALTH_DISABLED,
        }
        assert len(states) == 5

    def test_the_monitor_reads_the_workers_own_registry(self):
        """Not a second list. A job added to the worker appears here without
        anyone registering it twice — which is how the two would drift."""
        import inspect

        source = inspect.getsource(svc.job_report)
        assert "build_jobs" in source

    def test_recording_a_run_never_raises(self):
        """Monitoring that can crash the thing it monitors is worse than none.
        A `None` session is the bluntest possible failure."""
        svc.record_run(
            None,
            job="j",
            status=STATUS_SUCCEEDED,
            started_at=datetime.now(timezone.utc),
            finished_at=datetime.now(timezone.utc),
            duration_ms=1,
        )
