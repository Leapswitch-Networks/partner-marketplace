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
from app.core.query import page_meta
from app.models.user import User
from app.schemas.activity import ActivityEntry, PaginatedActivity
from app.services import activity_service

router = APIRouter(prefix="/activity", tags=["activity"])


class FilterOption(BaseModel):
    value: str
    label: str


class RetentionStatus(BaseModel):
    """How far back the trail actually goes.

    The reference publishes a static `retentionDays` on this screen. Ours reports
    the configured window **and whether the purge has ever run**, because those
    answer different questions and only the second one changes how you read an
    empty result for an old date range.
    """

    retention_days: int
    #: False means nothing has ever been deleted and the window is theoretical.
    purge_ever_ran: bool
    last_purge_at: datetime | None
    rows_removed_last_run: int


class ActivityFilterOptions(BaseModel):
    """Everything the filter row needs, in one request instead of four."""

    events: list[FilterOption]
    log_names: list[FilterOption]
    subject_types: list[FilterOption]
    causers: list[FilterOption]
    sources: list[FilterOption]
    #: Not a filter — context for reading the result. Returned here because this
    #: is already the index's one metadata call, and a second round trip to say
    #: "nothing has been deleted" would not earn its request.
    retention: RetentionStatus


@router.get("", response_model=PaginatedActivity)
def list_activity(
    log_name: str | None = Query(default=None, description="'auth' | 'default'"),
    event: str | None = Query(default=None),
    subject_type: str | None = Query(default=None, description="'User' | 'Role'"),
    subject_id: str | None = Query(default=None),
    causer_id: str | None = Query(default=None, description="Filter to one actor"),
    source: str | None = Query(
        default=None, description="'web' | 'seeder' | 'command' — where the row came from"
    ),
    search: str | None = Query(
        default=None, description="Substring of the description, subject, module or causer name"
    ),
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
    hide_system: bool = Query(
        default=False, description="Drop rows with no human causer (automation)"
    ),
    sort_by: str | None = Query(
        default=None, description="id | created_at | event | description | log_name"
    ),
    sort_order: str | None = Query(default=None, description="asc | desc"),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=25, ge=1, le=100),
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(ACTIVITY_VIEW)),
) -> PaginatedActivity:
    """The audit trail, newest first.

    Sorted by `id` by default, not `created_at`: rows written inside one
    transaction can share a timestamp, and an unstable sort would let a row appear
    on two consecutive pages or on neither. `created_at` is offered as an explicit
    choice because reading an incident *forward* is a real need, and `id` remains
    the tiebreak so the order is total either way.

    `actor` is passed to the service, which sandboxes a non-admin to their own
    rows. No such caller exists today — see the service docstring — and that is
    precisely why the wiring should be here before one does.
    """
    rows, total, causer_names = activity_service.list_entries(
        db,
        log_name=log_name,
        event=event,
        subject_type=subject_type,
        subject_id=subject_id,
        causer_id=causer_id,
        source=source,
        search=search,
        date_from=date_from,
        date_to=date_to,
        hide_system=hide_system,
        actor=actor,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        per_page=per_page,
    )

    return PaginatedActivity(
        items=[
            ActivityEntry(
                id=row.id,
                log_name=row.log_name,
                module_label=activity_service.module_label(row.log_name),
                description=row.description,
                event=row.event,
                subject_type=row.subject_type,
                subject_id=row.subject_id,
                subject_url=activity_service.subject_url(row.subject_type, row.subject_id),
                causer_id=row.causer_id,
                causer_name=causer_names.get(row.causer_id) if row.causer_id else None,
                properties=row.properties,
                batch_uuid=row.batch_uuid,
                created_at=row.created_at,
            )
            for row in rows
        ],
        # `pages` was `max(1, ...)` here, which reported one page for an empty
        # trail and made the pager render "1 / 1" above no rows. `/users`
        # already returned 0 in that case and `DataTable.tsx` branches on
        # `pages === 0`, so 0 is the contract the frontend is written against;
        # this endpoint was the odd one. `page_meta` carries that fix forward.
        **page_meta(page, per_page, total),
    )


@router.get("/export")
def export_activity(
    log_name: str | None = Query(default=None),
    event: str | None = Query(default=None),
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(ACTIVITY_VIEW)),
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
            db,
            log_name=log_name,
            event=event,
            date_from=date_from,
            date_to=date_to,
            # Scoped like the list. Without this the export is the way around the
            # sandbox, and it hands over the whole file rather than one page.
            actor=actor,
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


@router.get("/filter-options", response_model=ActivityFilterOptions)
def list_filter_options(
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(ACTIVITY_VIEW)),
) -> ActivityFilterOptions:
    """Every dropdown on the index, in one call.

    Read from the data, not from a hardcoded list, so a module or subject type
    that has never actually been written does not clutter the filter — and one
    added by a future call site appears without anyone registering it. `sources`
    is the exception and is a constant: it is the set of *possible* origins, and
    it must include a value even before the first CLI row exists.

    Scoped by the reader, so the options can never describe rows they cannot see.
    """
    return ActivityFilterOptions.model_validate(
        {
            **activity_service.filter_options(db, actor=actor),
            "retention": activity_service.retention_status(db),
        }
    )


@router.get("/events", response_model=list[str])
def list_events(
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(ACTIVITY_VIEW)),
) -> list[str]:
    """Event names actually present in the trail, for the filter dropdown.

    Read from the data rather than a hardcoded list, so an event added by a future
    call site appears without anyone remembering to register it — and one that has
    never occurred does not clutter the filter.

    Superseded by `/filter-options`, which returns this list alongside the other
    four. Kept because it is the narrower question and something already asks it.
    """
    return activity_service.distinct_events(db, actor=actor)
