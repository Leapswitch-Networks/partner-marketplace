"""Error Tracking — read and triage recorded application errors (Module 17).

Port of `ErrorTrackingController`.

**One route the reference has is deliberately absent: `createBugReport`.** Theirs
opens a FeedbackHub item from an error group; FeedbackHub is one of their plugin
modules and we have nothing equivalent, so building the button would produce a
control that posts nowhere. Registered rather than silently dropped — see
`LEAPDESK_PARITY_PLAN.md` § Module 17.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_permission
from app.core.permissions import ERROR_MANAGE, ERROR_VIEW
from app.models.error_group import ERROR_STATUSES
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.schemas.error_tracking import (
    ErrorGroupDetailResponse,
    ErrorGroupResponse,
    ErrorOccurrenceResponse,
    UpdateErrorStatusRequest,
)
from app.core.query import page_count
from app.schemas.common import Page
from app.services import error_service

router = APIRouter(prefix="/errors", tags=["errors"])


@router.get("", response_model=Page[ErrorGroupResponse])
def list_errors(
    search: str | None = Query(default=None),
    status: str | None = Query(default=None, description=f"One of {', '.join(ERROR_STATUSES)}"),
    module: str | None = Query(default=None),
    sort_by: str | None = Query(default=None),
    sort_order: str = Query(default="desc"),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=25, ge=1, le=100),
    db: Session = Depends(get_db),
    _actor: User = Depends(require_permission(ERROR_VIEW)),
) -> Page[ErrorGroupResponse]:
    """Distinct errors, newest sighting first.

    Sorted by `last_seen_at` rather than `occurrence_count`, deliberately: the
    question this page answers is *"is something broken right now"*, and an old
    error with a huge count would otherwise sit permanently at the top pushing
    today's regression off the first screen.
    """
    rows, total = error_service.list_groups(
        db,
        search=search,
        status_filter=status,
        module=module,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        per_page=per_page,
    )
    return Page[ErrorGroupResponse](
        items=[ErrorGroupResponse.model_validate(r) for r in rows],
        total=total,
        page=page,
        per_page=per_page,
        pages=page_count(total, per_page),
    )


@router.get("/counts", response_model=dict[str, int])
def error_counts(
    db: Session = Depends(get_db),
    _actor: User = Depends(require_permission(ERROR_VIEW)),
) -> dict[str, int]:
    """`{status: count}` for the summary cards.

    Declared **before** `/{group_id}` — `counts` would otherwise be parsed as an
    id and answer 422. FastAPI matches in declaration order, so this is ordering,
    not preference.
    """
    return error_service.status_counts(db)


@router.get("/{group_id}", response_model=ErrorGroupDetailResponse)
def get_error(
    group_id: int,
    db: Session = Depends(get_db),
    _actor: User = Depends(require_permission(ERROR_VIEW)),
) -> ErrorGroupDetailResponse:
    """One error group plus its most recent sightings."""
    group = error_service.get_group_or_404(db, group_id)
    occurrences = error_service.recent_occurrences(db, group_id)
    return ErrorGroupDetailResponse(
        **ErrorGroupResponse.model_validate(group).model_dump(),
        occurrences=[ErrorOccurrenceResponse.model_validate(o) for o in occurrences],
        # The group's own counter, not `len(occurrences)`: the list is capped, and
        # sending its length would report the cap as the total.
        occurrence_total=group.occurrence_count,
    )


@router.patch("/{group_id}/status", response_model=ErrorGroupResponse)
def update_error_status(
    group_id: int,
    payload: UpdateErrorStatusRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(ERROR_MANAGE)),
) -> ErrorGroupResponse:
    """Triage: open / resolved / ignored / muted, with optional notes."""
    group = error_service.get_group_or_404(db, group_id)
    updated = error_service.set_status(db, group, payload.status, actor, payload.notes)
    return ErrorGroupResponse.model_validate(updated)


@router.delete("/{group_id}", response_model=MessageResponse)
def delete_error(
    group_id: int,
    db: Session = Depends(get_db),
    _actor: User = Depends(require_permission(ERROR_MANAGE)),
) -> MessageResponse:
    """Delete a group and every sighting of it.

    `error-manage`, not `error-view`: **this destroys the evidence of a bug.**
    Resolving is the normal way to make an error stop appearing; deleting is for
    a group that should never have been recorded.
    """
    group = error_service.get_group_or_404(db, group_id)
    error_service.delete_group(db, group)
    return MessageResponse(message="Error deleted.")
