"""Bounded log tables: delete by age **and** by row count.

## Why age alone was not enough

Every append-only table in this project already had, or could have had, an
age-based purge: *delete rows older than N days*. That is a retention **policy**
and it is the right one for answering "how far back can we look". It is not a
size limit, and the difference is the whole reason this module exists.

A 90-day window says nothing about how many rows arrive in 90 days. The tables
that grow fastest grow fastest **exactly when something is wrong** —
`api_request_logs` during an integration failure loop, `error_occurrences`
during an incident, `webhook_deliveries` when a receiver starts refusing. Those
are the moments a database runs out of disk, and an age-based sweep scheduled
for 03:15 tomorrow does not help tonight.

So each policy carries two independent limits:

    max_age_days   how far back we keep    (policy: what can we still answer?)
    max_rows       how much we keep        (budget: how big may this get?)

Either may be `0`, meaning "no limit of this kind". Both are applied on every
sweep, oldest-first, and they compose: the age cut runs first because it is
cheap and indexed, then the cap removes whatever survived it.

## Deleting in batches, not in one statement

A single `DELETE` over a few million rows takes a long lock and writes one
enormous transaction. Each pass here deletes at most `batch_size` rows and loops,
so the table is available between batches and a sweep interrupted halfway has
still made progress. `RETENTION_MAX_BATCHES` bounds one run so a wildly
oversized table cannot make the worker's tick take an hour — the next tick picks
up where it stopped.

## What this module deliberately does not decide

It names no table. Policies are registered by the services that own the models
(`app/services/retention_policies.py`), for the same reason `core/scoping.py`
names no model: a second project keeps this engine and registers its own tables.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, func, inspect, select
from sqlalchemy.orm import InstrumentedAttribute, Session


@dataclass(frozen=True)
class RetentionPolicy:
    """How large, and how old, one table is allowed to get."""

    #: Stable key, used in logs and by `--policy` on the command line.
    name: str
    model: type
    #: The column that orders "oldest". Usually `created_at`; `occurred_at` for
    #: error occurrences, because that is when the event happened rather than
    #: when the row was written.
    timestamp_column: InstrumentedAttribute
    #: Delete rows older than this. `0` disables the age cut.
    max_age_days: int = 0
    #: Keep at most this many rows, newest first. `0` disables the cap.
    #:
    #: **This is the limit that actually bounds the database.** Age says how far
    #: back you can look; only this says how big the table may get.
    max_rows: int = 0
    #: One line for the operator, shown by `--list`.
    description: str = ""
    #: Excluded from the automatic sweep unless explicitly named.
    #:
    #: **For evidence, not for telemetry.** `activity_service.purge_older_than`
    #: and `db/maintenance.py` both state that how long who-did-what is kept is a
    #: policy decision and that a default must never quietly start deleting it —
    #: and the worker's activity-log job has shipped disabled for that reason. An
    #: engine that swept every registered policy would silently overrule all
    #: three. So the flag travels with the policy rather than living in the
    #: caller, where the next caller would forget it.
    requires_opt_in: bool = False

    def __post_init__(self) -> None:
        if self.max_age_days < 0 or self.max_rows < 0:
            raise ValueError(f"{self.name}: limits cannot be negative")


@dataclass
class SweepResult:
    """What one policy's sweep actually deleted."""

    policy: str
    by_age: int = 0
    by_cap: int = 0
    #: True when a run stopped on `max_batches` rather than because it was done.
    #: Surfaced so "still shrinking" is distinguishable from "at target".
    truncated: bool = False

    @property
    def total(self) -> int:
        return self.by_age + self.by_cap


_POLICIES: dict[str, RetentionPolicy] = {}


def register_policy(policy: RetentionPolicy) -> None:
    if policy.name in _POLICIES:
        raise ValueError(f"Retention policy '{policy.name}' is already registered.")
    _POLICIES[policy.name] = policy


def policies() -> dict[str, RetentionPolicy]:
    """Every registered policy, in registration order."""
    return dict(_POLICIES)


def reset_for_tests() -> None:
    """Empty the registry. **Tests only.**"""
    _POLICIES.clear()


def _primary_key(model: type) -> InstrumentedAttribute:
    """The single-column primary key, or a loud failure.

    Batched deletes need `WHERE pk IN (SELECT pk ... LIMIT n)`, and a composite
    key would need a tuple comparison this module does not build. No log table
    here has one; raising says so rather than deleting the wrong rows.
    """
    keys = inspect(model).primary_key
    if len(keys) != 1:
        raise ValueError(
            f"{model.__name__} has a composite primary key; retention needs a single-column key."
        )
    return getattr(model, keys[0].name)


def _delete_in_batches(
    db: Session,
    model: type,
    id_query,
    *,
    batch_size: int,
    max_batches: int,
) -> tuple[int, bool]:
    """Run `id_query` and delete what it returns, repeatedly.

    `id_query` must be a `Select` of primary keys **already limited** to
    `batch_size`. Returns `(deleted, truncated)`.

    Committed per batch rather than once at the end: that is what makes an
    interrupted sweep leave the table smaller instead of rolling everything back,
    and it is what keeps the lock short.
    """
    pk = _primary_key(model)
    deleted = 0

    for _ in range(max_batches):
        ids = list(db.scalars(id_query))
        if not ids:
            return deleted, False
        result = db.execute(delete(model).where(pk.in_(ids)))
        db.commit()
        deleted += result.rowcount or 0
        if len(ids) < batch_size:
            return deleted, False

    # Ran out of batches with rows still to go.
    return deleted, True


def trim_by_age(
    db: Session, policy: RetentionPolicy, *, batch_size: int, max_batches: int
) -> tuple[int, bool]:
    """Delete rows older than `max_age_days`. No-op when the limit is 0."""
    if policy.max_age_days <= 0:
        return 0, False

    cutoff = datetime.now(timezone.utc) - timedelta(days=policy.max_age_days)
    pk = _primary_key(policy.model)
    query = (
        select(pk)
        .where(policy.timestamp_column < cutoff)
        .order_by(policy.timestamp_column)
        .limit(batch_size)
    )
    return _delete_in_batches(
        db, policy.model, query, batch_size=batch_size, max_batches=max_batches
    )


def trim_to_cap(
    db: Session, policy: RetentionPolicy, *, batch_size: int, max_batches: int
) -> tuple[int, bool]:
    """Keep only the newest `max_rows`. No-op when the cap is 0.

    **`OFFSET` is what makes this a cap rather than a guess.** The subquery orders
    newest-first and skips the rows we are keeping, so whatever it returns is by
    definition surplus — no cutoff date has to be computed, and a burst of
    traffic cannot slip under a date-based rule.

    The primary key is the tiebreak. Without it two rows sharing a timestamp
    order arbitrarily, and a row could sit inside the keep-window on one pass and
    outside it on the next — deleting a row the cap should have kept while
    keeping one it should have deleted.
    """
    if policy.max_rows <= 0:
        return 0, False

    # One cheap count first: the common case is a table already under its cap,
    # and this turns that case into a single `COUNT(*)` instead of an `OFFSET`
    # scan past every row being kept.
    total = db.scalar(select(func.count()).select_from(policy.model)) or 0
    if total <= policy.max_rows:
        return 0, False

    pk = _primary_key(policy.model)
    query = (
        select(pk)
        .order_by(policy.timestamp_column.desc(), pk.desc())
        .offset(policy.max_rows)
        .limit(batch_size)
    )
    return _delete_in_batches(
        db, policy.model, query, batch_size=batch_size, max_batches=max_batches
    )


def enforce(
    db: Session, policy: RetentionPolicy, *, batch_size: int, max_batches: int
) -> SweepResult:
    """Apply both limits to one policy.

    Age first: it is indexed and usually removes most of what the cap would have
    had to, so the cap's `OFFSET` scan runs over a smaller table.
    """
    by_age, age_truncated = trim_by_age(
        db, policy, batch_size=batch_size, max_batches=max_batches
    )
    by_cap, cap_truncated = trim_to_cap(
        db, policy, batch_size=batch_size, max_batches=max_batches
    )
    return SweepResult(
        policy=policy.name,
        by_age=by_age,
        by_cap=by_cap,
        truncated=age_truncated or cap_truncated,
    )


def enforce_all(
    db: Session,
    *,
    batch_size: int,
    max_batches: int,
    only: str | None = None,
    include_opt_in: bool = False,
) -> list[SweepResult]:
    """Sweep the registered policies.

    `only` runs exactly one policy **and overrides `requires_opt_in`** — naming a
    policy on the command line IS the instruction that flag is asking for.
    Otherwise opt-in policies are skipped unless `include_opt_in` is set.
    """
    results: list[SweepResult] = []
    for name, policy in _POLICIES.items():
        if only is not None:
            if name != only:
                continue
        elif policy.requires_opt_in and not include_opt_in:
            continue
        results.append(enforce(db, policy, batch_size=batch_size, max_batches=max_batches))
    return results


def row_counts(db: Session) -> dict[str, int]:
    """Current size of every governed table. For `--status` and the health page."""
    return {
        name: db.scalar(select(func.count()).select_from(policy.model)) or 0
        for name, policy in _POLICIES.items()
    }


__all__ = [
    "RetentionPolicy",
    "SweepResult",
    "register_policy",
    "policies",
    "reset_for_tests",
    "trim_by_age",
    "trim_to_cap",
    "enforce",
    "enforce_all",
    "row_counts",
]
