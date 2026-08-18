"""Service listings — authoring, and the moderation state machine.

## The state machine is the point of this module

```
DRAFT ──submit──► PENDING_REVIEW ──approve──► PUBLISHED
                        │                         │
                        └──reject──► REJECTED     └──edit──► PENDING_REVIEW
```

**Editing a PUBLISHED listing returns it to review.** Without that rule
moderation is theatre: a listing is approved once and then freely rewritten into
whatever the partner likes, and the reviewer's decision applies to text nobody
can see any more.

Every transition here is guarded by a permission the caller must already hold,
and no router may write `status` directly. That is why the mutators take an
actor and raise, rather than returning a boolean for a router to interpret.
"""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status as http_status
from sqlalchemy import Select, and_, select
from sqlalchemy.orm import Session, selectinload

from app.models.partner import Partner
from app.models.service_listing import ListingAttribute, ListingMedia, ServiceListing
from app.services import category_service, scoping

#: Which statuses each status may move to. A dict rather than a chain of `if`s so
#: the machine can be read in one place — and asserted by a test.
_TRANSITIONS: dict[str, frozenset[str]] = {
    "DRAFT": frozenset({"PENDING_REVIEW"}),
    "PENDING_REVIEW": frozenset({"PUBLISHED", "REJECTED", "DRAFT"}),
    "REJECTED": frozenset({"PENDING_REVIEW", "DRAFT"}),
    # PUBLISHED -> PENDING_REVIEW is the edit path; -> DRAFT is an unpublish.
    "PUBLISHED": frozenset({"PENDING_REVIEW", "DRAFT"}),
}

#: Fields whose change re-opens moderation. Editing a typo in an internal note
#: should not, but there are no internal notes on a listing — everything on it is
#: published, so everything on it is material.
_MATERIAL_FIELDS = frozenset(
    {"title", "summary", "description", "category_id", "pricing_model", "price", "currency"}
)


# ── Scoping — punchlist 1.8 ──────────────────────────────────────────────────
#
# Registered here rather than in `scoping.py` so the core module names no domain
# model; `tests/test_core_extraction.py` enforces that.
#
# The public predicate is what an anonymous visitor may see, and it is the
# narrowest thing in this file: PUBLISHED only, and not soft-deleted. A DRAFT or
# a PENDING_REVIEW listing is invisible to the public API by construction rather
# than by a filter somebody remembered to add at the call site.
scoping.register_scope(
    ServiceListing,
    owner_column=ServiceListing.partner_id,
    public_predicate=and_(
        ServiceListing.status == "PUBLISHED",
        ServiceListing.deleted_at.is_(None),
    ),
)


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.strip().lower()).strip("-")
    return slug or "listing"


def base_query() -> Select:
    """Listings with their partner and category, never N+1."""
    return select(ServiceListing).options(
        selectinload(ServiceListing.category),
        selectinload(ServiceListing.media),
        selectinload(ServiceListing.attributes),
    )


def get_or_404(db: Session, listing_id: str) -> ServiceListing:
    listing = db.get(ServiceListing, listing_id)
    if listing is None or listing.deleted_at is not None:
        raise HTTPException(http_status.HTTP_404_NOT_FOUND, "Listing not found")
    return listing


def get_public_by_slug(db: Session, slug: str) -> ServiceListing | None:
    """A published listing by slug, for the public surface.

    Applies the same predicate as the registered scope rather than trusting the
    caller to remember it. A listing whose partner is unlisted or suspended is
    also invisible — the partner join is not optional.
    """
    stmt = (
        base_query()
        .join(Partner, Partner.id == ServiceListing.partner_id)
        .where(
            ServiceListing.slug == slug,
            ServiceListing.status == "PUBLISHED",
            ServiceListing.deleted_at.is_(None),
            Partner.is_listed.is_(True),
            Partner.status == "ACTIVE",
        )
    )
    return db.execute(stmt).unique().scalar_one_or_none()


def create_listing(
    db: Session,
    *,
    partner_id: str,
    title: str,
    summary: str,
    category_id: int,
    description: str | None = None,
    pricing_model: str = "ON_REQUEST",
    price: float | None = None,
    currency: str = "INR",
    created_by: str | None = None,
) -> ServiceListing:
    """Create a listing. **Always DRAFT** — nothing publishes on creation."""
    category_service.get_or_404(db, category_id)
    _validate_price(pricing_model, price)

    listing = ServiceListing(
        id=str(uuid.uuid4()),
        partner_id=partner_id,
        category_id=category_id,
        title=title.strip(),
        slug=_unique_slug(db, slugify(title)),
        summary=summary.strip(),
        description=description,
        pricing_model=pricing_model,
        price=price,
        currency=currency,
        status="DRAFT",
        created_by=created_by,
    )
    db.add(listing)
    db.flush()
    return listing


def update_listing(db: Session, listing: ServiceListing, **fields) -> ServiceListing:
    """Update a listing, returning it to review if the change is material.

    **This is the rule that makes moderation mean anything.** The check compares
    old and new values rather than trusting that a PATCH body implies a change —
    a form that resubmits every field unchanged would otherwise send a published
    listing back to the queue every time somebody opened and saved it.
    """
    changed_material = False
    for field, value in fields.items():
        if value is None or not hasattr(listing, field):
            continue
        if getattr(listing, field) != value:
            if field in _MATERIAL_FIELDS:
                changed_material = True
            setattr(listing, field, value)

    _validate_price(listing.pricing_model, listing.price)

    if changed_material and listing.status == "PUBLISHED":
        listing.status = "PENDING_REVIEW"
        listing.submitted_at = datetime.now(timezone.utc)
        # It leaves the public site immediately, so the category count is wrong
        # until recomputed. Doing it here rather than in the router means it
        # cannot be forgotten by the next caller.
        category_service.recount_listings(db, listing.category_id)

    db.flush()
    return listing


def submit_for_review(db: Session, listing: ServiceListing) -> ServiceListing:
    _transition(listing, "PENDING_REVIEW")
    listing.submitted_at = datetime.now(timezone.utc)
    listing.rejection_reason = None
    db.flush()
    return listing


def approve(db: Session, listing: ServiceListing, *, reviewer_id: str) -> ServiceListing:
    _transition(listing, "PUBLISHED")
    now = datetime.now(timezone.utc)
    listing.reviewed_at = now
    listing.reviewed_by = reviewer_id
    listing.rejection_reason = None
    # Set once. An edit-and-reapprove keeps the original publication date, which
    # is what "recently added" and the sitemap's lastmod should both reflect.
    if listing.published_at is None:
        listing.published_at = now
    db.flush()
    category_service.recount_listings(db, listing.category_id)
    return listing


def reject(db: Session, listing: ServiceListing, *, reviewer_id: str, reason: str) -> ServiceListing:
    """Reject with a reason. **The reason is required, not optional.**

    § 20.6.1 puts it prominently on the partner's own view. A queue that rejects
    silently produces a resubmission loop costing the moderator more than writing
    one sentence would have.
    """
    if not reason or not reason.strip():
        raise HTTPException(
            http_status.HTTP_422_UNPROCESSABLE_ENTITY,
            "A rejection needs a reason — the partner has to know what to fix.",
        )
    _transition(listing, "REJECTED")
    listing.reviewed_at = datetime.now(timezone.utc)
    listing.reviewed_by = reviewer_id
    listing.rejection_reason = reason.strip()
    db.flush()
    category_service.recount_listings(db, listing.category_id)
    return listing


def unpublish(db: Session, listing: ServiceListing) -> ServiceListing:
    _transition(listing, "DRAFT")
    db.flush()
    category_service.recount_listings(db, listing.category_id)
    return listing


def soft_delete(db: Session, listing: ServiceListing) -> None:
    listing.deleted_at = datetime.now(timezone.utc)
    db.flush()
    category_service.recount_listings(db, listing.category_id)


def pending_queue(db: Session) -> list[ServiceListing]:
    """The moderation queue, oldest first.

    **Oldest first is not a display preference.** § 16.2 measures the age of the
    oldest item in the queue, and a newest-first queue is how the oldest item
    becomes permanently invisible to the person working it.
    """
    stmt = (
        base_query()
        .where(ServiceListing.status == "PENDING_REVIEW", ServiceListing.deleted_at.is_(None))
        .order_by(ServiceListing.submitted_at.asc().nulls_last())
    )
    return list(db.execute(stmt).unique().scalars().all())


def add_media(db: Session, listing: ServiceListing, *, path: str, alt_text: str | None = None,
              width: int | None = None, height: int | None = None) -> ListingMedia:
    media = ListingMedia(
        id=str(uuid.uuid4()),
        listing_id=listing.id,
        path=path,
        alt_text=alt_text,
        width=width,
        height=height,
        sort_order=len(listing.media),
    )
    db.add(media)
    db.flush()
    return media


def set_attributes(db: Session, listing: ServiceListing, pairs: list[tuple[str, str]]) -> None:
    """Replace the spec table wholesale.

    Replacing rather than diffing because the form submits the whole table and a
    diff would need stable ids the UI does not carry. The rows are cheap.
    """
    for existing in list(listing.attributes):
        db.delete(existing)
    db.flush()
    for index, (label, value) in enumerate(pairs):
        db.add(
            ListingAttribute(
                id=str(uuid.uuid4()),
                listing_id=listing.id,
                label=label,
                value=value,
                sort_order=index,
            )
        )
    db.flush()


def _transition(listing: ServiceListing, target: str) -> None:
    allowed = _TRANSITIONS.get(listing.status, frozenset())
    if target not in allowed:
        raise HTTPException(
            http_status.HTTP_409_CONFLICT,
            f"A {listing.status} listing cannot become {target}. "
            f"Allowed from here: {', '.join(sorted(allowed)) or 'nothing'}.",
        )
    listing.status = target


def _validate_price(pricing_model: str, price: float | None) -> None:
    """§ 20.2 rule 9, enforced where it cannot be forgotten.

    *Never render a price we do not have.* A FIXED or FROM listing without a
    number would render as an empty price block, which a reader interprets as a
    bug rather than as "ask us".
    """
    if pricing_model in ("FIXED", "FROM") and price is None:
        raise HTTPException(
            http_status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"A {pricing_model} price needs a number. Use ON_REQUEST if there is no fixed price.",
        )


def _unique_slug(db: Session, base: str) -> str:
    slug, suffix = base, 2
    while db.execute(
        select(ServiceListing.id).where(ServiceListing.slug == slug)
    ).scalar_one_or_none() is not None:
        slug = f"{base}-{suffix}"
        suffix += 1
    return slug
