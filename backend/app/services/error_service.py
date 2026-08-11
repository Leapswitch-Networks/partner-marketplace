"""Record, group and triage application errors (LeapDesk parity, Module 17).

Port of `ErrorAlertService::fingerprint` + `ErrorTracking\\ErrorRecorder` + the
triage half of `ErrorTrackingController`.

## The fingerprint is the module

    md5(exception_class | file | line | route_name)

Four fields, and **the message is deliberately not one of them**. Two failures
differing only in an interpolated id — `User 41 not found`, `User 87 not found` —
are one bug, and grouping them apart would recreate the log flood this table
exists to replace. It is what turns tens of thousands of lines into a list
somebody can actually work through.

The cost, stated so nobody rediscovers it as a defect: two genuinely different
bugs raised from the same line of a shared helper will group together. That is
the right trade for a helper, and the occurrence rows keep the individual
messages so the merge is visible rather than lossy.

## Recording must never raise

`record` catches everything and logs a warning. It runs inside an exception
handler — the one place in the application where a second failure has nowhere to
go. An error tracker that turns a 500 into a crash is worse than none.
"""

from __future__ import annotations

import hashlib
import logging
import traceback
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.query import ListParams, ListSpec, run_list
from app.models.error_group import (
    REOPENABLE,
    ErrorGroup,
    ErrorOccurrence,
    ErrorStatus,
)
from app.models.user import User

logger = logging.getLogger("app")

#: LeapDesk's limits. A message longer than this is a serialised payload, not a
#: message, and a trace longer than this is unreadable anyway.
MAX_MESSAGE_CHARS = 2_000
MAX_TRACE_CHARS = 10_000

#: How many occurrences the detail view carries. The group is what you triage;
#: the last 20 sightings are enough to see a pattern, and the table holds
#: everything for anyone who needs to query it directly.
DETAIL_OCCURRENCES = 20

_LIST_SPEC = ListSpec(
    sortable={
        "last_seen_at": ErrorGroup.last_seen_at,
        "first_seen_at": ErrorGroup.first_seen_at,
        "occurrence_count": ErrorGroup.occurrence_count,
        "exception_class": ErrorGroup.exception_class,
        "status": ErrorGroup.status,
    },
    default_sort="last_seen_at",
    # `last_seen_at` ties whenever two errors are recorded in the same request,
    # which is exactly when a partial sort drops or repeats rows.
    tiebreak=ErrorGroup.id,
    searchable=(
        ErrorGroup.exception_class,
        ErrorGroup.latest_message,
        ErrorGroup.path,
        ErrorGroup.file,
    ),
)


def fingerprint(
    exception_class: str, file: str, line: int, route_name: str | None
) -> str:
    """The grouping key. See the module docstring for why the message is absent."""
    return hashlib.md5(
        "|".join([exception_class, file, str(line), route_name or ""]).encode()
    ).hexdigest()


def _truncate(text: str, limit: int) -> str:
    return text if len(text) <= limit else text[: limit - 1] + "…"


def _origin(exc: BaseException) -> tuple[str, int]:
    """Where the exception was raised — the **innermost** frame, not the outermost.

    `traceback.extract_tb` walks outward-in, so the last frame is the line that
    actually failed. Taking the first would fingerprint every error in a request
    to the same middleware entry point and collapse the whole table into one row.
    """
    frames = traceback.extract_tb(exc.__traceback__)
    if not frames:
        return "<unknown>", 0
    last = frames[-1]
    return _truncate(last.filename, 500), last.lineno or 0


def _context(request: Request | None) -> dict[str, Any] | None:
    """Request context worth having later.

    ⚠️ **Deliberately does NOT capture request input.** LeapDesk states the reason
    and it is the most important line in this module: bodies routinely carry
    names, emails and credentials, and this table is readable by anyone holding
    `error-view`. An error tracker that quietly becomes a credential store is
    worse than no error tracker.
    """
    if request is None:
        return None
    headers = request.headers
    return {
        "user_agent": _truncate(headers.get("user-agent", ""), 500),
        "referer": _truncate(headers.get("referer", ""), 500),
    }


def record(
    db: Session,
    exc: BaseException,
    *,
    request: Request | None = None,
    module: str = "core",
    user_id: str | None = None,
    ip: str | None = None,
) -> ErrorGroup | None:
    """Record one sighting. Returns its group, or `None` if recording failed.

    **Never raises.** See the module docstring.
    """
    try:
        now = datetime.now(timezone.utc)
        file, line = _origin(exc)
        route_name = request.url.path if request else None
        fp = fingerprint(type(exc).__name__, file, line, route_name)

        group = db.scalar(select(ErrorGroup).where(ErrorGroup.fingerprint == fp))
        is_new = group is None

        if group is None:
            group = ErrorGroup(
                fingerprint=fp,
                first_seen_at=now,
                status="open",
                occurrence_count=0,
            )
            db.add(group)

        # A sighting on a RESOLVED group is a regression: reopen it and clear the
        # resolution, so it cannot masquerade as still-fixed.
        #
        # `ignored` and `muted` are left alone, and that is the deliberate half.
        # Those are decisions someone made about a known error; a new sighting is
        # not new information about them. Only `resolved` is a claim that the
        # error stopped happening, and a sighting disproves it.
        if not is_new and group.status in REOPENABLE:
            group.status = "open"
            group.resolved_by = None
            group.resolved_at = None

        group.exception_class = type(exc).__name__
        group.module = module
        group.route_name = route_name
        group.method = request.method if request else None
        group.path = _truncate(str(request.url.path), 500) if request else None
        group.file = file
        group.line = line
        group.latest_message = _truncate(str(exc) or type(exc).__name__, MAX_MESSAGE_CHARS)
        group.last_seen_at = now
        group.occurrence_count = (group.occurrence_count or 0) + 1

        db.flush()

        db.add(
            ErrorOccurrence(
                error_group_id=group.id,
                user_id=user_id,
                ip=ip,
                url=_truncate(str(request.url), 1000) if request else None,
                method=request.method if request else None,
                message=_truncate(str(exc) or type(exc).__name__, MAX_MESSAGE_CHARS),
                stack_trace=_truncate(
                    "".join(
                        traceback.format_exception(type(exc), exc, exc.__traceback__)
                    ),
                    MAX_TRACE_CHARS,
                ),
                context=_context(request),
                occurred_at=now,
            )
        )
        db.commit()
        return group

    except Exception as inner:  # noqa: BLE001 - see the module docstring
        # Roll back so the caller's session is usable — this runs inside an
        # exception handler that still has a response to build.
        try:
            db.rollback()
        except Exception:  # noqa: BLE001
            pass
        logger.warning(
            "error recorder failed",
            extra={"inner": str(inner), "original": str(exc)},
        )
        return None


# --- Read + triage ----------------------------------------------------------


def list_groups(
    db: Session,
    *,
    search: str | None = None,
    status_filter: str | None = None,
    module: str | None = None,
    sort_by: str | None = None,
    sort_order: str = "desc",
    page: int = 1,
    per_page: int = 25,
) -> tuple[list[ErrorGroup], int]:
    stmt = select(ErrorGroup)
    if status_filter:
        stmt = stmt.where(ErrorGroup.status == status_filter)
    if module:
        stmt = stmt.where(ErrorGroup.module == module)

    return run_list(
        db,
        stmt,
        _LIST_SPEC,
        ListParams(
            page=page,
            per_page=per_page,
            sort_by=sort_by,
            sort_order=sort_order,
            search=search,
        ),
    )


def get_group_or_404(db: Session, group_id: int) -> ErrorGroup:
    group = db.scalar(
        select(ErrorGroup)
        .where(ErrorGroup.id == group_id)
        .options(selectinload(ErrorGroup.occurrences))
    )
    if group is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That error does not exist.")
    return group


def recent_occurrences(db: Session, group_id: int) -> list[ErrorOccurrence]:
    return list(
        db.scalars(
            select(ErrorOccurrence)
            .where(ErrorOccurrence.error_group_id == group_id)
            .order_by(ErrorOccurrence.occurred_at.desc(), ErrorOccurrence.id.desc())
            .limit(DETAIL_OCCURRENCES)
        ).all()
    )


def status_counts(db: Session) -> dict[str, int]:
    """`{status: count}` for the summary cards. Absent statuses read 0."""
    rows = db.execute(
        select(ErrorGroup.status, func.count(ErrorGroup.id)).group_by(ErrorGroup.status)
    ).all()
    return {row[0]: row[1] for row in rows}


def set_status(
    db: Session,
    group: ErrorGroup,
    new_status: ErrorStatus,
    actor: User,
    notes: str | None = None,
) -> ErrorGroup:
    """Triage one group.

    `resolved_by` and `resolved_at` are stamped only for `resolved` and cleared
    otherwise — an error marked `ignored` was not resolved by anyone, and leaving
    a stale resolver on it would misattribute a decision.
    """
    group.status = new_status
    if notes is not None:
        group.notes = notes

    if new_status == "resolved":
        group.resolved_by = actor.id
        group.resolved_at = datetime.now(timezone.utc)
    else:
        group.resolved_by = None
        group.resolved_at = None

    db.commit()
    db.refresh(group)
    return group


def delete_group(db: Session, group: ErrorGroup) -> None:
    """Delete a group and its occurrences.

    Gated on `error-manage` rather than `error-view` because **this destroys the
    evidence of a bug**. The occurrences go with it by cascade, which is
    intentional: a group with no occurrences is a count with nothing behind it.
    """
    db.delete(group)
    db.commit()


__all__ = [
    "DETAIL_OCCURRENCES",
    "MAX_MESSAGE_CHARS",
    "MAX_TRACE_CHARS",
    "delete_group",
    "fingerprint",
    "get_group_or_404",
    "list_groups",
    "recent_occurrences",
    "record",
    "set_status",
    "status_counts",
]
