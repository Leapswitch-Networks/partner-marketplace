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
from sqlalchemy import Select, and_, func, select
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

#: Every status a listing can hold. Derived from the transition table rather than
#: retyped, so a new state cannot be added to one and forgotten in the other. The
#: table's keys are the states that can be *left*; `REJECTED` is both a key and a
#: target, and the union covers a terminal state if one is ever added.
_ALL_STATUSES: frozenset[str] = frozenset(_TRANSITIONS) | {
    target for targets in _TRANSITIONS.values() for target in targets
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
    # Captured before the loop below writes over it. `category_id` is a material
    # field, so an edit can move a listing between categories — and the recount
    # after the loop would then only ever see the *new* one.
    original_category_id = listing.category_id

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
        # ⚠️ **Flushed before counting, and it has to be.** `SessionLocal` is
        # `autoflush=False`, so the SELECT inside `recount_listings` would
        # otherwise read the row as it was before this function touched it —
        # still PUBLISHED, still in the old category — and store that count.
        #
        # This is also why the pre-2026-08-20 code appeared to work: it
        # recomputed only the *destination* category, which stale-read as "does
        # not contain this listing yet" and happened to be the right answer. The
        # origin was both unflushed and unvisited. Every other recount call site
        # in this module already flushes first.
        db.flush()
        # It leaves the public site immediately, so the category count is wrong
        # until recomputed. Doing it here rather than in the router means it
        # cannot be forgotten by the next caller.
        #
        # **Both categories, not just the current one.** Moving a published
        # listing from A to B leaves it counted in A for ever otherwise: the
        # recount ran against `listing.category_id`, which the loop above had
        # already changed to B. A `set` because the common case is that they are
        # the same category and one recount is enough. Fixed 2026-08-20.
        for category_id in {original_category_id, listing.category_id}:
            category_service.recount_listings(db, category_id)

    db.flush()
    return listing


def submit_for_review(db: Session, listing: ServiceListing) -> ServiceListing:
    """Send a listing to the review queue.

    Usually `DRAFT → PENDING_REVIEW`, where nothing public changes. But
    `PUBLISHED → PENDING_REVIEW` is a legal transition and is reachable from
    `POST /listings/{id}/submit`, and *that* takes the listing off the public
    site — so the category count has to be recomputed or it keeps counting a
    listing nobody can see. Missed until 2026-08-20, because the same rule was
    written into `update_listing` and not here.
    """
    was_published = listing.status == "PUBLISHED"
    _transition(listing, "PENDING_REVIEW")
    listing.submitted_at = datetime.now(timezone.utc)
    listing.rejection_reason = None
    db.flush()
    if was_published:
        category_service.recount_listings(db, listing.category_id)
    return listing


# --- Entitlement (PARTNER_DIRECTORY_PLAN.md § 14.1 row 2b) -------------------
#
# `partner_tiers.max_listings` and `featured_slots` have been columns that
# **nothing checked** since they were created — the plan says so in three places,
# and calls a tier "currently a label". This is the enforcement half of row 2b;
# `entitlement()` below is its read half.
#
# The rule, quoted from § 19.9: *"Publishing checks the tier: count of PUBLISHED
# listings must stay < tier.max_listings (NULL = unlimited)."*


def published_counts(db: Session, partner_ids: list[str]) -> dict[str, int]:
    """Published listings per partner, in one query rather than one per row.

    Soft-deleted rows are excluded: a deleted listing is not occupying a slot,
    and counting it would mean a partner who tidied up could not replace what
    they removed.

    Batched for the same reason `partner_service._user_counts` is — the
    moderation queue asks this about every row it shows, and a per-row count is
    the N+1 that only appears once the queue has a realistic length.
    """
    if not partner_ids:
        return {}
    rows = db.execute(
        select(ServiceListing.partner_id, func.count(ServiceListing.id))
        .where(
            ServiceListing.partner_id.in_(partner_ids),
            ServiceListing.status == "PUBLISHED",
            ServiceListing.deleted_at.is_(None),
        )
        .group_by(ServiceListing.partner_id)
    ).all()
    return {partner_id: count for partner_id, count in rows}


def published_count(db: Session, partner_id: str) -> int:
    """Live published listings for one partner. The single-row path."""
    return published_counts(db, [partner_id]).get(partner_id, 0)


def status_counts(db: Session, partner_id: str) -> dict[str, int]:
    """One partner's live listings grouped by status, in a single query.

    Written for the partner's own landing page, which used to fetch a page of
    listings and count them in the browser. That was wrong in a way that looked
    right: the page asked for `per_page=100` and reported `items.length` as the
    total, so a partner with 150 listings was told they had 100 — and the number
    it was reporting was already available as `total` in the page metadata it
    threw away.

    **Every status is present, including the ones with no rows.** A missing key
    reads as "no data" at the call site and a zero reads as "none of these",
    which is the honest answer and the one § 20.4 asks for. `.get(x, 0)` at every
    call site would work too, until one of them forgot.

    Soft-deleted rows are excluded, matching `published_counts`.
    """
    rows = db.execute(
        select(ServiceListing.status, func.count(ServiceListing.id))
        .where(
            ServiceListing.partner_id == partner_id,
            ServiceListing.deleted_at.is_(None),
        )
        .group_by(ServiceListing.status)
    ).all()
    counted = {status: count for status, count in rows}
    return {status: counted.get(status, 0) for status in _ALL_STATUSES}


def entitlement(
    db: Session, partner: Partner, *, published: int | None = None
) -> dict[str, object]:
    """What this partner has published against what their tier allows.

    The read half of § 14.1 row 2b — "usage vs allowance". Returned as a plain
    dict rather than a schema because three different callers want it at
    different shapes (a partner's own dashboard, the staff partner row, and the
    refusal message below), and none of them wants a new response model.

    **A partner with no tier is unlimited, deliberately.** `partners.tier_id` is
    nullable and — measured 2026-08-20 — *every* partner in this database has it
    NULL, so the alternative reading ("no tier means no entitlement") would have
    refused every publication in the system the moment this landed. A tier is a
    *commercial* entitlement; its absence means nobody has sold this partner a
    limit, not that their limit is zero. The same reasoning applies to a tier
    whose `max_listings` is NULL, which is the documented spelling of unlimited.

    Pass `published` when the caller has already counted — the moderation queue
    batches one count across every partner in the queue and would otherwise
    re-query per row.
    """
    tier = partner.tier
    allowance = tier.max_listings if tier is not None else None
    used = published_count(db, partner.id) if published is None else published

    return {
        "tier": tier.display_name if tier is not None else None,
        "published": used,
        "max_listings": allowance,
        "unlimited": allowance is None,
        "remaining": None if allowance is None else max(0, allowance - used),
        "at_limit": allowance is not None and used >= allowance,
    }


def publish_blockers(
    db: Session, listing: ServiceListing, *, published: int | None = None
) -> list[str]:
    """Every reason this listing may not be published, in plain English.

    A list rather than a first-failure raise so a reviewer is told everything at
    once. Being told "the partner is suspended", fixing it, and then being told
    "and they are at their listing limit" is two round trips for one decision.

    Empty means publishable. `assert_publishable` is the raising wrapper.
    """
    # Fetched by id: `ServiceListing` deliberately has no `partner`
    # relationship — see the note on the model about hiding a company being a
    # join rather than an update of thirty rows. `db.get` is identity-mapped, so
    # this is free once per session.
    partner = db.get(Partner, listing.partner_id)
    if partner is None:  # pragma: no cover - the FK makes this unreachable
        return ["The owning organisation no longer exists."]

    blockers: list[str] = []

    # § 19.9: "Publishing requires the owning partner to be status == ACTIVE and
    # is_listed == true." Both halves, for the reason `publicly_visible` gives.
    #
    # This is defence in depth rather than a live leak — every public read
    # already joins partner visibility, so a suspended partner's listings are
    # invisible whatever their status says. What it prevents is a PUBLISHED row
    # that is a lie about reality: `published_at` gets stamped, the listing
    # claims to be live, and nothing on screen explains why it is not.
    if partner.status != "ACTIVE":
        blockers.append(
            f"{partner.name} is {partner.status.lower()}, so its listings cannot be "
            "published. Reactivate the organisation first."
        )
    if not partner.is_listed:
        blockers.append(
            f"{partner.name} is not listed in the directory, so publishing this "
            "would have no public effect. List the organisation first."
        )

    # `listing.status != "PUBLISHED"` is for the *read* path, not for `approve`:
    # `_TRANSITIONS` has no PUBLISHED → PUBLISHED edge, so approve can never see
    # one. It matters when this function is called to explain why a listing is
    # blocked, where reporting "at their limit" about an already-live listing
    # would be describing a slot it is itself occupying.
    ent = entitlement(db, partner, published=published)
    if ent["at_limit"] and listing.status != "PUBLISHED":
        blockers.append(
            f"{partner.name} has {ent['published']} of {ent['max_listings']} "
            f"published listings allowed by the {ent['tier']} tier. Archive one, "
            "or move the organisation to a larger tier."
        )

    return blockers


def assert_publishable(db: Session, listing: ServiceListing) -> None:
    """Raise 409 unless every publishing rule holds.

    409 rather than 422: nothing about the *request* is malformed, and nothing
    the reviewer can retype would fix it. It is the state of the system that
    forbids the transition, which is what Conflict means.
    """
    blockers = publish_blockers(db, listing)
    if blockers:
        raise HTTPException(
            http_status.HTTP_409_CONFLICT,
            " ".join(blockers)
            if len(blockers) == 1
            else "This listing cannot be published yet: " + " ".join(blockers),
        )


def approve(db: Session, listing: ServiceListing, *, reviewer_id: str) -> ServiceListing:
    """Publish, if the partner and their tier allow it.

    The entitlement check runs **before** the transition, so a refusal leaves the
    listing in `PENDING_REVIEW` where the reviewer found it rather than in a
    half-moved state.

    ⚠️ **A partner at their limit can still fix a typo**, which is the case worth
    getting right because § 19.9 sends every edit of a published listing back
    through review. It works without a special case: editing moves the listing
    out of `PUBLISHED`, so it stops counting toward its own allowance while it
    sits in review, and re-approving puts it back in the slot it just vacated.
    The count does the work — there is no "is this a re-approval" branch to get
    wrong.
    """
    assert_publishable(db, listing)
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
