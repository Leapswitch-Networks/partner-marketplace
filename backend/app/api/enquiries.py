"""Enquiry endpoints — one tree, scoped, for partners and staff.

## The asymmetry that matters

Staff hold `ENQUIRY_VIEW` and **never** `ENQUIRY_RESPOND`. § 20.6.1: staff may
read a thread to measure whether it was answered, and may never answer it as the
partner — a buyer would have no way to know who they were talking to, and the
response-time number would measure us rather than them.

That is enforced by the permission grant in `domain/partners/permissions.py`, not
by a check here. The reply route simply requires a permission staff do not have.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_permission
from app.core.query import page_meta
from app.domain.partners.permissions import ENQUIRY_RESPOND, ENQUIRY_VIEW
from app.models.enquiry import Enquiry
from app.models.partner import Partner
from app.models.user import User
from app.schemas.common import Page
from app.schemas.directory import (
    EnquiryDetailResponse,
    EnquiryListItem,
    EnquiryMessageResponse,
    ReplyEnquiryRequest,
    UpdateEnquiryStatusRequest,
)
from app.services import enquiry_service, scoping

router = APIRouter(prefix="/enquiries", tags=["enquiries"])


def _detail(enquiry: Enquiry) -> EnquiryDetailResponse:
    """The detail shape, with the lifecycle attached.

    One helper rather than two call sites setting the field, because a route that
    forgot it would silently return an empty list — and an empty list is
    indistinguishable from "this enquiry is finished and can go nowhere", so the
    dropdown would simply have no options and nothing would look wrong.
    """
    response = EnquiryDetailResponse.model_validate(enquiry)
    response.allowed_transitions = sorted(enquiry_service.allowed_transitions(enquiry.status))
    return response


def _visible_or_404(db: Session, enquiry_id: str, actor: User) -> Enquiry:
    stmt = scoping.apply_scope(
        enquiry_service.base_query().where(Enquiry.id == enquiry_id), Enquiry, actor
    )
    enquiry = db.execute(stmt).unique().scalar_one_or_none()
    if enquiry is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Enquiry not found")
    return enquiry


@router.get("", response_model=Page[EnquiryListItem])
def list_enquiries(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    status_filter: str | None = Query(None, alias="status"),
    unanswered: bool = False,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(ENQUIRY_VIEW)),
) -> Page[EnquiryListItem]:
    stmt = enquiry_service.base_query()
    if status_filter:
        stmt = stmt.where(Enquiry.status == status_filter)
    if unanswered:
        stmt = stmt.where(Enquiry.first_responded_at.is_(None))
    stmt = scoping.apply_scope(stmt, Enquiry, actor)

    total = db.execute(
        select(func.count()).select_from(stmt.order_by(None).subquery())
    ).scalar_one()
    rows = db.execute(
        stmt.order_by(Enquiry.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    ).unique().scalars().all()

    # One query for the whole page, not one per row. Same reasoning as the
    # moderation queue: an inbox of 25 enquiries across 6 partners costs one extra
    # query rather than 25. Attached to the row before validation — see
    # FASTAPI_STANDARDS § 5 and TECH_DEBT PM-48 for why that ordering matters.
    names = dict(
        db.execute(
            select(Partner.id, Partner.name).where(
                Partner.id.in_({r.partner_id for r in rows})
            )
        ).all()
    ) if rows else {}
    for row in rows:
        row.partner_name = names.get(row.partner_id, "Unknown organisation")

    return Page[EnquiryListItem](
        items=[EnquiryListItem.model_validate(r) for r in rows],
        **page_meta(page, per_page, total),
    )


@router.get("/{enquiry_id}", response_model=EnquiryDetailResponse)
def get_enquiry(
    enquiry_id: str,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(ENQUIRY_VIEW)),
) -> EnquiryDetailResponse:
    """One enquiry, and — for its recipient — the moment they first opened it.

    Opening is what records `first_viewed_at`, because there is no other honest
    moment to record it: a partner has "seen" an enquiry when they have looked at
    it, not when it arrived or when a list rendered its subject line.

    **A staff read never stamps.** Staff hold `enquiry-view` for oversight, and
    the rule lives in `mark_viewed` rather than here so that every future caller
    inherits it instead of re-deciding it. See TECH_DEBT PM-47.
    """
    enquiry = _visible_or_404(db, enquiry_id, actor)
    if enquiry_service.mark_viewed(db, enquiry, actor):
        db.commit()
    return _detail(enquiry)


@router.post("/{enquiry_id}/reply", response_model=EnquiryMessageResponse)
def reply_to_enquiry(
    enquiry_id: str,
    payload: ReplyEnquiryRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(ENQUIRY_RESPOND)),
) -> EnquiryMessageResponse:
    """Reply on-platform.

    **This is the only place response time gets recorded**, which is why the
    thread exists at all — a partner answering from their own mail client leaves
    the enquiry at NEW forever and § 16's one number reads zero while the product
    works fine.
    """
    enquiry = _visible_or_404(db, enquiry_id, actor)
    message = enquiry_service.reply(db, enquiry, author_user_id=actor.id, body=payload.body)
    db.commit()
    return EnquiryMessageResponse.model_validate(message)


@router.patch("/{enquiry_id}/status", response_model=EnquiryDetailResponse)
def update_enquiry_status(
    enquiry_id: str,
    payload: UpdateEnquiryStatusRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(ENQUIRY_RESPOND)),
) -> EnquiryDetailResponse:
    enquiry = _visible_or_404(db, enquiry_id, actor)
    enquiry_service.set_status(db, enquiry, payload.status)
    db.commit()
    return _detail(enquiry)
