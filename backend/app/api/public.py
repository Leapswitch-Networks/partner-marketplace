"""The public, unauthenticated read surface — and the one public write.

## This file is the confidentiality boundary

Two rules govern every response here, and neither is enforced by a comment:

1. **§ 17.3's allowlist.** No `notes`, `gst_number`, `pan_number` or `status`.
2. **§ 0.1's confidentiality rule.** Nothing may reveal that partners source
   anything from us.

Both are enforced by the response models in `schemas/directory.py`, which simply
do not have those fields. A router returning `PublicPartnerDetail` cannot leak an
internal column even if the ORM object it was built from carries one — that is
the difference between a rule somebody has to remember and a guarantee.

## Nothing here takes an actor

Every other router in this application resolves a `User`. These resolve nobody,
which is why the visibility predicates are written into the queries explicitly
rather than delegated to `apply_scope`: there is no principal to scope against,
and a route that *forgot* to filter would serve everything. The filters are the
first thing in every statement below for that reason.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.dependencies import get_db
from app.core.query import page_meta
from app.models.partner import Partner
from app.models.service_category import ServiceCategory
from app.models.service_listing import ServiceListing
from app.schemas.common import Page
from app.schemas.directory import (
    CreateEnquiryRequest,
    EnquiryCreatedResponse,
    PublicCategory,
    PublicEnquiryStatus,
    PublicListing,
    PublicListingWithPartner,
    PublicPartnerDetail,
    PublicPartnerSummary,
)
from app.services import category_service, enquiry_service, listing_service, partner_service

router = APIRouter(prefix="/public", tags=["public"])

#: A partner an anonymous visitor may see. Repeated as a constant rather than
#: inlined so the two conditions cannot drift apart between routes — a listed but
#: suspended partner appearing on one page and not another is the kind of bug
#: that survives review.
_VISIBLE_PARTNER = (Partner.is_listed.is_(True), Partner.status == "ACTIVE")


def _partner_summary(partner) -> PublicPartnerSummary:
    """A partner summary with the brand-asset flags filled in.

    `model_validate` cannot derive them: they are "are these bytes present",
    which is a question about two columns the response deliberately does not
    carry. Computed in one place so a route cannot forget and silently render
    initials for a partner who uploaded a logo.
    """
    summary = PublicPartnerSummary.model_validate(partner)
    summary.has_logo = bool(partner.logo_bytes and partner.logo_mime)
    summary.has_banner = bool(partner.banner_bytes and partner.banner_mime)
    return summary


def _listing_with_partner(listing, partner) -> PublicListingWithPartner:
    """Build the composite response.

    ⚠️ **Not `model_validate(listing)` followed by assigning `.partner`.** That
    was the original shape and it 500s: `partner` is a required field, so
    validation fails before the assignment ever runs. Pydantic validates the
    whole model at construction — a required field cannot be filled in
    afterwards.

    Building the nested model explicitly also makes the allowlist visible at the
    point it is applied: what a public listing carries about its partner is the
    *summary* schema, never the detail one.
    """
    return PublicListingWithPartner(
        **PublicListing.model_validate(listing).model_dump(),
        partner=_partner_summary(partner),
    )


@router.get("/categories", response_model=list[PublicCategory])
def public_categories(db: Session = Depends(get_db)) -> list[PublicCategory]:
    """The taxonomy, as a two-level tree.

    **Only categories with something in them.** § 8's threshold governs whether
    a category earns a page at all; an empty category on the public map is a
    promise the directory cannot keep.
    """
    rows = category_service.list_categories(db)
    by_parent: dict[int | None, list[ServiceCategory]] = {}
    for row in rows:
        by_parent.setdefault(row.parent_id, []).append(row)

    def build(node: ServiceCategory) -> PublicCategory:
        children = [build(c) for c in by_parent.get(node.id, []) if c.listing_count > 0]
        return PublicCategory(
            name=node.name,
            slug=node.slug,
            description=node.description,
            icon=node.icon,
            # ⚠️ **A parent's count is the roll-up of its children, not its own
            # column.** Listings attach to leaf categories, so every parent's
            # stored `listing_count` is 0 — and filtering parents on that hid the
            # entire taxonomy from the public surface while the data was
            # perfectly fine. Found 2026-08-18 when the directory's filter
            # rendered empty against twelve published listings.
            listing_count=node.listing_count + sum(c.listing_count for c in children),
            children=children,
        )

    # A parent earns its place if it, or anything under it, has listings. Same
    # rule, applied after the roll-up rather than before it.
    return [
        built
        for built in (build(n) for n in by_parent.get(None, []))
        if built.listing_count > 0
    ]


@router.get("/partners", response_model=Page[PublicPartnerSummary])
def public_partners(
    page: int = Query(1, ge=1),
    per_page: int = Query(24, ge=1, le=60),
    expertise: str | None = Query(None, description="Category slug"),
    city: str | None = None,
    q: str | None = None,
    db: Session = Depends(get_db),
) -> Page[PublicPartnerSummary]:
    """The directory index, with the filter the whole loop depends on.

    Filtering is a **join on the expertise pivot**, not a text match: that is why
    the taxonomy is Leapswitch's and why a partner picks from it rather than
    typing. A LIKE over free text would find "Kubernetes" and miss "kubernetes
    & containers".
    """
    stmt = select(Partner).where(*_VISIBLE_PARTNER).options(selectinload(Partner.expertise))

    if expertise:
        category = category_service.get_by_slug(db, expertise)
        if category is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown expertise")
        # ⚠️ **Filtering on a parent must include its children.**
        #
        # Partners attach expertise to leaf categories — nobody selects "Cloud &
        # infrastructure", they select "Managed Kubernetes". Matching the parent
        # id exactly therefore returned nothing for every top-level filter, while
        # the chips rendered perfectly and the data was fine. Found 2026-08-18 by
        # walking the loop end to end; it is invisible to any test that only
        # filters on a leaf.
        wanted = [category.id] + [child.id for child in category.children]
        stmt = stmt.where(Partner.expertise.any(ServiceCategory.id.in_(wanted)))
    if city:
        stmt = stmt.where(func.lower(Partner.city) == city.lower())
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(
            or_(func.lower(Partner.name).like(like), func.lower(Partner.tagline).like(like))
        )

    total = db.execute(
        select(func.count()).select_from(stmt.order_by(None).subquery())
    ).scalar_one()
    rows = db.execute(
        stmt.order_by(
            # § 9's rule: verification first, always. Nothing a partner pays for
            # can move them above a partner we checked more thoroughly.
            Partner.verification_level.desc(),
            Partner.name.asc(),
        )
        .offset((page - 1) * per_page)
        .limit(per_page)
    ).unique().scalars().all()

    return Page[PublicPartnerSummary](
        items=[_partner_summary(r) for r in rows],
        **page_meta(page, per_page, total),
    )


@router.get("/partners/{slug}", response_model=PublicPartnerDetail)
def public_partner(slug: str, db: Session = Depends(get_db)) -> PublicPartnerDetail:
    partner = db.execute(
        select(Partner)
        .where(Partner.slug == slug, *_VISIBLE_PARTNER)
        .options(selectinload(Partner.expertise))
    ).unique().scalar_one_or_none()
    if partner is None:
        # A suspended or unlisted partner 404s rather than 403s. Confirming that
        # a company exists but is hidden is itself a disclosure about them.
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Partner not found")

    listings = db.execute(
        listing_service.base_query().where(
            ServiceListing.partner_id == partner.id,
            ServiceListing.status == "PUBLISHED",
            ServiceListing.deleted_at.is_(None),
        )
    ).unique().scalars().all()

    detail = PublicPartnerDetail.model_validate(partner)
    detail.has_logo = bool(partner.logo_bytes and partner.logo_mime)
    detail.has_banner = bool(partner.banner_bytes and partner.banner_mime)
    detail.expertise = [
        PublicCategory(
            name=c.name, slug=c.slug, description=c.description,
            icon=c.icon, listing_count=c.listing_count,
        )
        for c in partner.expertise
    ]
    # `PublicListing`, not `PublicListingWithPartner`.
    #
    # ⚠️ This was the third site of the same mistake and my earlier fix missed
    # it: `PublicListingWithPartner` requires `partner`, and validating without
    # it raises before anything can be assigned. On this page the partner is the
    # page, so repeating it inside each listing would be redundant as well as
    # broken — which is exactly why `PublicPartnerDetail.listings` is typed as
    # the plain listing model.
    detail.listings = [PublicListing.model_validate(listing) for listing in listings]
    return detail


@router.get("/listings", response_model=Page[PublicListingWithPartner])
def public_listings(
    page: int = Query(1, ge=1),
    per_page: int = Query(24, ge=1, le=60),
    category: str | None = None,
    db: Session = Depends(get_db),
) -> Page[PublicListingWithPartner]:
    stmt = (
        listing_service.base_query()
        .join(Partner, Partner.id == ServiceListing.partner_id)
        .where(
            ServiceListing.status == "PUBLISHED",
            ServiceListing.deleted_at.is_(None),
            *_VISIBLE_PARTNER,
        )
    )
    if category:
        found = category_service.get_by_slug(db, category)
        if found is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown category")
        stmt = stmt.where(ServiceListing.category_id == found.id)

    total = db.execute(
        select(func.count()).select_from(stmt.order_by(None).subquery())
    ).scalar_one()
    rows = db.execute(
        stmt.order_by(ServiceListing.published_at.desc().nulls_last())
        .offset((page - 1) * per_page)
        .limit(per_page)
    ).unique().scalars().all()

    # Partners fetched in ONE query, keyed by id.
    #
    # ⚠️ This used to be `db.get(Partner, ...)` inside the loop — an N+1 that
    # only showed up as slowness, and only once the directory had rows. Twelve
    # listings meant thirteen queries.
    partner_ids = {row.partner_id for row in rows}
    partners = {
        p.id: p
        for p in db.execute(select(Partner).where(Partner.id.in_(partner_ids)))
        .scalars()
        .all()
    } if partner_ids else {}

    items = [_listing_with_partner(row, partners.get(row.partner_id)) for row in rows]
    return Page[PublicListingWithPartner](items=items, **page_meta(page, per_page, total))


@router.get("/listings/{slug}", response_model=PublicListingWithPartner)
def public_listing(slug: str, db: Session = Depends(get_db)) -> PublicListingWithPartner:
    listing = listing_service.get_public_by_slug(db, slug)
    if listing is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Listing not found")
    return _listing_with_partner(listing, db.get(Partner, listing.partner_id))


@router.get("/partners/{slug}/brand/{asset}")
def public_brand_asset(slug: str, asset: str, db: Session = Depends(get_db)) -> Response:
    """Serve a listed partner's logo or banner.

    ## Why the response carries a content-security policy

    An SVG is a document, not a bitmap: opened directly it can carry script. The
    upload path already refuses anything with script, embedded HTML, external
    references or a DOCTYPE — but `core/images.py`'s own docstring makes the case
    for two independent controls, because either alone is one mistake away from
    failing. This is the second: even a file that slipped past the check executes
    nothing, because the response forbids script and every external fetch.
    
    `X-Content-Type-Options: nosniff` matters for the same reason — without it a
    browser may decide the bytes are HTML regardless of what we said they were.

    ## Caching
    
    A strong validator from `*_updated_at`, so a replaced logo invalidates
    everywhere rather than lingering, and an unchanged one is not re-downloaded on
    every profile view. Public and immutable-ish: these are the same bytes for
    every visitor.
    """
    partner = db.execute(
        select(Partner).where(Partner.slug == slug, *_VISIBLE_PARTNER)
    ).scalar_one_or_none()
    if partner is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Partner not found")

    found = partner_service.brand_asset(partner, asset)
    if found is None:
        # 404 rather than a placeholder image: the caller asked for an asset that
        # does not exist, and the card already knows how to fall back to initials.
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such asset")

    data, mime, updated_at = found
    stamp = int(updated_at.timestamp()) if updated_at else 0
    return Response(
        content=data,
        media_type=mime,
        headers={
            "Cache-Control": "public, max-age=300",
            "ETag": f'"{slug}-{asset}-{stamp}"',
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
        },
    )


@router.post(
    "/enquiries", response_model=EnquiryCreatedResponse, status_code=status.HTTP_201_CREATED
)
def create_public_enquiry(
    payload: CreateEnquiryRequest, request: Request, db: Session = Depends(get_db)
) -> EnquiryCreatedResponse:
    """Accept an enquiry from an anonymous visitor. **The product.**

    Three defences, in order of how much they are worth:

    1. **The rate limit** in `core/rate_limit.py` — the real control, because it
       is the only one that survives somebody posting directly rather than using
       our form.
    2. **The honeypot** below. A real browser leaves it empty; a bot fills every
       field it finds. It returns success rather than an error on purpose —
       telling a bot it was detected teaches whoever wrote it what to change.
    3. Field validation in the schema.

    **No captcha.** § 20.4: not until there is a spam problem to solve. A captcha
    costs every honest buyer something to prevent a problem we have not had.
    """
    if payload.website:
        # Honeypot tripped. Look successful, write nothing.
        return EnquiryCreatedResponse(reference="ENQ-received", partner_name="")

    # Resolve the slug against the SAME visibility rules the profile page used —
    # not merely "does this row exist". An enquiry accepted for a suspended or
    # unlisted partner is a message nobody reads, and accepting it would tell the
    # sender their request had gone somewhere.
    partner = db.execute(
        select(Partner).where(Partner.slug == payload.partner_slug, *_VISIBLE_PARTNER)
    ).scalar_one_or_none()
    if partner is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Partner not found")

    listing_id = None
    if payload.listing_slug:
        listing = listing_service.get_public_by_slug(db, payload.listing_slug)
        if listing is None or listing.partner_id != partner.id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Listing not found")
        listing_id = listing.id

    enquiry = enquiry_service.create_enquiry(
        db,
        partner_id=partner.id,
        listing_id=listing_id,
        buyer_name=payload.buyer_name,
        buyer_email=payload.buyer_email,
        buyer_phone=payload.buyer_phone,
        company=payload.company,
        message=payload.message,
        budget_range=payload.budget_range,
        timeline=payload.timeline,
        source="LISTING" if listing_id else "PROFILE",
        submitted_ip=request.client.host if request.client else None,
    )
    db.commit()
    return EnquiryCreatedResponse(reference=enquiry.reference, partner_name=partner.name)


@router.get("/enquiries/{reference}", response_model=PublicEnquiryStatus)
def public_enquiry_status(reference: str, db: Session = Depends(get_db)) -> PublicEnquiryStatus:
    """The buyer's own thread, by capability URL.

    ⚠️ **The reference is the credential.** There is no session here and no
    account behind it — possession of an unguessable string is the whole of the
    authorisation. That is why the page is `noindex`, why it is excluded from the
    sitemap, and why there is deliberately no variant of this route that accepts
    an enquiry id.
    """
    enquiry = enquiry_service.get_by_reference(db, reference)
    if enquiry is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Enquiry not found")
    partner = db.get(Partner, enquiry.partner_id)
    return PublicEnquiryStatus(
        reference=enquiry.reference,
        partner_name=partner.name if partner else "",
        status=enquiry.status,
        created_at=enquiry.created_at,
        first_responded_at=enquiry.first_responded_at,
        messages=enquiry.messages,
    )
