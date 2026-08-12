"""The background worker's scheduling rules.

Four functions existed with docstrings saying *"nothing calls this on a schedule,
because there is no scheduler"*. This is the scheduler, and these are the rules
that decide what it runs and what it must survive.

**The one to read is `test_activity_log_purge_is_off_by_default`.** Everything
else here is mechanics; that one is a decision.
"""

from datetime import datetime, timedelta, timezone

import pytest

from app.worker import DAY, Job, Worker, build_jobs, run_job


@pytest.fixture(autouse=True)
def _no_run_recording(monkeypatch):
    """Stop these tests writing to the real `worker_job_runs` table.

    `run_job` records every run so the Module 16 monitor has something to show —
    which means the fake jobs below (`works`, `explodes`) were landing in the
    development database and appearing on the Background Jobs screen as failures
    with "RuntimeError: boom". **Found by looking at the screen**, not by any
    check: the rows were valid, the tests passed, and the monitor was faithfully
    reporting junk.

    The recording itself is covered against real rows in the Module 16 probe;
    what these tests are about is the schedule.
    """
    monkeypatch.setattr(
        "app.worker.worker_service.record_run", lambda *args, **kwargs: None
    )


def at(seconds_ago: int) -> datetime:
    return datetime.now(timezone.utc) - timedelta(seconds=seconds_ago)


class TestWhenAJobIsDue:
    def test_a_job_that_has_never_run_is_due(self):
        job = Job(name="j", interval_seconds=60, run=lambda db: 0, unit="x")
        assert job.due(datetime.now(timezone.utc)) is True

    def test_a_job_is_not_due_before_its_interval(self):
        job = Job(name="j", interval_seconds=60, run=lambda db: 0, unit="x")
        job.last_run = at(30)
        assert job.due(datetime.now(timezone.utc)) is False

    def test_a_job_is_due_once_its_interval_has_elapsed(self):
        job = Job(name="j", interval_seconds=60, run=lambda db: 0, unit="x")
        job.last_run = at(61)
        assert job.due(datetime.now(timezone.utc)) is True

    def test_a_disabled_job_is_never_due(self):
        """Even if it has never run — otherwise "disabled" would mean "runs once
        on every worker start", which is the opposite of the intent."""
        job = Job(name="j", interval_seconds=60, run=lambda db: 0, unit="x", enabled=False)
        assert job.due(datetime.now(timezone.utc)) is False
        job.last_run = at(10_000)
        assert job.due(datetime.now(timezone.utc)) is False


class TestOneFailingJobDoesNotStopTheRest:
    def test_a_raising_job_returns_zero_rather_than_propagating(self):
        """A job that threw would otherwise take the other three with it —
        silently, until someone noticed the webhook backlog behind a failing
        retention sweep."""

        def explode(db):
            raise RuntimeError("boom")

        job = Job(name="explodes", interval_seconds=1, run=explode, unit="x")
        assert run_job(job) == 0

    def test_a_failed_run_still_records_when_it_ran(self):
        """Otherwise a permanently failing job is retried on every single tick,
        turning one broken thing into a hot loop against the database."""

        def explode(db):
            raise RuntimeError("boom")

        job = Job(name="explodes", interval_seconds=3600, run=explode, unit="x")
        run_job(job)
        assert job.last_run is not None
        assert job.due(datetime.now(timezone.utc)) is False

    def test_the_tick_runs_the_survivors(self):
        ran: list[str] = []

        def ok(db):
            ran.append("ok")
            return 1

        def explode(db):
            ran.append("explode")
            raise RuntimeError("boom")

        worker = Worker(
            [
                Job(name="explodes", interval_seconds=1, run=explode, unit="x"),
                Job(name="works", interval_seconds=1, run=ok, unit="x"),
            ]
        )
        results = worker.tick()
        assert ran == ["explode", "ok"]
        assert results == {"explodes": 0, "works": 1}


class TestTheSchedule:
    def test_the_registered_jobs_are_the_expected_set(self):
        """Pinned by name rather than by count. `worker-runs` was added with the
        monitor in Module 16 — the worker's own run history is a table that only
        grows, so it needs the same answer every other one got."""
        assert {job.name for job in build_jobs()} == {
            "webhook-retries",
            "expired-sessions",
            "api-request-logs",
            "worker-runs",
            "activity-log",
        }

    def test_every_job_records_what_it_did(self):
        """Module 16 reads this table; a job that ran and left no row is a job
        the monitor cannot report on."""
        for job in build_jobs():
            assert job.unit, job.name

    def test_webhook_retries_runs_first_and_often(self):
        """Ordered so a slow retention sweep does not delay a delivery: the
        backoff schedule starts at 30 seconds, so checking once a minute is the
        coarsest interval that still honours it."""
        jobs = build_jobs()
        assert jobs[0].name == "webhook-retries"
        assert jobs[0].interval_seconds <= 60

    def test_retention_jobs_run_daily_not_hourly(self):
        """Deleting is cheap to defer and expensive to get wrong."""
        for job in build_jobs():
            if job.name != "webhook-retries":
                assert job.interval_seconds == DAY

    def test_activity_log_purge_is_off_by_default(self):
        """**The one decision in this file.**

        `activity_service.purge_older_than` states that how long who-did-what is
        kept is a policy question — legal, contractual, or simply how far back
        you want to be able to answer questions — and that picking a number is
        not the function's place. Starting a worker must not quietly begin
        deleting an audit trail on a default nobody chose.
        """
        activity = next(j for j in build_jobs() if j.name == "activity-log")
        assert activity.enabled is False
        assert "DISABLED" in activity.description

    def test_the_other_three_are_safe_to_run_unattended(self):
        """A retry sends something that was already meant to be sent; the two
        purges delete rows that are already useless. None of them destroys
        anything a person would miss."""
        for job in build_jobs():
            if job.name != "activity-log":
                assert job.enabled is True

    def test_every_job_explains_itself(self):
        for job in build_jobs():
            assert len(job.description) > 40, job.name
            assert job.unit


class TestShutdown:
    def test_stop_ends_the_loop_rather_than_killing_the_current_job(self):
        """`docker compose down` sends SIGTERM. Exiting mid-delivery would leave
        a webhook attempt recorded as pending that was in fact sent."""
        worker = Worker(build_jobs())
        assert worker.running is True
        worker.stop()
        assert worker.running is False


@pytest.mark.parametrize("argv", [["--list"], ["--job", "no-such-job"]])
def test_the_cli_does_not_explode_on_either_path(argv):
    from app.worker import main

    # `--list` succeeds, an unknown job exits 2 with the known names — neither
    # raises, because this is what someone runs at 3am.
    assert main(argv) in (0, 2)
