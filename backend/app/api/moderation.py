"""The moderation queue — staff only.

Separate from `listings.py` because the permissions are different in kind, not
degree: `LISTING_UPDATE` edits words, `LISTING_PUBLISH` decides what the
anonymous internet sees. Partners hold the first and never the second.

**There is no bulk-approve endpoint and there must not be one.** § 20.6.3: the
whole value of a curated directory is that somebody looked at each one. A bulk
action is how a queue that is meant to be read becomes a queue that is cleared.
"""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_permission
from app.domain.partners.permissions import LISTING_PUBLISH, MODERATION_REVIEW
from app.models.partner import Partner
from app.models.user import User
from app.schemas.directory import (
    ListingDetailResponse,
    ModerationQueueItem,
    RejectListingRequest,
)
from app.services import listing_service

router = APIRouter(prefix="/moderation", tags=["moderation"])


@router.get("/queue", response_model=list[ModerationQueueItem])
def review_queue(
    db: Session = Depends(get_db),
    _: User = Depends(require_permission(MODERATION_REVIEW)),
) -> list[ModerationQueueItem]:
    """Everything awaiting review, **oldest first**, each with its blockers.

    Oldest-first is not a display preference: § 16.2 measures the age of the
    oldest item in the queue, and a newest-first list is how the oldest item
    becomes permanently invisible to the person working it.

    ## Why each row carries its blockers

    Approving is refused when the owning partner is suspended, unlisted, or at
    its tier's listing allowance. Computing that here means the reviewer sees it
    before opening the listing rather than after clicking Approve — the same
    reasoning that keeps a permission-gated action off screen instead of letting
    it 403.

    ## The two queries this deliberately does not multiply

    Partners are fetched once for the whole queue and published counts are
    batched into a single grouped query, so a queue of thirty listings across
    five partners costs two extra queries rather than sixty. Both `entitlement`
    and `publish_blockers` accept a pre-counted value for exactly this.
    """
    listings = listing_service.pending_queue(db)
    if not listings:
        return []

    partner_ids = list({listing.partner_id for listing in listings})
    partners = {
        partner.id: partner
        for partner in db.scalars(select(Partner).where(Partner.id.in_(partner_ids))).all()
    }
    counts = listing_service.published_counts(db, partner_ids)

    items: list[ModerationQueueItem] = []
    for listing in listings:
        partner = partners.get(listing.partner_id)
        published = counts.get(listing.partner_id, 0)

        # ⚠️ **Assigned onto the row BEFORE validating, not onto the model after.**
        #
        # This route returned a **500 for every non-empty queue** between
        # 2026-08-20 and 2026-08-21. `partner_name` and `entitlement` are required
        # on `ModerationQueueItem` and are not columns, so
        # `model_validate(listing)` failed with two `missing` errors — and the
        # assignments that would have supplied them ran afterwards, which is too
        # late. The empty-queue early return above meant the only queue anyone had
        # seen was an empty one, so the page looked merely idle.
        #
        # Same shape as `partner_service.decorate`, which attaches its per-row
        # flags to the ORM instance and then validates. One pattern, not two.
        listing.partner_name = partner.name if partner is not None else "Unknown organisation"
        listing.blockers = listing_service.publish_blockers(db, listing, published=published)
        listing.entitlement = (
            listing_service.entitlement(db, partner, published=published)
            if partner is not None
            # Unreachable while the FK holds; a partnerless listing is not a
            # crash, it is a blocker reported above.
            else {
                "tier": None,
                "published": 0,
                "max_listings": None,
                "unlimited": True,
                "remaining": None,
                "at_limit": False,
            }
        )
        items.append(ModerationQueueItem.model_validate(listing))

    return items


@router.post("/listings/{listing_id}/approve", response_model=ListingDetailResponse)
def approve_listing(
    listing_id: str,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(LISTING_PUBLISH)),
) -> ListingDetailResponse:
    """Publish. **Not scoped** — a reviewer is not a tenant, and the queue is the
    whole point of the role."""
    listing = listing_service.get_or_404(db, listing_id)
    listing_service.approve(db, listing, reviewer_id=actor.id)
    db.commit()
    return ListingDetailResponse.model_validate(listing)


@router.post("/listings/{listing_id}/reject", response_model=ListingDetailResponse)
def reject_listing(
    listing_id: str,
    payload: RejectListingRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(LISTING_PUBLISH)),
) -> ListingDetailResponse:
    listing = listing_service.get_or_404(db, listing_id)
    listing_service.reject(db, listing, reviewer_id=actor.id, reason=payload.reason)
    db.commit()
    return ListingDetailResponse.model_validate(listing)


@router.post("/listings/{listing_id}/unpublish", response_model=ListingDetailResponse)
def unpublish_listing(
    listing_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission(LISTING_PUBLISH)),
) -> ListingDetailResponse:
    """Take a published listing back off the site without deleting it."""
    listing = listing_service.get_or_404(db, listing_id)
    listing_service.unpublish(db, listing)
    db.commit()
    return ListingDetailResponse.model_validate(listing)
