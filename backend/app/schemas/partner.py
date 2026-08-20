"""Wire contract for the partner directory's organisation layer.

Two response shapes, and the split is a security boundary rather than a
convenience:

    PartnerListItem / PartnerDetailResponse   staff-facing. Carries `notes`,
                                              `gst_number`, `pan_number` and the
                                              audit columns.
    PartnerPublicResponse                     what an anonymous visitor may see.

`FASTAPI_STANDARDS.md` § 5 is explicit that a response schema is what stops a
field leaking, and the internal-notes rule in `MARKETPLACE_DOMAIN_PLAN.md` says
the same: enforce it with a **separate schema**, not by remembering to strip a
field. `PartnerPublicResponse` is therefore built from scratch rather than
inheriting and excluding — inheritance would mean every field added to the staff
schema is public by default, which is the wrong direction to fail in.

The public schema exists now, before there is a public route, deliberately. Its
field list is the definition of "what the internet may see about a partner", and
having it written down is what phase 5 will be reviewed against.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

# Mirrors the enums in `app/models/partner.py`. `Literal`, not a bare `str`, so
# the closed set appears in OpenAPI — which is what generates the frontend's
# types (PM-42). A `str` here becomes a `string` there and the UI loses the enum.
# `FASTAPI_STANDARDS.md` § 5.
#
# Used on REQUESTS only. Responses keep `str`, because the value arrives from the
# database enum and a `Literal` there would turn a row written by a future
# migration into a 500 at serialisation time rather than a value the client can
# choose to ignore.
PartnerStatus = Literal["PENDING", "ACTIVE", "SUSPENDED"]
VerificationLevel = Literal["UNVERIFIED", "VERIFIED", "PREMIER"]


# --- Tiers ------------------------------------------------------------------


class PartnerTierResponse(BaseModel):
    """A tier, as the tier selector and the partner detail page render it."""

    model_config = {"from_attributes": True}

    id: int
    name: str
    display_name: str
    description: str | None
    #: NULL means unlimited. The client must not coerce this to 0.
    max_listings: int | None
    featured_slots: int
    sort_order: int
    is_active: bool
    is_unlimited: bool
    can_feature: bool


class UpdatePartnerTierRequest(BaseModel):
    """Change what a tier grants. Name and display order are seeded, not edited.

    `name` is deliberately absent: it is the key `domain/partners/tiers.py` and
    every future entitlement check reference, and renaming it here would make the
    database disagree with the code until the next seed silently renamed it back.
    """

    display_name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = None
    max_listings: int | None = Field(default=None, ge=0)
    featured_slots: int | None = Field(default=None, ge=0)
    is_active: bool | None = None


# --- Partners: requests ------------------------------------------------------


class CreatePartnerRequest(BaseModel):
    """Onboard a partner organisation.

    `status` is absent on purpose. A new partner is always PENDING — activating
    it is a separate, permissioned act (`PARTNER_APPROVE`), and letting the
    create call choose would mean whoever can onboard can also grant login to
    every account in the organisation.

    `slug` is absent for the same class of reason: it is derived from `name` and
    is the partner's permanent public URL. Accepting it here invites a caller to
    pick one that collides or reads as another partner.
    """

    name: str = Field(min_length=2, max_length=255)
    legal_name: str | None = Field(default=None, max_length=255)
    tier_id: int | None = None

    tagline: str | None = Field(default=None, max_length=200)
    about: str | None = None
    website: str | None = Field(default=None, max_length=255)
    public_email: EmailStr | None = None
    public_phone: str | None = Field(default=None, max_length=30)
    founded_year: int | None = Field(default=None, ge=1800, le=2200)
    employee_range: str | None = Field(default=None, max_length=50)

    gst_number: str | None = Field(default=None, max_length=30)
    pan_number: str | None = Field(default=None, max_length=30)
    billing_address: str | None = None
    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, max_length=100)
    country: str | None = Field(default=None, max_length=100)
    postal_code: str | None = Field(default=None, max_length=20)

    agreement_signed_at: datetime | None = None
    notes: str | None = None

    @field_validator("name", "legal_name", "tagline", "city", "state", "country")
    @classmethod
    def _strip(cls, value: str | None) -> str | None:
        return value.strip() if isinstance(value, str) else value


class UpdatePartnerRequest(BaseModel):
    """Partial update. Every field optional, applied with `exclude_unset=True`.

    Deliberately excludes `status`, `verification_level` and `is_listed`. Each has
    its own endpoint and its own permission, because each has a consequence a
    general edit should not carry: login for the whole organisation, Leapswitch's
    published endorsement, and visibility to the anonymous internet. A `PATCH`
    that could set any of them would make `PARTNER_UPDATE` a superset of the
    three permissions that exist to separate them.
    """

    name: str | None = Field(default=None, min_length=2, max_length=255)
    legal_name: str | None = Field(default=None, max_length=255)
    tier_id: int | None = None

    tagline: str | None = Field(default=None, max_length=200)
    about: str | None = None
    logo_path: str | None = Field(default=None, max_length=255)
    banner_path: str | None = Field(default=None, max_length=255)
    website: str | None = Field(default=None, max_length=255)
    public_email: EmailStr | None = None
    public_phone: str | None = Field(default=None, max_length=30)
    founded_year: int | None = Field(default=None, ge=1800, le=2200)
    employee_range: str | None = Field(default=None, max_length=50)

    gst_number: str | None = Field(default=None, max_length=30)
    pan_number: str | None = Field(default=None, max_length=30)
    billing_address: str | None = None
    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, max_length=100)
    country: str | None = Field(default=None, max_length=100)
    postal_code: str | None = Field(default=None, max_length=20)

    agreement_signed_at: datetime | None = None
    notes: str | None = None

    @field_validator("name", "legal_name", "tagline", "city", "state", "country")
    @classmethod
    def _strip(cls, value: str | None) -> str | None:
        return value.strip() if isinstance(value, str) else value


class ChangePartnerStatusRequest(BaseModel):
    """Move a partner through PENDING → ACTIVE ↔ SUSPENDED.

    An explicit endpoint rather than a `PATCH status`, matching the rule
    `MARKETPLACE_DOMAIN_PLAN.md` § State Machines sets for quotes: a state machine
    driven by a free-form status field is one that will be driven into an invalid
    state.
    """

    status: PartnerStatus
    #: Recorded on the activity log entry, not on the partner. Why an
    #: organisation was suspended is an event, not a current property.
    reason: str | None = Field(default=None, max_length=500)


class VerifyPartnerRequest(BaseModel):
    """Set what Leapswitch vouches for. See `permissions.PARTNER_VERIFY`."""

    verification_level: VerificationLevel


class PublishPartnerRequest(BaseModel):
    """Flip directory visibility. The only field here the public can observe."""

    is_listed: bool


# --- Partners: responses -----------------------------------------------------


class PartnerListItem(BaseModel):
    """One row of the staff partners table.

    `can_*` flags are computed per row against the *requesting* actor so the UI
    never offers an action the API would reject. The API re-checks regardless —
    these are for rendering, not for security. Same contract as `UserListItem`.
    """

    model_config = {"from_attributes": True}

    id: str
    name: str
    slug: str
    status: str
    verification_level: str
    is_listed: bool
    tier: PartnerTierResponse | None
    city: str | None
    country: str | None
    # No default. `= 0` here was the other half of the bug described on
    # `partner_service.decorate`: it let an undecorated row validate cleanly and
    # answer "zero members". Required means a route that forgets to decorate fails
    # in the response model, loudly, instead of publishing a plausible zero.
    user_count: int
    created_at: datetime

    is_active: bool
    is_verified: bool
    publicly_visible: bool

    can_edit: bool = False
    can_delete: bool = False
    can_change_status: bool = False
    can_verify: bool = False
    can_publish: bool = False


class PartnerDetailResponse(PartnerListItem):
    #: Presence of a brand asset, not its bytes. The image itself is served by
    #: its own route so it can be cached and validated independently; a boolean
    #: here would be equally fine, but the mime is free and lets a client pick a
    #: sensible `<img>` treatment for an SVG versus a raster.
    logo_mime: str | None = None
    banner_mime: str | None = None
    """The full staff-facing record.

    Carries `notes`, `gst_number` and `pan_number`. **Never return this from a
    public route** — use `PartnerPublicResponse`.
    """

    legal_name: str | None
    tagline: str | None
    about: str | None
    logo_path: str | None
    banner_path: str | None
    website: str | None
    public_email: str | None
    public_phone: str | None
    founded_year: int | None
    employee_range: str | None

    gst_number: str | None
    pan_number: str | None
    billing_address: str | None
    state: str | None
    postal_code: str | None

    agreement_signed_at: datetime | None
    verified_at: datetime | None
    verified_by: str | None
    onboarded_by: str | None
    notes: str | None

    created_by: str | None
    updated_by: str | None
    updated_at: datetime


class PartnerPublicResponse(BaseModel):
    """What an anonymous visitor may see. **The allowlist, not a filtered view.**

    Built from scratch rather than inheriting from the staff schema so that a
    field added there is private by default. Anything appearing here is a
    deliberate decision to publish it.

    Absent on purpose: `notes` (internal), `gst_number` / `pan_number` (the
    partner's tax identity), every audit column (who onboarded a partner is our
    business, not the internet's), and `status` — which would disclose that a
    suspended organisation exists.
    """

    model_config = {"from_attributes": True}

    id: str
    name: str
    slug: str
    tagline: str | None
    about: str | None
    logo_path: str | None
    banner_path: str | None
    website: str | None
    public_email: str | None
    public_phone: str | None
    founded_year: int | None
    employee_range: str | None
    city: str | None
    state: str | None
    country: str | None
    verification_level: str
    is_verified: bool
    tier: PartnerTierResponse | None


class UpdateOwnOrganisationRequest(BaseModel):
    """What a partner may change about their own record.

    ⚠️ **Everything absent is absent on purpose.** No `status`, no
    `verification_level`, no `is_listed`, no `tier_id` — those are Leapswitch's
    judgement about this partner, not theirs. No `notes`, `gst_number` or
    `pan_number` — internal. The service applies a matching allowlist, so a field
    added here without being added there is inert rather than dangerous.
    """

    name: str | None = Field(default=None, min_length=2, max_length=160)
    tagline: str | None = Field(default=None, max_length=200)
    about: str | None = None
    website: str | None = Field(default=None, max_length=255)
    public_email: EmailStr | None = None
    public_phone: str | None = Field(default=None, max_length=30)
    founded_year: int | None = Field(default=None, ge=1800, le=2100)
    employee_range: str | None = Field(default=None, max_length=40)
    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, max_length=100)
    country: str | None = Field(default=None, max_length=100)
    postal_code: str | None = Field(default=None, max_length=20)
    service_areas: str | None = None


class SetExpertiseRequest(BaseModel):
    """Replace the whole expertise selection.

    Ids, not names: these become pivot rows the public directory filter joins on.
    """

    category_ids: list[int]
