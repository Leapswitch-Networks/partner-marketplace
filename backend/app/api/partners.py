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

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_permission
from app.core.permissions import (
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
from app.core.query import page_meta
from app.models.user import User
from app.schemas.common import Page
from app.schemas.partner import (
    ChangePartnerStatusRequest,
    CreatePartnerRequest,
    PartnerDetailResponse,
    PartnerListItem,
    PartnerTierResponse,
    PublishPartnerRequest,
    UpdatePartnerRequest,
    UpdatePartnerTierRequest,
    VerifyPartnerRequest,
)
from app.services import partner_service

router = APIRouter(prefix="/partners", tags=["partners"])


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
