"""Activity-log endpoints (TECH_DEBT PM-32).

The read surface for the audit trail. LeapDesk has an Activity Log Index; this is
the API half of the same thing.

**Read-only, and that is structural rather than a policy.** There is no create,
update or delete route here and no service function behind one. An audit trail a
privileged user can edit is not evidence of anything, so tampering is prevented by
there being no code path — not by a permission that could later be widened by
someone who did not know why it was narrow.

Recording happens at the call sites that matter (login, role change, status
change, deletion). Nothing writes through this router.
"""

import csv
import io
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_permission
from app.core.permissions import ACTIVITY_VIEW
from app.core.query import page_count
from app.models.user import User
from app.services import activity_service

router = APIRouter(prefix="/activity", tags=["activity"])


class ActivityEntry(BaseModel):
    id: int
    log_name: str | None
    description: str
    event: str | None
    subject_type: str | None
    subject_id: str | None
    causer_id: str | None
    #: Resolved display name for `causer_id`, or None for an unauthenticated
    #: actor. Sent alongside the id because the id alone means nothing on screen,
    #: and resolving it per row in the client would be N requests per page.
    causer_name: str | None
    properties: dict | None
    batch_uuid: str | None
    created_at: datetime


class PaginatedActivity(BaseModel):
    items: list[ActivityEntry]
    total: int
    page: int
    per_page: int
    pages: int


@router.get("", response_model=PaginatedActivity)
def list_activity(
    log_name: str | None = Query(default=None, description="'auth' | 'default'"),
    event: str | None = Query(default=None),
    subject_type: str | None = Query(default=None, description="'User' | 'Role'"),
    subject_id: str | None = Query(default=None),
    causer_id: str | None = Query(default=None, description="Filter to one actor"),
    search: str | None = Query(default=None, description="Substring of the description"),
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
    hide_system: bool = Query(
        default=False, description="Drop rows with no human causer (automation)"
    ),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=25, ge=1, le=100),
    db: Session = Depends(get_db),
    _actor: User = Depends(require_permission(ACTIVITY_VIEW)),
) -> PaginatedActivity:
    """The audit trail, newest first.

    Sorted by `id`, not `created_at`: rows written inside one transaction can share
    a timestamp, and an unstable sort would let a row appear on two consecutive
    pages or on neither.
    """
    rows, total, causer_names = activity_service.list_entries(
        db,
        log_name=log_name,
        event=event,
        subject_type=subject_type,
        subject_id=subject_id,
        causer_id=causer_id,
        search=search,
        date_from=date_from,
        date_to=date_to,
        hide_system=hide_system,
        page=page,
        per_page=per_page,
    )

    return PaginatedActivity(
        items=[
            ActivityEntry(
                id=row.id,
                log_name=row.log_name,
                description=row.description,
                event=row.event,
                subject_type=row.subject_type,
                subject_id=row.subject_id,
                causer_id=row.causer_id,
                causer_name=causer_names.get(row.causer_id) if row.causer_id else None,
                properties=row.properties,
                batch_uuid=row.batch_uuid,
                created_at=row.created_at,
            )
            for row in rows
        ],
        total=total,
        page=page,
        per_page=per_page,
        # Was `max(1, ...)`, which reported one page for an empty trail and made
        # the pager render "1 / 1" above no rows. `/users` already returned 0 in
        # that case and `DataTable.tsx` branches on `pages === 0`, so 0 is the
        # contract the frontend is written against; this endpoint was the odd one.
        pages=page_count(total, per_page),
    )


@router.get("/export")
def export_activity(
    log_name: str | None = Query(default=None),
    event: str | None = Query(default=None),
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
    db: Session = Depends(get_db),
    _actor: User = Depends(require_permission(ACTIVITY_VIEW)),
) -> StreamingResponse:
    """Stream the trail as CSV — the first thing anyone asks for in a real review.

    **Streamed, not built in memory.** This is the one read with no upper bound:
    "everything for the audit" is the whole point, and materialising a year of rows
    to assemble a response is the request that runs the process out of memory.

    Oldest first, unlike the paginated view: a file is read top to bottom as a
    chronology, where a screen is read newest-first.

    `properties` is emitted as compact JSON in one column. Flattening it into
    columns is impossible — the shape differs per event — and truncating it would
    silently drop the before/after diff that makes an export worth having.
    """

    def rows():
        buffer = io.StringIO()
        writer = csv.writer(buffer)

        def flush() -> str:
            value = buffer.getvalue()
            buffer.seek(0)
            buffer.truncate(0)
            return value

        writer.writerow(
            ["id", "created_at", "log_name", "event", "description",
             "subject_type", "subject_id", "causer_id", "batch_uuid", "properties"]
        )
        yield flush()

        for row in activity_service.iter_for_export(
            db, log_name=log_name, event=event, date_from=date_from, date_to=date_to
        ):
            writer.writerow([
                row.id,
                row.created_at.isoformat(),
                row.log_name or "",
                row.event or "",
                row.description,
                row.subject_type or "",
                row.subject_id or "",
                row.causer_id or "",
                row.batch_uuid or "",
                json.dumps(row.properties, separators=(",", ":")) if row.properties else "",
            ])
            yield flush()

    return StreamingResponse(
        rows(),
        media_type="text/csv",
        headers={
            # A filename without a timestamp means the second export overwrites the
            # first in the downloads folder, which is how two audits get confused.
            "Content-Disposition": (
                f'attachment; filename="activity-log-{datetime.now(timezone.utc):%Y%m%d-%H%M%S}.csv"'
            )
        },
    )


@router.get("/events", response_model=list[str])
def list_events(
    db: Session = Depends(get_db),
    _actor: User = Depends(require_permission(ACTIVITY_VIEW)),
) -> list[str]:
    """Event names actually present in the trail, for the filter dropdown.

    Read from the data rather than a hardcoded list, so an event added by a future
    call site appears without anyone remembering to register it — and one that has
    never occurred does not clutter the filter.
    """
    return activity_service.distinct_events(db)
