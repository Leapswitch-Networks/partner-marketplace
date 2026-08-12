"""Recording to the audit trail (TECH_DEBT PM-32).

Ported in behaviour from LeapDesk's `LogsAllActivity` trait and `LogAuthEvents`
listener. Laravel gets model diffs for free from Eloquent events; SQLAlchemy has
equivalent hooks, but wiring them globally would log every write in the app,
including the session `last_seen_at` touches. So this is explicit: call sites
decide what is worth auditing.

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

import getpass
import logging
import os
import socket
import sys
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from contextvars import ContextVar
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.query import ListParams, ListSpec, run_list
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
    LOG_SETTINGS,
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


# --- Where a row came from --------------------------------------------------
#: Ported from the reference's `LogsAllActivity::resolveActivityContext()`. A
#: trail that cannot tell "an admin changed this in the UI" from "the seeder
#: wrote it on a fresh database" answers the wrong question during an incident —
#: and the second kind has no causer, so without a source those rows are simply
#: unattributed.
SOURCE_WEB = "web"
SOURCE_SEEDER = "seeder"
SOURCE_COMMAND = "command"

#: The reference also declares `tinker` and `job`. **Neither is portable and
#: neither is declared here.** There is no REPL attached to this app, and there
#: is no queue — the same absence that blocks Module 16 in
#: `LEAPDESK_PARITY_PLAN.md`. Offering a filter option that can never match a row
#: teaches the reader that no background work has happened, which is a different
#: claim from "nothing runs in the background here".
SOURCES: tuple[str, ...] = (SOURCE_WEB, SOURCE_SEEDER, SOURCE_COMMAND)

SOURCE_LABELS: dict[str, str] = {
    SOURCE_WEB: "Web (any UI or API action)",
    SOURCE_SEEDER: "Seeder (CLI)",
    SOURCE_COMMAND: "Script / command (CLI)",
}

#: Set by `use_source()`. A ContextVar rather than a module global because the
#: web process serves requests concurrently, and a global would let one request's
#: declaration leak into another's rows.
_source_override: ContextVar[str | None] = ContextVar("activity_source", default=None)


@contextmanager
def use_source(source: str) -> Iterator[None]:
    """Declare the source for every row written inside the block.

    For a caller that knows what it is better than the detector does — a seeder
    invoked from a test, say, where the process is pytest. Detection is the
    default precisely so that forgetting this yields a *wrong-ish* label rather
    than no label at all.
    """
    token = _source_override.set(source)
    try:
        yield
    finally:
        _source_override.reset(token)


def _detect_source() -> str:
    """Web if this process is serving HTTP, CLI otherwise.

    The reference asks the framework (`app()->runningInConsole()`); we have no
    equivalent, so this reads `argv` — which is the same question asked one layer
    down. Anything not recognisably a server is treated as a command, so a new
    entry point is mislabelled rather than unlabelled.
    """
    argv = sys.argv or [""]
    program = os.path.basename(argv[0])
    if "uvicorn" in program or "gunicorn" in program or "app.main" in " ".join(argv[:3]):
        return SOURCE_WEB
    if "seed" in " ".join(argv[:6]):
        return SOURCE_SEEDER
    return SOURCE_COMMAND


def _os_user() -> str | None:
    # Raises when the container has no passwd entry for the uid, which is normal
    # in a rootless image. Not knowing is fine; failing an audit write is not.
    try:
        return getpass.getuser()
    except Exception:  # noqa: BLE001 - context is best-effort by definition
        return None


def _source_context() -> dict[str, Any]:
    """The context bag merged into every row's `properties`."""
    source = _source_override.get() or _detect_source()
    if source == SOURCE_WEB:
        return {"source": source}

    # A CLI row has no causer, so without this the trail records that something
    # changed and nothing whatever about who changed it.
    context = {
        "source": source,
        "actor_label": f"CLI: {' '.join(sys.argv[:6])}".strip() or "CLI",
        "os_user": _os_user(),
        "host": socket.gethostname() or None,
    }
    return {k: v for k, v in context.items() if v}


def _redact(values: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in values.items() if k not in _SENSITIVE}


def _with_context(properties: dict[str, Any] | None) -> dict[str, Any]:
    """Caller detail, redacted, plus the source context.

    Context is applied **after** the caller's keys and wins on a collision: a
    `source` a call site passed by hand would otherwise be able to disguise a
    seeder row as a web one, and the whole value of the discriminator is that
    nothing chooses its own.
    """
    merged = _redact(properties) if properties else {}
    merged.update(_source_context())
    return merged


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
            properties=_with_context(properties),
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


# --- Presentation -----------------------------------------------------------
#: Friendly labels for the Module filter and the per-row badge, keyed by
#: `log_name`. The reference's map with its buckets swapped for ours; an unknown
#: key falls through to a capitalised default rather than rendering a raw slug.
MODULE_LABELS: dict[str, str] = {
    LOG_AUTH: "Authentication",
    LOG_SETTINGS: "Configuration",
    LOG_DEFAULT: "General",
}

#: `subject_type` → URL template, `{id}` substituted at read time. This is the
#: whole map: the reference falls back to a `resolveSubjectUrl()` on the model
#: when a type is absent here, which co-locates the answer with the model but
#: means a route lives in two places. **A type that is not here gets no link**,
#: which is the honest outcome for a record with no page to open — and is why
#: `Partner` is absent rather than pointed at a page that does not exist yet.
SUBJECT_URLS: dict[str, str] = {
    "User": "/dashboard/users/{id}",
    "Role": "/dashboard/roles/{id}",
    # No detail route exists for these; the index is where the record is read.
    "UserInvitation": "/dashboard/invitations",
    "FeatureFlag": "/dashboard/feature-flags",
    "DataAccessGrant": "/dashboard/data-access",
    "ApiCredential": "/dashboard/api-credentials",
    "Setting": "/dashboard/configuration",
    "AppSettings": "/dashboard/branding",
}


def module_label(log_name: str | None) -> str:
    if not log_name:
        return MODULE_LABELS[LOG_DEFAULT]
    return MODULE_LABELS.get(log_name) or log_name.replace("_", " ").capitalize()


def subject_url(subject_type: str | None, subject_id: str | None) -> str | None:
    """Where to click through to, or None when the record has no page."""
    if not subject_type:
        return None
    template = SUBJECT_URLS.get(subject_type)
    if not template:
        return None
    if "{id}" not in template:
        return template
    if not subject_id:
        return None
    return template.replace("{id}", str(subject_id))


_LIST_SPEC = ListSpec(
    # `id` is the default, not `created_at`. Rows written inside one transaction
    # share a timestamp, so ordering on it is not a total order and a tying row
    # can appear on two consecutive pages or on neither. This module got that
    # right by hand before the shared pipeline existed; declaring it here keeps
    # it right, because `tiebreak` is required and cannot be dropped by an edit.
    #
    # The other four are the reference's allowlist, and `tiebreak=id` is what
    # makes them safe: `created_at` ties break on the primary key rather than on
    # whatever order the planner returns.
    sortable={
        "id": ActivityLog.id,
        "created_at": ActivityLog.created_at,
        "event": ActivityLog.event,
        "description": ActivityLog.description,
        "log_name": ActivityLog.log_name,
    },
    default_sort="id",
    tiebreak=ActivityLog.id,
    # description + subject_type + log_name, matching the reference. Searching
    # only the description missed "show me everything about a Role", because the
    # model name never appears in the sentence.
    searchable=(
        ActivityLog.description,
        ActivityLog.subject_type,
        ActivityLog.log_name,
    ),
    default_per_page=25,
)


def list_entries(
    db: Session,
    *,
    log_name: str | None = None,
    event: str | None = None,
    subject_type: str | None = None,
    subject_id: str | None = None,
    causer_id: str | None = None,
    source: str | None = None,
    search: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    hide_system: bool = False,
    actor: User | None = None,
    sort_by: str | None = None,
    sort_order: str | None = None,
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

    **Scoped by `actor`, and the scope is defence in depth rather than a fix.**
    Pass the caller and a non-admin sees only rows they caused — they can audit
    their own actions but not a colleague's, which is what the reference does with
    `$viewAll = has_admin_access()`. Today no such caller exists: `activity-view`
    is held only by Admin, RootUser and SuperAdmin, all of which have admin
    access, so this changes nothing about current behaviour. It is here so that
    granting `activity-view` to a fourth role is not silently a decision to expose
    the whole organisation's trail — which is exactly the mistake this endpoint
    would otherwise be one line away from. When partner scoping lands (PM-5) this
    is still the query to revisit, because a partner must never read another
    partner's history.

    `actor=None` means unscoped, for callers that have already established the
    reader may see everything (the export route passes its actor too).
    """
    stmt = select(ActivityLog)

    if actor is not None and not actor.has_admin_access:
        stmt = stmt.where(ActivityLog.causer_id == actor.id)

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
    if date_from:
        stmt = stmt.where(ActivityLog.created_at >= date_from)
    if date_to:
        stmt = stmt.where(ActivityLog.created_at <= date_to)
    if hide_system:
        # Rows with no causer are automation — seeders, CLI, scheduled purges.
        # Someone reading a who-did-what feed can drop them. Ported from the
        # reference, which does exactly `whereNotNull('causer_id')`.
        stmt = stmt.where(ActivityLog.causer_id.isnot(None))
    if source:
        # A JSONB path predicate, not a column: the discriminator lives inside
        # `properties` exactly as the reference stores it. **Rows written before
        # this shipped carry no `source` and match no value** — they are neither
        # web nor CLI, they are unlabelled, and reporting them as either would be
        # the filter inventing history.
        stmt = stmt.where(ActivityLog.properties["source"].astext == source)

    if search:
        # Applied here rather than through `ListSpec.searchable`, which matches
        # columns on this table only. The reference searches the causer's name
        # and email too, and "show me everything Ayush did" is the search people
        # actually type. A subquery, not a join: a join would multiply rows.
        like = f"%{search}%"
        causers = select(User.id).where(
            or_(
                User.first_name.ilike(like),
                User.last_name.ilike(like),
                User.email.ilike(like),
            )
        )
        stmt = stmt.where(
            or_(
                ActivityLog.description.ilike(like),
                ActivityLog.subject_type.ilike(like),
                ActivityLog.log_name.ilike(like),
                ActivityLog.causer_id.in_(causers),
            )
        )

    # Count, ordering and paging come from the shared pipeline. `search=None`
    # because it has already been applied above — passing it twice would AND the
    # narrow form onto the wide one and drop every causer-name match.
    rows, total = run_list(
        db,
        stmt,
        _LIST_SPEC,
        ListParams(
            page=page,
            per_page=per_page,
            search=None,
            sort_by=sort_by,
            # Anything but an explicit "asc" is newest-first. `ListSpec.column_for`
            # already falls back rather than raising on an unknown `sort_by`, and
            # this keeps the pair consistent: a stale bookmark renders the list.
            sort_order="asc" if sort_order == "asc" else "desc",
        ),
    )

    causer_ids = {row.causer_id for row in rows if row.causer_id}
    names: dict[str, str] = {}
    if causer_ids:
        for user in db.scalars(select(User).where(User.id.in_(causer_ids))):
            names[user.id] = user.full_name

    return rows, total, names


def filter_options(db: Session, *, actor: User | None = None) -> dict[str, list[dict]]:
    """The dropdown sources for the index filters, scoped like the list itself.

    Derived from the slice the reader is allowed to see, which is the reference's
    rule and not merely tidiness: an unscoped causer list on a scoped table is a
    staff directory handed to whoever holds `activity-view`, and every option in
    it but one would return an empty table.

    Causer-less rows are excluded from the *option* lists — automation has no
    name to offer — but they remain in the table unless `hide_system` is set.
    """
    scope_id = actor.id if actor is not None and not actor.has_admin_access else None

    def scoped(stmt):
        stmt = stmt.where(ActivityLog.causer_id.is_not(None))
        return stmt.where(ActivityLog.causer_id == scope_id) if scope_id else stmt

    events = sorted(
        value
        for value in db.scalars(
            scoped(select(ActivityLog.event).distinct()).where(
                ActivityLog.event.is_not(None)
            )
        )
        if value
    )
    log_names = sorted(
        (value for value in db.scalars(scoped(select(ActivityLog.log_name).distinct())) if value),
        key=module_label,
    )
    subject_types = sorted(
        value
        for value in db.scalars(
            scoped(select(ActivityLog.subject_type).distinct()).where(
                ActivityLog.subject_type.is_not(None)
            )
        )
        if value
    )
    causer_ids = [
        value for value in db.scalars(scoped(select(ActivityLog.causer_id).distinct())) if value
    ]
    causers = sorted(
        (
            {"value": user.id, "label": user.full_name or user.email}
            for user in db.scalars(select(User).where(User.id.in_(causer_ids)))
        ),
        key=lambda option: option["label"].lower(),
    )

    return {
        "events": [{"value": value, "label": value.replace("_", " ")} for value in events],
        "log_names": [{"value": value, "label": module_label(value)} for value in log_names],
        "subject_types": [{"value": value, "label": value} for value in subject_types],
        "causers": causers,
        "sources": [
            {"value": value, "label": SOURCE_LABELS[value]} for value in SOURCES
        ],
    }


def iter_for_export(
    db: Session,
    *,
    log_name: str | None = None,
    event: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    actor: User | None = None,
    batch_size: int = 500,
):
    """Yield matching rows for a CSV export, in batches.

    A generator rather than a list because an export is the one read with no upper
    bound — "give me everything for the audit" is the whole point of it, and
    materialising a year of rows to build a response would be the request that
    exhausts memory. `yield_per` streams from the driver rather than buffering the
    full result.

    Oldest first here, unlike the paginated view: an exported file is read top to
    bottom as a chronology, where a screen is read newest-first.
    """
    stmt = select(ActivityLog).order_by(ActivityLog.id.asc())

    # The same sandbox the list applies. An export that ignored it would be the
    # way around the scope, and "download everything" is the more damaging half.
    if actor is not None and not actor.has_admin_access:
        stmt = stmt.where(ActivityLog.causer_id == actor.id)

    if log_name:
        stmt = stmt.where(ActivityLog.log_name == log_name)
    if event:
        stmt = stmt.where(ActivityLog.event == event)
    if date_from:
        stmt = stmt.where(ActivityLog.created_at >= date_from)
    if date_to:
        stmt = stmt.where(ActivityLog.created_at <= date_to)

    yield from db.scalars(stmt.execution_options(yield_per=batch_size))


def _purge_cutoff(days: int):
    """Shared by the count and the delete so a dry run cannot disagree with reality.

    Returns `None` for a retention longer than `datetime` can express — semantically
    "nothing is that old" — rather than raising. Found by passing 999999 while testing
    the positive-value guard, which raised OverflowError from timedelta.
    """
    if days <= 0:
        raise ValueError("Retention must be a positive number of days.")
    try:
        return datetime.now(timezone.utc) - timedelta(days=days)
    except (OverflowError, OSError):
        return None


def count_purgeable(db: Session, days: int) -> int:
    """How many rows `purge_older_than` would delete. For `--dry-run`.

    Reading before deleting matters more here than for sessions: this is an audit
    trail, and the delete is not reversible.
    """
    cutoff = _purge_cutoff(days)
    if cutoff is None:
        return 0
    return db.scalar(
        select(func.count()).select_from(ActivityLog).where(ActivityLog.created_at < cutoff)
    ) or 0


def retention_status(db: Session) -> dict:
    """What the trail's horizon actually is — **as observed, not as configured.**

    The reference puts a static `retentionDays` on the index. A number from a
    config file answers the wrong question: it says what *would* be deleted, and
    a reader wants to know whether anything *was*. A trail that silently ends
    somewhere is the audit-log version of the finding in Global Search — an
    absence that looks like evidence.

    So this reports the configured window **and** the last time the purge job
    actually completed. `purge_ever_ran` false means every row ever written is
    still here and the window is theoretical, which is the state this project is
    in by default and the honest thing to tell someone reading an audit.
    """
    # Imported here rather than at module scope: the audit trail is written from
    # everywhere, and a top-level import of the worker's model would put the
    # monitoring table on the import path of every request that logs anything.
    from app.core.config import settings
    from app.models.worker_run import STATUS_SUCCEEDED, WorkerJobRun

    last = db.scalars(
        select(WorkerJobRun)
        .where(WorkerJobRun.job == "activity-log", WorkerJobRun.status == STATUS_SUCCEEDED)
        .order_by(WorkerJobRun.started_at.desc())
        .limit(1)
    ).first()
    return {
        "retention_days": settings.ACTIVITY_LOG_RETENTION_DAYS,
        "purge_ever_ran": last is not None,
        "last_purge_at": last.finished_at or last.started_at if last else None,
        "rows_removed_last_run": last.count if last else 0,
    }


def purge_older_than(db: Session, days: int) -> int:
    """Delete audit rows older than `days`. Returns how many were removed.

    **Called only by a job that is off unless someone switches it on.** How long
    who-did-what is kept is a policy decision — legal, contractual, or simply "how
    far back do we want to be able to answer questions?" — and it is not this
    function's place to pick a number. `ACTIVITY_LOG_RETENTION_DAYS` exists as a
    default for whoever runs it.

    This paragraph used to end *"nothing calls it on a schedule because there is
    no scheduler"*. That stopped being true when `app/worker.py` shipped: there
    is a scheduler, and `activity-log` is one of its jobs. What remains true is
    the substance — that job is the one deliberate `enabled=False` in the file,
    so switching a worker on does not quietly start deleting an audit trail.
    Corrected by the § 8.1 audit, 2026-08-12.

    Refuses a non-positive value rather than treating it as "everything": a stray
    `0` from a config file should not silently destroy the entire trail.
    """
    cutoff = _purge_cutoff(days)
    if cutoff is None:
        return 0
    result = db.execute(
        ActivityLog.__table__.delete().where(ActivityLog.created_at < cutoff)
    )
    db.commit()
    removed = result.rowcount or 0

    # Recorded in the trail it just truncated, so the gap is explained rather than
    # looking like data loss to whoever reads it next.
    if removed:
        record(
            db,
            description=f"Purged {removed} activity log row(s) older than {days} days",
            event="activity_log_purged",
            properties={"removed": removed, "retention_days": days},
        )
    return removed


def distinct_events(db: Session, *, actor: User | None = None) -> list[str]:
    """Every event name present in the trail, for a filter dropdown.

    Read from the data rather than from a hardcoded list, so an event added by a
    future call site appears in the filter without anyone remembering to register
    it — and one that has never actually occurred does not clutter the list.

    Scoped like `list_entries`: an option that returns nothing for the reader who
    is offered it is a filter that appears broken.
    """
    stmt = select(ActivityLog.event).distinct().where(ActivityLog.event.is_not(None))
    if actor is not None and not actor.has_admin_access:
        stmt = stmt.where(ActivityLog.causer_id == actor.id)
    return [value for value in db.scalars(stmt) if value]


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
