"""Schemas for the directory — categories, listings, enquiries.

## The public response models are the confidentiality enforcement

`PARTNER_DIRECTORY_PLAN.md` § 17.3 defines an allowlist for anonymous responses,
and § 0.1 adds a second rule on top of it: **nothing may reveal that partners
source anything from us.**

Neither is enforced by a comment. The `*Public*` models below simply do not have
the fields — no `notes`, no `gst_number`, no `pan_number`, no `status`, and no
supplier of any kind — so a router returning one cannot leak them even if the
ORM object it was built from carries them. That is the difference between a rule
and a guarantee.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

# --- Categories --------------------------------------------------------------

class CategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    parent_id: int | None
    name: str
    slug: str
    description: str | None
    icon: str | None
    sort_order: int
    is_active: bool
    listing_count: int


class CreateCategoryRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    parent_id: int | None = None
    description: str | None = None
    icon: str | None = Field(default=None, max_length=60)
    sort_order: int = 0


class UpdateCategoryRequest(BaseModel):
    #: No `slug`. It is a published URL the moment the category has a page, and
    #: renaming it breaks every inbound link — see `category_service.update_category`.
    name: str | None = Field(default=None, min_length=2, max_length=120)
    description: str | None = None
    icon: str | None = Field(default=None, max_length=60)
    sort_order: int | None = None
    is_active: bool | None = None


class ReorderCategoriesRequest(BaseModel):
    #: The whole ordered list, not a pair to swap — a swap API needs client and
    #: server to agree on the current order, and they do not after any concurrent edit.
    ordered_ids: list[int]


# --- Listings ----------------------------------------------------------------

class ListingMediaResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    path: str
    alt_text: str | None
    width: int | None
    height: int | None
    sort_order: int


class ListingAttributeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    label: str
    value: str
    sort_order: int


class ListingListItem(BaseModel):
    """The row a partner or staff member sees in an index.

    Carries `status` and `rejection_reason` because this is the **authenticated**
    view — a partner has to know why something was rejected. The public model
    below carries neither.
    """

    model_config = ConfigDict(from_attributes=True)

    id: str
    partner_id: str
    category_id: int
    title: str
    slug: str
    summary: str
    pricing_model: str
    price: Decimal | None
    currency: str
    status: str
    rejection_reason: str | None
    published_at: datetime | None
    submitted_at: datetime | None
    created_at: datetime


class ListingDetailResponse(ListingListItem):
    description: str | None
    media: list[ListingMediaResponse] = []
    attributes: list[ListingAttributeResponse] = []


class EntitlementResponse(BaseModel):
    """What a partner has published against what their tier allows.

    The read half of `PARTNER_DIRECTORY_PLAN.md` § 14.1 row 2b. `max_listings` and
    `remaining` are both nullable and both mean the same thing when null —
    unlimited — which is why `unlimited` is sent explicitly rather than left for
    every caller to infer from a null.
    """

    #: The tier's display name, or null when the partner is on no tier at all.
    tier: str | None
    published: int
    max_listings: int | None
    unlimited: bool
    #: Null when unlimited. Never negative — a partner moved to a smaller tier can
    #: be over their allowance, and "-2 remaining" is not a thing to render.
    remaining: int | None
    at_limit: bool


class ModerationQueueItem(ListingDetailResponse):
    """A queue entry, plus whether approving it would actually work.

    **A separate schema rather than two more fields on `ListingDetailResponse`.**
    Only the queue needs this, and every listing read in the application shares
    that model — so putting it there would make an entitlement lookup the cost of
    reading any listing, for a value almost nobody wants.

    ## Why the reviewer needs it before opening the listing

    Publishing is refused when the partner is suspended, unlisted, or at their
    tier's allowance (§ 19.9). Those refusals are correct, but a reviewer who
    only meets them *after* reading a listing and clicking Approve has spent the
    expensive part of the decision to be told the cheap part was impossible. The
    queue is worked oldest-first and is meant to be read; telling it what cannot
    be approved is the difference between a queue and a lottery.

    `blockers` empty means approving will succeed.
    """

    #: Denormalised so the queue does not need a second request per row to name
    #: the company — the reviewer is deciding about an organisation, not an id.
    partner_name: str
    #: Human-readable, and every applicable reason at once. Same list the refusal
    #: would raise, so the screen and the error cannot disagree.
    blockers: list[str] = []
    entitlement: EntitlementResponse


class CreateListingRequest(BaseModel):
    title: str = Field(min_length=3, max_length=160)
    summary: str = Field(min_length=10, max_length=280)
    category_id: int
    description: str | None = None
    pricing_model: str = "ON_REQUEST"
    price: Decimal | None = None
    currency: str = Field(default="INR", max_length=3)


class UpdateListingRequest(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=160)
    summary: str | None = Field(default=None, min_length=10, max_length=280)
    category_id: int | None = None
    description: str | None = None
    pricing_model: str | None = None
    price: Decimal | None = None
    currency: str | None = Field(default=None, max_length=3)


class RejectListingRequest(BaseModel):
    #: Required, with a minimum length. A one-character reason is not a reason,
    #: and the resubmission loop it causes costs the reviewer more than a
    #: sentence would have.
    reason: str = Field(min_length=5, max_length=1000)


# --- Enquiries ---------------------------------------------------------------

class EnquiryMessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    direction: str
    body: str
    created_at: datetime


class EnquiryListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    reference: str
    partner_id: str
    listing_id: str | None
    buyer_name: str
    buyer_email: EmailStr
    company: str | None
    status: str
    source: str
    #: NULL until the recipient partner opens it. Never set by a staff read.
    first_viewed_at: datetime | None
    first_responded_at: datetime | None
    created_at: datetime


class EnquiryDetailResponse(EnquiryListItem):
    buyer_phone: str | None
    message: str
    budget_range: str | None
    timeline: str | None
    messages: list[EnquiryMessageResponse] = []


class CreateEnquiryRequest(BaseModel):
    """What the public form posts.

    `budget_range` and `timeline` are optional and are the two that matter —
    § 6.4 records that they raise lead quality sharply, which is why they are on
    a form that otherwise asks for as little as possible.
    """

    #: **A slug, not an id.** The anonymous surface never sees a database
    #: identifier: the page knows a partner by the same slug that is in its URL,
    #: and an id in a public payload is one more internal fact circulating for no
    #: reason. The service resolves it against the same visibility rules the
    #: profile page used, so an unlisted partner 404s here exactly as it does there.
    partner_slug: str
    listing_slug: str | None = None
    buyer_name: str = Field(min_length=2, max_length=120)
    buyer_email: EmailStr
    buyer_phone: str | None = Field(default=None, max_length=30)
    company: str | None = Field(default=None, max_length=160)
    message: str = Field(min_length=10, max_length=5000)
    budget_range: str | None = Field(default=None, max_length=80)
    timeline: str | None = Field(default=None, max_length=80)
    #: Honeypot. A real browser leaves it empty; a bot fills every field it finds.
    #: Named innocuously on purpose — `honeypot` would be a hint.
    website: str | None = None


class ReplyEnquiryRequest(BaseModel):
    body: str = Field(min_length=1, max_length=5000)


class UpdateEnquiryStatusRequest(BaseModel):
    status: str


class EnquiryCreatedResponse(BaseModel):
    """What the buyer gets back.

    **The reference and nothing else.** It is the buyer's only way back to their
    thread, so it has to be returned — and returning the enquiry id alongside it
    would hand out a second identifier that the capability URL does not accept.
    """

    reference: str
    partner_name: str


# --- Public: the allowlist ---------------------------------------------------

class PublicCategory(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str
    slug: str
    description: str | None
    icon: str | None
    listing_count: int
    children: list[PublicCategory] = []


class PublicPartnerSummary(BaseModel):
    """A partner, as an anonymous visitor may see them.

    ⚠️ **Every absence here is deliberate.** No `notes`, `gst_number`,
    `pan_number` or `status` — § 17.3 marks them internal. No supplier, no
    sourcing, nothing about where this company buys anything — § 0.1.
    """

    model_config = ConfigDict(from_attributes=True)

    slug: str
    name: str
    tagline: str | None
    city: str | None
    verification_level: str
    founded_year: int | None
    employee_range: str | None
    #: ⚠️ `logo_path` is a legacy column nothing writes — kept on the model for a
    #: future filesystem or CDN backend, and deliberately NOT exposed here.
    #:
    #: What a client needs is whether an asset exists, so it can render an
    #: `<img>` or fall back to initials. The bytes come from
    #: `/public/partners/{slug}/brand/logo`, which caches and validates
    #: independently of this response.
    has_logo: bool = False
    has_banner: bool = False


class PublicPartnerDetail(PublicPartnerSummary):
    about: str | None
    website: str | None
    public_email: EmailStr | None
    public_phone: str | None
    service_areas: str | None
    state: str | None
    country: str | None
    banner_path: str | None
    expertise: list[PublicCategory] = []
    listings: list[PublicListing] = []


class PublicListing(BaseModel):
    """A published listing. No `status` — everything here is published by
    definition, and rendering the word would invite the question of what else
    there is."""

    model_config = ConfigDict(from_attributes=True)

    title: str
    slug: str
    summary: str
    description: str | None
    pricing_model: str
    price: Decimal | None
    currency: str
    published_at: datetime | None
    media: list[ListingMediaResponse] = []
    attributes: list[ListingAttributeResponse] = []


class PublicListingWithPartner(PublicListing):
    partner: PublicPartnerSummary
    category: PublicCategory | None = None


class PublicEnquiryStatus(BaseModel):
    """What the buyer sees at their capability URL.

    Carries the partner's *name* and not their id: the page is for a human
    checking whether anyone replied, and an id would be one more identifier
    circulating for no reason.
    """

    reference: str
    partner_name: str
    status: str
    created_at: datetime
    first_responded_at: datetime | None
    messages: list[EnquiryMessageResponse] = []


PublicCategory.model_rebuild()
PublicPartnerDetail.model_rebuild()
