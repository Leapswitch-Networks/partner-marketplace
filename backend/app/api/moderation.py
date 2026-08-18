"""The moderation queue — staff only.

Separate from `listings.py` because the permissions are different in kind, not
degree: `LISTING_UPDATE` edits words, `LISTING_PUBLISH` decides what the
anonymous internet sees. Partners hold the first and never the second.

**There is no bulk-approve endpoint and there must not be one.** § 20.6.3: the
whole value of a curated directory is that somebody looked at each one. A bulk
action is how a queue that is meant to be read becomes a queue that is cleared.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_permission
from app.domain.partners.permissions import LISTING_PUBLISH, MODERATION_REVIEW
from app.models.user import User
from app.schemas.directory import ListingDetailResponse, RejectListingRequest
from app.services import listing_service

router = APIRouter(prefix="/moderation", tags=["moderation"])


@router.get("/queue", response_model=list[ListingDetailResponse])
def review_queue(
    db: Session = Depends(get_db),
    _: User = Depends(require_permission(MODERATION_REVIEW)),
) -> list[ListingDetailResponse]:
    """Everything awaiting review, **oldest first**.

    Oldest-first is not a display preference: § 16.2 measures the age of the
    oldest item in the queue, and a newest-first list is how the oldest item
    becomes permanently invisible to the person working it.
    """
    return [
        ListingDetailResponse.model_validate(listing)
        for listing in listing_service.pending_queue(db)
    ]


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
