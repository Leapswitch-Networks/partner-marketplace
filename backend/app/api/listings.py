"""Service listing endpoints — **one tree, scoped**, for partners and staff both.

`PARTNER_DIRECTORY_PLAN.md` § 20.6.0 ①: there is no `/partner/listings` and no
`/admin/listings`. The same routes serve both and `apply_scope` decides what is
in them — a partner sees their own, a staff member with admin access sees every
one.

## 404, never 403

A partner asking for another partner's listing gets **not found**. A 403 confirms
the row exists, which is a disclosure in itself — § 3.1 of the scoping design
makes this absolute, and every getter below routes through the scoped query
rather than `db.get`.

## Publication is not here

Approving and rejecting live in `moderation.py` behind `LISTING_PUBLISH`, which
partners do not hold. Authoring and approving are the two halves of moderation
and a partner holding both would make the queue decorative.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_permission
from app.core.query import page_meta
from app.domain.partners.permissions import (
    LISTING_CREATE,
    LISTING_DELETE,
    LISTING_UPDATE,
    LISTING_VIEW,
)
from app.models.service_listing import ServiceListing
from app.models.user import User
from app.schemas.common import Page
from app.schemas.directory import (
    CreateListingRequest,
    ListingDetailResponse,
    ListingListItem,
    UpdateListingRequest,
)
from app.services import listing_service, scoping

router = APIRouter(prefix="/listings", tags=["listings"])


def _visible_or_404(db: Session, listing_id: str, actor: User) -> ServiceListing:
    """The one getter. **Scoped, so a wrong-tenant id is indistinguishable from
    a nonexistent one.**"""
    stmt = scoping.apply_scope(
        listing_service.base_query().where(
            ServiceListing.id == listing_id, ServiceListing.deleted_at.is_(None)
        ),
        ServiceListing,
        actor,
    )
    listing = db.execute(stmt).unique().scalar_one_or_none()
    if listing is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Listing not found")
    return listing


@router.get("", response_model=Page[ListingListItem])
def list_listings(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    status_filter: str | None = Query(None, alias="status"),
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(LISTING_VIEW)),
) -> Page[ListingListItem]:
    stmt = listing_service.base_query().where(ServiceListing.deleted_at.is_(None))
    if status_filter:
        stmt = stmt.where(ServiceListing.status == status_filter)
    stmt = scoping.apply_scope(stmt, ServiceListing, actor)

    total = db.execute(
        select(func.count()).select_from(stmt.order_by(None).subquery())
    ).scalar_one()
    rows = db.execute(
        stmt.order_by(ServiceListing.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    ).unique().scalars().all()

    return Page[ListingListItem](
        items=[ListingListItem.model_validate(r) for r in rows],
        **page_meta(page, per_page, total),
    )


@router.post("", response_model=ListingDetailResponse, status_code=status.HTTP_201_CREATED)
def create_listing(
    payload: CreateListingRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(LISTING_CREATE)),
) -> ListingDetailResponse:
    """Create a listing for the caller's own organisation.

    ⚠️ **`partner_id` comes from the actor, never from the request body.** That
    is the same rule the invitation flow follows, and for the same reason: a
    partner id in a payload is an invitation to create a listing under somebody
    else's name.
    """
    if actor.organisation_id is None:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Your account is not attached to an organisation, so it has nothing to list under.",
        )
    listing = listing_service.create_listing(
        db,
        partner_id=actor.organisation_id,
        title=payload.title,
        summary=payload.summary,
        category_id=payload.category_id,
        description=payload.description,
        pricing_model=payload.pricing_model,
        price=float(payload.price) if payload.price is not None else None,
        currency=payload.currency,
        created_by=actor.id,
    )
    db.commit()
    return ListingDetailResponse.model_validate(listing)


@router.get("/{listing_id}", response_model=ListingDetailResponse)
def get_listing(
    listing_id: str,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(LISTING_VIEW)),
) -> ListingDetailResponse:
    return ListingDetailResponse.model_validate(_visible_or_404(db, listing_id, actor))


@router.patch("/{listing_id}", response_model=ListingDetailResponse)
def update_listing(
    listing_id: str,
    payload: UpdateListingRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(LISTING_UPDATE)),
) -> ListingDetailResponse:
    listing = _visible_or_404(db, listing_id, actor)
    listing_service.update_listing(
        db,
        listing,
        **{k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None},
    )
    db.commit()
    return ListingDetailResponse.model_validate(listing)


@router.post("/{listing_id}/submit", response_model=ListingDetailResponse)
def submit_listing(
    listing_id: str,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(LISTING_UPDATE)),
) -> ListingDetailResponse:
    """Send a draft to the moderation queue. The partner's own action."""
    listing = _visible_or_404(db, listing_id, actor)
    listing_service.submit_for_review(db, listing)
    db.commit()
    return ListingDetailResponse.model_validate(listing)


@router.delete("/{listing_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_listing(
    listing_id: str,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(LISTING_DELETE)),
) -> None:
    listing = _visible_or_404(db, listing_id, actor)
    listing_service.soft_delete(db, listing)
    db.commit()
