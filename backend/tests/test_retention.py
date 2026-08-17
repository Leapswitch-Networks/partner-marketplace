"""Log tables stay bounded — by age and, crucially, by row count.

The owner's brief, 2026-08-17: *"set a limit, after that the previous logs will
automatically get deleted — we cannot make our db so big because of logs only."*

**Age-based retention does not bound size, and that is the thing to keep
proving.** A 90-day window says nothing about how many rows arrive in 90 days,
and the tables that grow fastest do it exactly when something is wrong. Only the
row cap answers "how big may this get".

The database test at the bottom is the one that matters: it inserts more rows
than the cap and asserts that the survivors are the **newest** ones. Getting that
backwards would keep the oldest logs and delete today's — which still passes a
naive "row count went down" assertion.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import Integer, String, select
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.core import retention
from app.core.retention import RetentionPolicy


class _RetentionTestBase(DeclarativeBase):
    """Own metadata — **not** `app.db.base.Base`.

    A fixture table on the application's metadata is a table Alembic offers to
    create and `test_route_enforcement.py::test_the_database_matches_the_models`
    reports as drift. `test_scoping.py` hit exactly that.
    """


class LogRow(_RetentionTestBase):
    __tablename__ = "_test_retention_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    label: Mapped[str] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column()


@pytest.fixture(autouse=True)
def isolated_registry():
    """Register against an empty registry, then restore the real policies."""
    saved = retention.policies()
    retention.reset_for_tests()
    yield
    retention.reset_for_tests()
    for policy in saved.values():
        retention.register_policy(policy)


def _policy(**overrides) -> RetentionPolicy:
    return RetentionPolicy(
        **{
            "name": "test-log",
            "model": LogRow,
            "timestamp_column": LogRow.created_at,
            **overrides,
        }
    )


class TestPolicyValidation:
    def test_negative_limits_are_refused(self):
        with pytest.raises(ValueError, match="cannot be negative"):
            _policy(max_rows=-1)

    def test_zero_means_no_limit_of_that_kind(self):
        """Both limits are independent, and either may be off. A table can be
        capped by size with no age limit (pure telemetry) or by age with no cap
        (evidence — see the audit trail)."""
        policy = _policy(max_age_days=0, max_rows=0)
        assert policy.max_age_days == 0
        assert policy.max_rows == 0

    def test_registering_twice_raises(self):
        retention.register_policy(_policy())
        with pytest.raises(ValueError, match="already registered"):
            retention.register_policy(_policy())


class TestOptInPoliciesAreSkipped:
    """The audit trail must not be swept because a default said so.

    `activity_service.purge_older_than`, `db/maintenance.py` and the worker's old
    `enabled=False` job all encoded the same decision: trimming evidence is an
    instruction. An engine that swept everything registered would have silently
    overruled all three.
    """

    def test_enforce_all_skips_an_opt_in_policy(self, monkeypatch):
        swept: list[str] = []
        retention.register_policy(_policy(name="telemetry", max_rows=10))
        retention.register_policy(_policy(name="evidence", max_rows=10, requires_opt_in=True))
        monkeypatch.setattr(
            retention, "enforce", lambda db, p, **kw: swept.append(p.name) or retention.SweepResult(p.name)
        )

        retention.enforce_all(None, batch_size=10, max_batches=1)
        assert swept == ["telemetry"]

    def test_include_opt_in_sweeps_it(self, monkeypatch):
        swept: list[str] = []
        retention.register_policy(_policy(name="evidence", max_rows=10, requires_opt_in=True))
        monkeypatch.setattr(
            retention, "enforce", lambda db, p, **kw: swept.append(p.name) or retention.SweepResult(p.name)
        )

        retention.enforce_all(None, batch_size=10, max_batches=1, include_opt_in=True)
        assert swept == ["evidence"]

    def test_naming_a_policy_explicitly_overrides_opt_in(self, monkeypatch):
        """Typing the name IS the instruction the flag asks for. Requiring both
        `--retention activity-log` and a second confirmation flag would be
        ceremony, not safety."""
        swept: list[str] = []
        retention.register_policy(_policy(name="evidence", max_rows=10, requires_opt_in=True))
        monkeypatch.setattr(
            retention, "enforce", lambda db, p, **kw: swept.append(p.name) or retention.SweepResult(p.name)
        )

        retention.enforce_all(None, batch_size=10, max_batches=1, only="evidence")
        assert swept == ["evidence"]


class TestSweepResult:
    def test_total_adds_both_causes(self):
        assert retention.SweepResult("x", by_age=3, by_cap=4).total == 7

    def test_truncated_defaults_false(self):
        assert retention.SweepResult("x").truncated is False


@pytest.mark.db
class TestAgainstARealDatabase:
    """The behaviour that cannot be proved without SQL.

    Marked `db` and deselected in CI, matching the convention in
    `pyproject.toml`. It creates its own table and drops it, so it touches no
    application data.
    """

    @pytest.fixture
    def db(self):
        from app.db.session import SessionLocal, engine

        _RetentionTestBase.metadata.create_all(engine)
        session = SessionLocal()
        try:
            yield session
        finally:
            session.close()
            _RetentionTestBase.metadata.drop_all(engine)

    def _seed(self, db, count: int, *, oldest_days_ago: int = 100) -> None:
        """`count` rows, one per day, oldest first — so `label` orders by age.

        **Offset by twelve hours so no row lands exactly on a day boundary.**
        Without it, a row seeded at `now - 90d` is compared against a cutoff of
        `now' - 90d` computed microseconds later, so it is a hair older than the
        cutoff and gets deleted — the first version of this fixture failed on
        that, and the ambiguity was in the test, not in `trim_by_age`. A test
        whose result depends on how fast the machine is will fail on someone
        else's laptop instead.
        """
        now = datetime.now(timezone.utc)
        for i in range(count):
            db.add(
                LogRow(
                    label=f"row-{i:03d}",
                    created_at=now - timedelta(days=oldest_days_ago - i) + timedelta(hours=12),
                )
            )
        db.commit()

    def _labels(self, db) -> list[str]:
        return list(db.scalars(select(LogRow.label).order_by(LogRow.created_at)))

    def test_the_cap_keeps_the_NEWEST_rows(self, db):
        """**The assertion this whole file exists for.**

        Trimming to a cap while keeping the *oldest* rows would still shrink the
        table and still pass a "row count went down" check — while deleting
        today's logs and keeping last year's, which is precisely backwards.
        """
        self._seed(db, 25)
        policy = _policy(max_rows=10)

        deleted, truncated = retention.trim_to_cap(db, policy, batch_size=100, max_batches=10)

        assert deleted == 15
        assert truncated is False
        survivors = self._labels(db)
        assert len(survivors) == 10
        assert survivors == [f"row-{i:03d}" for i in range(15, 25)]

    def test_a_table_under_its_cap_is_untouched(self, db):
        self._seed(db, 5)
        deleted, _ = retention.trim_to_cap(db, _policy(max_rows=10), batch_size=100, max_batches=10)
        assert deleted == 0
        assert len(self._labels(db)) == 5

    def test_a_zero_cap_deletes_nothing(self, db):
        """`0` means "no size limit", **not** "keep zero rows". Reading it the
        other way would empty every table on the first sweep."""
        self._seed(db, 5)
        deleted, _ = retention.trim_to_cap(db, _policy(max_rows=0), batch_size=100, max_batches=10)
        assert deleted == 0
        assert len(self._labels(db)) == 5

    def test_the_age_cut_removes_only_what_is_older(self, db):
        # Rows dated 100 days ago down to 76 days ago.
        self._seed(db, 25, oldest_days_ago=100)
        deleted, _ = retention.trim_by_age(
            db, _policy(max_age_days=90), batch_size=100, max_batches=10
        )
        # Ages are (100 - i) days minus 12h. Row 9 is 90.5 days old and goes;
        # row 10 is 89.5 and stays. Ten deleted, with no row on the boundary.
        assert deleted == 10
        assert self._labels(db)[0] == "row-010"

    def test_batching_deletes_everything_across_several_passes(self, db):
        """A batch smaller than the surplus must still converge — that is what
        makes a big table shrink at all rather than timing out on one statement.
        """
        self._seed(db, 25)
        deleted, truncated = retention.trim_to_cap(
            db, _policy(max_rows=5), batch_size=4, max_batches=50
        )
        assert deleted == 20
        assert truncated is False
        assert len(self._labels(db)) == 5

    def test_running_out_of_batches_reports_truncated_rather_than_lying(self, db):
        """A sweep that stopped early must say so. Reporting success while the
        table is still over budget is how a disk fills up with a green job."""
        self._seed(db, 25)
        deleted, truncated = retention.trim_to_cap(
            db, _policy(max_rows=5), batch_size=2, max_batches=3
        )
        assert truncated is True
        assert deleted == 6
        assert len(self._labels(db)) == 19

    def test_enforce_applies_both_limits_and_reports_each(self, db):
        self._seed(db, 25, oldest_days_ago=100)
        result = retention.enforce(
            db, _policy(max_age_days=90, max_rows=5), batch_size=100, max_batches=10
        )
        assert result.by_age == 10
        assert result.by_cap == 10
        assert result.total == 20
        assert len(self._labels(db)) == 5

    def test_row_counts_reports_every_registered_policy(self, db):
        self._seed(db, 7)
        retention.register_policy(_policy(name="test-log", max_rows=100))
        assert retention.row_counts(db) == {"test-log": 7}


class TestTheRealPoliciesAreRegistered:
    """A registry nobody populated sweeps nothing and reports success."""

    def _real_policies(self) -> dict[str, RetentionPolicy]:
        """Load the real registrations against the fixture-emptied registry.

        The autouse `isolated_registry` fixture clears the module-level registry
        before every test in this file, so reading it directly here would return
        `{}` and any assertion over it would be vacuous. Re-importing the
        registration module rebuilds it; the fixture's teardown restores the
        original either way.
        """
        import importlib

        retention.reset_for_tests()
        importlib.reload(importlib.import_module("app.services.retention_policies"))
        return retention.policies()

    def test_every_growing_log_table_has_a_policy(self):
        assert {
            "api-request-logs",
            "webhook-deliveries",
            "error-occurrences",
            "search-logs",
            "worker-runs",
            "activity-log",
        } == set(self._real_policies())

    def test_the_three_tables_that_had_no_purge_now_have_one(self):
        """`webhook_deliveries`, `error_occurrences` and `search_logs` had no
        purge function at all before 2026-08-17 — not a disabled one, not an
        unwired one. Nothing bounded them."""
        assert {"webhook-deliveries", "error-occurrences", "search-logs"} <= set(
            self._real_policies()
        )

    def test_every_telemetry_table_is_capped_and_only_the_audit_trail_is_not(self):
        """The cap is the limit that bounds disk, so every table meant as
        telemetry must carry one. The audit trail is the single exception, and it
        is an exception on purpose — evidence, not telemetry."""
        uncapped = {name for name, p in self._real_policies().items() if not p.max_rows}
        assert uncapped == {"activity-log"}

    def test_only_the_audit_trail_is_opt_in(self):
        opt_in = {name for name, p in self._real_policies().items() if p.requires_opt_in}
        assert opt_in == {"activity-log"}
