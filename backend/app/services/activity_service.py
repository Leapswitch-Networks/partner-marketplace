"""Recording to the audit trail (TECH_DEBT PM-32).

Ported in behaviour from LeapDesk's `LogsAllActivity` trait and `LogAuthEvents`
listener. Laravel gets model diffs for free from Eloquent events; SQLAlchemy has
equivalent hooks, but wiring them globally would log every write in the app
including the inherited test-platform domain and the session `last_seen_at`
touches. So this is explicit: call sites decide what is worth auditing.

That is a real trade-off and worth naming. Explicit calls can be forgotten, where
a global hook cannot. The reason to accept it: an audit trail full of noise is one
nobody reads, and `last_seen_at` firing every five minutes per session would bury
the role grants. The mitigation is that the security-relevant paths — role
changes, status changes, deletions, and every auth outcome — are wired here and
listed in AUTHORIZATION.md, so a reviewer can check the list against the routes.

**Nothing in here may raise.** A failure to write an audit row must never fail the
operation being audited: refusing a login because the log write failed would turn
an observability feature into an outage. Every entry point swallows and logs its
own exceptions, which is exactly what LeapDesk's listener does with its
try/catch around `activity()`.

**What is deliberately never recorded:** password values, hashes, and reset
tokens. `_SENSITIVE` is subtracted from every diff. An audit trail is read by more
people than the database is, so it is a worse place for a secret, not a better one.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.activity_log import (
    EVENT_CREATED,
    EVENT_DELETED,
    EVENT_FAILED_LOGIN,
    EVENT_LOGIN,
    EVENT_LOGOUT,
    EVENT_ROLES_CHANGED,
    EVENT_STATUS_CHANGED,
    EVENT_UPDATED,
    LOG_AUTH,
    LOG_DEFAULT,
    ActivityLog,
)
from app.models.user import User

logger = logging.getLogger("app.activity")

#: Never written to `properties`, at any depth of a diff.
_SENSITIVE = frozenset(
    {
        "password",
        "password_hash",
        "current_password",
        "confirm_password",
        "password_reset_token",
        "two_factor_secret",
        "two_factor_recovery_codes",
    }
)

#: Keys whose change means "the status flipped" rather than "fields were edited".
#: LeapDesk's `activityLogStatusKeys`, same defaults.
_STATUS_KEYS = frozenset({"status", "active", "is_active"})


def _redact(values: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in values.items() if k not in _SENSITIVE}


def _causer(actor: User | None) -> tuple[str | None, str | None]:
    if actor is None:
        return None, None
    return "User", actor.id


def record(
    db: Session,
    *,
    description: str,
    event: str | None = None,
    log_name: str = LOG_DEFAULT,
    subject_type: str | None = None,
    subject_id: str | None = None,
    actor: User | None = None,
    causer_id: str | None = None,
    properties: dict[str, Any] | None = None,
    batch_uuid: str | None = None,
) -> None:
    """Write one row. Never raises.

    Commits on its own rather than joining the caller's transaction. If it shared
    one, a rollback in the caller would silently discard the audit row — and the
    cases most worth auditing are exactly the ones that sometimes fail partway.
    """
    try:
        entry = ActivityLog(
            log_name=log_name,
            description=description,
            event=event,
            subject_type=subject_type,
            subject_id=str(subject_id) if subject_id is not None else None,
            properties=_redact(properties) if properties else None,
            batch_uuid=batch_uuid,
        )
        if actor is not None:
            entry.causer_type, entry.causer_id = _causer(actor)
        elif causer_id is not None:
            # For paths that hold only an id — logout runs without loading the
            # User, because it must work even when the account is suspended and
            # the guard would refuse to hand one over.
            entry.causer_type, entry.causer_id = "User", causer_id
        db.add(entry)
        db.commit()
    except Exception as exc:  # noqa: BLE001 - auditing must not break the action
        logger.error(
            "failed to write activity log: %s: %s",
            type(exc).__name__,
            exc,
            extra={"event": event, "subject_type": subject_type},
        )
        try:
            db.rollback()
        except Exception:  # noqa: BLE001 - nothing further can be done here
            pass


def new_batch() -> str:
    """A batch id, so the rows of one bulk operation can be grouped."""
    return str(uuid.uuid4())


# --- Model changes ----------------------------------------------------------


def record_change(
    db: Session,
    *,
    subject_type: str,
    subject_id: str,
    before: dict[str, Any],
    after: dict[str, Any],
    actor: User | None,
    label: str,
    batch_uuid: str | None = None,
) -> None:
    """Record a field diff, logging only what actually changed.

    Two behaviours copied from LeapDesk:

    * **Dirty fields only** (`logOnlyDirty`). A row of "nothing changed" is noise.
    * **An empty diff writes nothing** (`dontSubmitEmptyLogs`), so a PATCH that
      submits identical values does not manufacture history.
    * **A pure status flip becomes `status_changed`**, not `updated`, so a timeline
      can render it distinctly.
    """
    changed = {k: v for k, v in after.items() if k in before and before[k] != v}
    changed.update({k: v for k, v in after.items() if k not in before})
    if not changed:
        return

    event = EVENT_UPDATED
    if changed and set(changed).issubset(_STATUS_KEYS):
        event = EVENT_STATUS_CHANGED

    record(
        db,
        description=f"{label} — {event}",
        event=event,
        subject_type=subject_type,
        subject_id=subject_id,
        actor=actor,
        properties={
            "attributes": _redact(changed),
            "old": _redact({k: before[k] for k in changed if k in before}),
        },
        batch_uuid=batch_uuid,
    )


def record_created(
    db: Session, *, subject_type: str, subject_id: str, values: dict[str, Any],
    actor: User | None, label: str,
) -> None:
    record(
        db,
        description=f"{label} — created",
        event=EVENT_CREATED,
        subject_type=subject_type,
        subject_id=subject_id,
        actor=actor,
        properties={"attributes": _redact(values)},
    )


def record_deleted(
    db: Session, *, subject_type: str, subject_id: str, values: dict[str, Any],
    actor: User | None, label: str, batch_uuid: str | None = None,
) -> None:
    """Record a deletion, keeping a snapshot of what was removed.

    The snapshot is the point: after a hard delete the row is gone, so an audit
    entry saying only "deleted #7" answers nothing later.
    """
    record(
        db,
        description=f"{label} — deleted",
        event=EVENT_DELETED,
        subject_type=subject_type,
        subject_id=subject_id,
        actor=actor,
        properties={"old": _redact(values)},
        batch_uuid=batch_uuid,
    )


def record_roles_changed(
    db: Session, *, target: User, before: list[str], after: list[str], actor: User | None
) -> None:
    """Record a role grant or revocation as its own event.

    Not folded into a generic `updated` diff, because in an RBAC system this is
    the change most likely to be the subject of "who did that, and when?".
    """
    if sorted(before) == sorted(after):
        return

    granted = sorted(set(after) - set(before))
    revoked = sorted(set(before) - set(after))
    parts = []
    if granted:
        parts.append(f"granted {', '.join(granted)}")
    if revoked:
        parts.append(f"revoked {', '.join(revoked)}")

    record(
        db,
        description=f"{target.email} — {'; '.join(parts)}",
        event=EVENT_ROLES_CHANGED,
        subject_type="User",
        subject_id=target.id,
        actor=actor,
        properties={
            "attributes": {"roles": after},
            "old": {"roles": before},
            "granted": granted,
            "revoked": revoked,
        },
    )


# --- Auth events ------------------------------------------------------------
# Mirrors LeapDesk's LogAuthEvents listener, including failed_login.


def record_login(db: Session, user: User, ip: str | None, user_agent: str | None) -> None:
    record(
        db,
        log_name=LOG_AUTH,
        description=f"{user.full_name} logged in",
        event=EVENT_LOGIN,
        subject_type="User",
        subject_id=user.id,
        actor=user,
        properties={"ip": ip, "user_agent": user_agent},
    )


def record_logout(db: Session, user_id: str, ip: str | None) -> None:
    """Self-attributed: the user caused their own logout, so causer == subject."""
    record(
        db,
        log_name=LOG_AUTH,
        description="Signed out",
        event=EVENT_LOGOUT,
        subject_type="User",
        subject_id=user_id,
        causer_id=user_id,
        properties={"ip": ip},
    )


def list_entries(
    db: Session,
    *,
    log_name: str | None = None,
    event: str | None = None,
    subject_type: str | None = None,
    subject_id: str | None = None,
    causer_id: str | None = None,
    search: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    page: int = 1,
    per_page: int = 25,
) -> tuple[list[ActivityLog], int, dict[str, str]]:
    """Read the trail, newest first. Returns `(rows, total, causer_names)`.

    **Read-only by design — there is no update or delete anywhere in this module.**
    An audit trail a privileged user can edit is not evidence of anything, so
    tampering is prevented by there being no code path to it rather than by a
    permission check that could later be widened.

    `causer_names` maps causer id to a display name, resolved in **one** query for
    the whole page rather than per row. Without it, rendering a 25-row page would
    issue 25 lookups, and `causer_id` is a bare UUID that means nothing on screen.

    Deliberately **not** scoped by actor: `activity-view` is the whole
    authorisation. This is a global audit trail, and a partial view of one is worse
    than none — someone reviewing an incident needs to know they are seeing
    everything. When partner scoping lands (PM-5) this is the query to revisit
    first, because a partner must never read another partner's history.
    """
    stmt = select(ActivityLog)

    if log_name:
        stmt = stmt.where(ActivityLog.log_name == log_name)
    if event:
        stmt = stmt.where(ActivityLog.event == event)
    if subject_type:
        stmt = stmt.where(ActivityLog.subject_type == subject_type)
    if subject_id:
        stmt = stmt.where(ActivityLog.subject_id == str(subject_id))
    if causer_id:
        stmt = stmt.where(ActivityLog.causer_id == str(causer_id))
    if search:
        stmt = stmt.where(func.lower(ActivityLog.description).like(f"%{search.strip().lower()}%"))
    if date_from:
        stmt = stmt.where(ActivityLog.created_at >= date_from)
    if date_to:
        stmt = stmt.where(ActivityLog.created_at <= date_to)

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0

    per_page = max(1, min(per_page, 100))
    page = max(1, page)
    rows = list(
        db.scalars(
            stmt.order_by(ActivityLog.id.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
        )
    )

    # Ordered by `id` rather than `created_at`: two rows written in the same
    # transaction can share a timestamp, and an unstable sort would let a row
    # appear on two consecutive pages or on neither.
    causer_ids = {row.causer_id for row in rows if row.causer_id}
    names: dict[str, str] = {}
    if causer_ids:
        for user in db.scalars(select(User).where(User.id.in_(causer_ids))):
            names[user.id] = user.full_name

    return rows, total, names


def distinct_events(db: Session) -> list[str]:
    """Every event name present in the trail, for a filter dropdown.

    Read from the data rather than from a hardcoded list, so an event added by a
    future call site appears in the filter without anyone remembering to register
    it — and one that has never actually occurred does not clutter the list.
    """
    return [
        value
        for value in db.scalars(
            select(ActivityLog.event).distinct().where(ActivityLog.event.is_not(None))
        )
        if value
    ]


def record_failed_login(db: Session, email: str, ip: str | None, reason: str) -> None:
    """Record a failed attempt.

    **No causer**, deliberately: nobody authenticated, and attributing the attempt
    to the account whose address was typed would imply that account did something.
    The email goes in `properties` as submitted input, which is also why it is not
    used as the subject — the address may not correspond to any account, and
    inventing a subject for it would be fiction.
    """
    record(
        db,
        log_name=LOG_AUTH,
        description=f"Failed login attempt for {email}",
        event=EVENT_FAILED_LOGIN,
        properties={"email": email, "ip": ip, "reason": reason},
    )
