"""Partner organisation endpoints — staff-facing.

Thin by design (`FASTAPI_STANDARDS.md` § 2): every rule lives in
`partner_service`, and every guard is visible in the signature.

**There is no public route here yet.** The directory's anonymous surface is phase
5 of `PARTNER_DIRECTORY_PLAN.md`, and it needs the `Principal` actor type settled
first (§ 7.1) — every guard below resolves to a `User`, and a public route has no
user at all. `PartnerPublicResponse` already exists in the schemas as the
allowlist that surface will be reviewed against.

Status, verification and publication are **separate endpoints with separate
permissions** rather than fields on `PATCH /partners/{id}`. Each grants something
a general edit should not: login for a whole organisation, Leapswitch's published
endorsement, and visibility to the anonymous internet.
"""

from fastapi import APIRouter, Depends, File, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_permission
from app.core.query import page_meta
from app.domain.partners.permissions import (
    ORGANISATION_MANAGE,
    PARTNER_APPROVE,
    PARTNER_CREATE,
    PARTNER_DELETE,
    PARTNER_PUBLISH,
    PARTNER_TIER_MANAGE,
    PARTNER_TIER_VIEW,
    PARTNER_UPDATE,
    PARTNER_VERIFY,
    PARTNER_VIEW,
)
from app.models.user import User
from app.schemas.common import Page
from app.schemas.directory import OwnOrganisationOverview
from app.schemas.partner import (
    ChangePartnerStatusRequest,
    CreatePartnerRequest,
    PartnerDetailResponse,
    PartnerListItem,
    PartnerTierResponse,
    PublishPartnerRequest,
    SetExpertiseRequest,
    UpdateOwnOrganisationRequest,
    UpdatePartnerRequest,
    UpdatePartnerTierRequest,
    VerifyPartnerRequest,
)
from app.services import partner_service

router = APIRouter(prefix="/partners", tags=["partners"])


# --- The caller's own organisation — punchlist 3.2 / 3.4 ---------------------
#
# Declared BEFORE /{partner_id} so "me" is not captured as a partner id.
#
# ⚠️ **These are the only partner-writable routes on this router.** They are gated
# on ORGANISATION_MANAGE, which the Partner role holds and staff do not.
#
# It was PARTNER_VIEW until 2026-08-18, which staff also hold — so a staff member
# could call these and receive nothing but a 404, because the organisation is
# resolved from their session and they have none. A permission-filtered sidebar
# had the same problem: there was no way to show these items to partners only.
#
# Not PARTNER_UPDATE either: that is staff editing *any* partner. The subject here
# is always the caller's own organisation, so there is no id to tamper with and no
# ownership check to forget.


@router.get("/me", response_model=PartnerDetailResponse)
def get_my_organisation(
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(ORGANISATION_MANAGE)),
) -> PartnerDetailResponse:
    return PartnerDetailResponse.model_validate(
        partner_service.get_own_organisation(db, actor)
    )


@router.get("/me/overview", response_model=OwnOrganisationOverview)
def get_my_overview(
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(ORGANISATION_MANAGE)),
) -> OwnOrganisationOverview:
    """The partner's own landing-page figures, in one call.

    `ORGANISATION_MANAGE` like every other `/me` route, so it is partner-only and
    staff get a 404 from `get_own_organisation` rather than an empty shape they
    would have to interpret.
    """
    return OwnOrganisationOverview.model_validate(
        partner_service.own_overview(db, actor)
    )


@router.patch("/me", response_model=PartnerDetailResponse)
def update_my_organisation(
    payload: UpdateOwnOrganisationRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(ORGANISATION_MANAGE)),
) -> PartnerDetailResponse:
    """Update the public half of the caller's own record.

    The writable fields are an allowlist in `partner_service`, not an exclusion
    list here — `status`, `verification_level` and `is_listed` are staff's
    judgement about this partner and are not reachable from this route.
    """
    partner = partner_service.get_own_organisation(db, actor)
    partner_service.update_own_organisation(
        db, partner, actor=actor, **payload.model_dump(exclude_unset=True)
    )
    db.commit()
    return PartnerDetailResponse.model_validate(partner)


@router.put("/me/expertise", response_model=PartnerDetailResponse)
def set_my_expertise(
    payload: SetExpertiseRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(ORGANISATION_MANAGE)),
) -> PartnerDetailResponse:
    """What this partner advertises expertise in.

    **This is what makes the public filter work** — each id becomes a pivot row
    the directory index joins on, which is why it takes ids from the taxonomy
    rather than free text.
    """
    partner = partner_service.get_own_organisation(db, actor)
    partner_service.set_expertise(db, partner, payload.category_ids)
    db.commit()
    return PartnerDetailResponse.model_validate(partner)


@router.put("/me/brand/{asset}", response_model=PartnerDetailResponse)
async def upload_my_brand_asset(
    asset: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(ORGANISATION_MANAGE)),
) -> PartnerDetailResponse:
    """Upload the caller's own logo or banner.

    `async def` — the one exception to this codebase's synchronous rule, and it is
    forced rather than chosen: `UploadFile.read()` is a coroutine. The database
    work below is still synchronous and still on the same session.

    Validation is `core/images.py`'s, applied in the service. Nothing here trusts
    the filename or the declared content type.
    """
    partner = partner_service.get_own_organisation(db, actor)
    data = await file.read()
    partner_service.set_brand_asset(db, partner, asset=asset, data=data)
    db.commit()
    return PartnerDetailResponse.model_validate(partner)


@router.delete("/me/brand/{asset}", response_model=PartnerDetailResponse)
def clear_my_brand_asset(
    asset: str,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(ORGANISATION_MANAGE)),
) -> PartnerDetailResponse:
    partner = partner_service.get_own_organisation(db, actor)
    partner_service.clear_brand_asset(db, partner, asset=asset)
    db.commit()
    return PartnerDetailResponse.model_validate(partner)


# --- Tiers ------------------------------------------------------------------
# Declared BEFORE /{partner_id} so "tiers" is not captured as a partner id.


@router.get("/tiers", response_model=list[PartnerTierResponse])
def list_partner_tiers_endpoint(
    include_inactive: bool = Query(default=False),
    db: Session = Depends(get_db),
    _: User = Depends(require_permission(PARTNER_TIER_VIEW)),
) -> list[PartnerTierResponse]:
    return partner_service.list_tiers(db, include_inactive=include_inactive)


@router.patch("/tiers/{tier_id}", response_model=PartnerTierResponse)
def update_partner_tier_endpoint(
    tier_id: int,
    data: UpdatePartnerTierRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(PARTNER_TIER_MANAGE)),
) -> PartnerTierResponse:
    return partner_service.update_tier(db, tier_id, data, actor=actor)


# --- Partners ---------------------------------------------------------------


@router.get("", response_model=Page[PartnerListItem])
def list_partners_endpoint(
    search: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    verification_level: str | None = Query(default=None),
    tier_id: int | None = Query(default=None),
    is_listed: bool | None = Query(default=None),
    sort_by: str = Query(default="created_at"),
    sort_order: str = Query(default="desc"),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=15, ge=1, le=100),
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(PARTNER_VIEW)),
) -> Page[PartnerListItem]:
    items, total = partner_service.list_partners(
        db,
        actor,
        search=search,
        status_filter=status_filter,
        verification_level=verification_level,
        tier_id=tier_id,
        is_listed=is_listed,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        per_page=per_page,
    )
    return Page(
        items=items,
        **page_meta(page, per_page, total),
    )


@router.post("", response_model=PartnerDetailResponse, status_code=status.HTTP_201_CREATED)
def create_partner_endpoint(
    data: CreatePartnerRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(PARTNER_CREATE)),
) -> PartnerDetailResponse:
    return partner_service.create_partner(db, data, actor=actor)


@router.get("/{partner_id}", response_model=PartnerDetailResponse)
def get_partner_endpoint(
    partner_id: str,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(PARTNER_VIEW)),
) -> PartnerDetailResponse:
    return partner_service.get_partner_for(db, partner_id, actor=actor)


@router.patch("/{partner_id}", response_model=PartnerDetailResponse)
def update_partner_endpoint(
    partner_id: str,
    data: UpdatePartnerRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(PARTNER_UPDATE)),
) -> PartnerDetailResponse:
    return partner_service.update_partner(db, partner_id, data, actor=actor)


@router.delete("/{partner_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_partner_endpoint(
    partner_id: str,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(PARTNER_DELETE)),
) -> None:
    partner_service.delete_partner(db, partner_id, actor=actor)


@router.post("/{partner_id}/status", response_model=PartnerDetailResponse)
def change_partner_status_endpoint(
    partner_id: str,
    data: ChangePartnerStatusRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(PARTNER_APPROVE)),
) -> PartnerDetailResponse:
    """Activate, suspend or reinstate. Suspension revokes the members' sessions."""
    return partner_service.change_status(db, partner_id, data, actor=actor)


@router.post("/{partner_id}/verification", response_model=PartnerDetailResponse)
def verify_partner_endpoint(
    partner_id: str,
    data: VerifyPartnerRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(PARTNER_VERIFY)),
) -> PartnerDetailResponse:
    """Set what Leapswitch vouches for — the directory's trust signal (§ 9)."""
    return partner_service.set_verification(
        db, partner_id, data.verification_level, actor=actor
    )


@router.post("/{partner_id}/listing", response_model=PartnerDetailResponse)
def publish_partner_endpoint(
    partner_id: str,
    data: PublishPartnerRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(PARTNER_PUBLISH)),
) -> PartnerDetailResponse:
    """Publish or unpublish in the directory. Requires an ACTIVE organisation."""
    return partner_service.set_listed(db, partner_id, data.is_listed, actor=actor)
