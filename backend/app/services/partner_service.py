"""Partner organisation administration: onboard, edit, activate, verify, publish.

Phase 1 of `PARTNER_DIRECTORY_PLAN.md`. The organisation layer comes first
because every partner-owned table carries `partner_id`, and retrofitting
ownership afterwards means backfilling it everywhere.

## The rules that live here, and why they are not in the router

  * a new partner is always PENDING — onboarding does not grant login
  * `slug` is derived from `name`, unique, and **never changes after creation**
  * status, verification and publication are three separate acts with three
    separate permissions (see `core/permissions.py` for why)
  * suspending an organisation revokes its users' live sessions immediately,
    rather than waiting for their access tokens to expire
  * a partner with users cannot be deleted

## ⚠️ Row scoping is NOT implemented here — PM-5 is still open

`list_partners` and `get_partner_for` filter on `actor.partner_id` **by hand**,
which `MARKETPLACE_DOMAIN_PLAN.md` § Row-Level Scoping rule 1 explicitly tells
you not to do: *"never write `where(partner_id == ...)` in a service."* The rule
is right and this code breaks it, because the module it names —
`app/services/scoping.py` — does not exist yet.

It is written this way rather than left unscoped because an unscoped list would
show every partner to every partner user today. When `scoping.py` lands (phase
2), **these two call sites are the ones to replace**, and they are marked with
`# PM-5` so they can be found. Nothing else in this module filters by ownership.

The filter reaches the SQL rather than post-filtering the page, which is the
half of the rule that matters most: post-filtering corrupts the count and the
caller is told there are 40 rows and handed 12 (`FASTAPI_STANDARDS.md` § 12).
"""

from __future__ import annotations

import re
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.core.crud import get_or_404
from app.core.partner_tiers import DEFAULT_PARTNER_TIER
from app.core.permissions import (
    PARTNER_APPROVE,
    PARTNER_DELETE,
    PARTNER_PUBLISH,
    PARTNER_UPDATE,
    PARTNER_VERIFY,
)
from app.core.query import ListParams, ListSpec, run_list
from app.models.activity_log import (
    EVENT_STATUS_CHANGED,
    EVENT_UPDATED,
)
from app.models.partner import Partner
from app.models.partner_tier import PartnerTier
from app.models.user import User
from app.schemas.partner import (
    ChangePartnerStatusRequest,
    CreatePartnerRequest,
    UpdatePartnerRequest,
    UpdatePartnerTierRequest,
)
from app.services import activity_service, session_service, webhook_service

_LIST_SPEC = ListSpec(
    sortable={
        "created_at": Partner.created_at,
        "name": Partner.name,
        "status": Partner.status,
        "verification_level": Partner.verification_level,
        "city": Partner.city,
    },
    default_sort="created_at",
    # `created_at` is not unique — a seeded batch shares a timestamp — so without
    # this tiebreak a tying row can appear on two pages or on neither. The same
    # bug `list_users` shipped with before `ListSpec` made the tiebreak required.
    tiebreak=Partner.id,
    searchable=(
        Partner.name,
        Partner.legal_name,
        Partner.slug,
        Partner.city,
        Partner.public_email,
    ),
)

#: Statuses a partner may move to from each current status. PENDING is reachable
#: only as a starting state — reverting an activated organisation to "not yet
#: onboarded" would be a lie about its history, and SUSPENDED already expresses
#: "active but stopped".
_STATUS_TRANSITIONS: dict[str, frozenset[str]] = {
    "PENDING": frozenset({"ACTIVE", "SUSPENDED"}),
    "ACTIVE": frozenset({"SUSPENDED"}),
    "SUSPENDED": frozenset({"ACTIVE"}),
}


# --- Slugs ------------------------------------------------------------------


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.strip().lower()).strip("-")
    return slug[:110] or "partner"


def _unique_slug(db: Session, name: str) -> str:
    """A slug no other partner holds.

    Suffixes rather than raising, because a duplicate trading name is a normal
    thing in a 300+ partner directory and rejecting the second one would be a
    confusing failure for a staff member who typed a real company's real name.

    Never reused: `PARTNER_DIRECTORY_PLAN.md` § 8 makes the slug the partner's
    permanent public URL, and recycling one would silently redirect inbound links
    and any accumulated search ranking to a different company.
    """
    base = _slugify(name)
    candidate = base
    suffix = 2
    while db.scalar(select(Partner.id).where(Partner.slug == candidate)) is not None:
        candidate = f"{base}-{suffix}"
        suffix += 1
    return candidate


# --- Predicates (one source of truth for both the flags and the writes) ------


def can_edit(actor: User, partner: Partner) -> bool:
    return actor.has_permission(PARTNER_UPDATE)


def can_delete(actor: User, partner: Partner) -> bool:
    # A partner user can never delete their own organisation, whatever they hold.
    if actor.partner_id == partner.id:
        return False
    return actor.has_permission(PARTNER_DELETE)


def can_change_status(actor: User, partner: Partner) -> bool:
    # Changing your own organisation's status is self-approval, and the ACTIVE
    # case would let a partner lift their own suspension.
    if actor.partner_id == partner.id:
        return False
    return actor.has_permission(PARTNER_APPROVE)


def can_verify(actor: User, partner: Partner) -> bool:
    if actor.partner_id == partner.id:
        return False
    return actor.has_permission(PARTNER_VERIFY)


def can_publish(actor: User, partner: Partner) -> bool:
    return actor.has_permission(PARTNER_PUBLISH)


def decorate(partner: Partner, actor: User, *, user_count: int = 0) -> Partner:
    """Attach the per-row flags and counts the schemas read."""
    partner.can_edit = can_edit(actor, partner)
    partner.can_delete = can_delete(actor, partner)
    partner.can_change_status = can_change_status(actor, partner)
    partner.can_verify = can_verify(actor, partner)
    partner.can_publish = can_publish(actor, partner)
    partner.user_count = user_count
    return partner


# --- Reads ------------------------------------------------------------------


def _user_counts(db: Session, partner_ids: list[str]) -> dict[str, int]:
    """Members per partner, in one query rather than one per row."""
    if not partner_ids:
        return {}
    rows = db.execute(
        select(User.partner_id, func.count(User.id))
        .where(User.partner_id.in_(partner_ids))
        .group_by(User.partner_id)
    ).all()
    return {partner_id: count for partner_id, count in rows}


def get_partner_for(db: Session, partner_id: str, actor: User) -> Partner:
    """One partner the actor is allowed to see, or 404.

    **404, never 403**, when a partner user asks for another organisation — a 403
    confirms the row exists, which in a directory tells one partner that a
    competitor is on the platform before it is published.
    """
    partner = get_or_404(db, Partner, partner_id, label="Partner")

    # PM-5: replace with `scoping.assert_can_read(partner, actor)`.
    if not actor.has_admin_access and actor.partner_id != partner.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Partner not found")

    counts = _user_counts(db, [partner.id])
    return decorate(partner, actor, user_count=counts.get(partner.id, 0))


def list_partners(
    db: Session,
    actor: User,
    *,
    search: str | None = None,
    status_filter: str | None = None,
    verification_level: str | None = None,
    tier_id: int | None = None,
    is_listed: bool | None = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    page: int = 1,
    per_page: int = 15,
) -> tuple[list[Partner], int]:
    """Paginated partners, scoped to what the actor may see."""
    stmt: Select = select(Partner)

    # PM-5: replace with `scoping.apply_scope(stmt, Partner, actor)`. A partner
    # user sees exactly their own organisation and nothing else.
    if not actor.has_admin_access:
        if actor.partner_id is None:
            # Staff without admin access have no organisation of their own, so
            # scoping them to `partner_id` would return everything. Return
            # nothing instead: this is the conservative branch, and it is the
            # same choice `list_users` makes for the same reason.
            stmt = stmt.where(Partner.id.is_(None))
        else:
            stmt = stmt.where(Partner.id == actor.partner_id)

    if status_filter:
        stmt = stmt.where(Partner.status == status_filter)
    if verification_level:
        stmt = stmt.where(Partner.verification_level == verification_level)
    if tier_id is not None:
        stmt = stmt.where(Partner.tier_id == tier_id)
    if is_listed is not None:
        stmt = stmt.where(Partner.is_listed.is_(is_listed))

    rows, total = run_list(
        db,
        stmt,
        _LIST_SPEC,
        ListParams(
            page=page,
            per_page=per_page,
            sort_by=sort_by,
            sort_order=sort_order,
            search=search,
        ),
    )

    counts = _user_counts(db, [row.id for row in rows])
    for row in rows:
        decorate(row, actor, user_count=counts.get(row.id, 0))
    return rows, total


# --- Writes -----------------------------------------------------------------


def _resolve_tier(db: Session, tier_id: int | None) -> PartnerTier | None:
    """The requested tier, the seeded default, or None if tiers are unseeded."""
    if tier_id is not None:
        tier = db.get(PartnerTier, tier_id)
        if tier is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Partner tier not found")
        if not tier.is_active:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"The '{tier.display_name}' tier is no longer available.",
            )
        return tier

    # Falling back rather than failing: an unseeded `partner_tiers` should not
    # block onboarding, and `partners.tier_id` is nullable precisely so a
    # tier-less partner is a valid state with the most restrictive entitlement.
    return db.scalar(select(PartnerTier).where(PartnerTier.name == DEFAULT_PARTNER_TIER))


def create_partner(db: Session, data: CreatePartnerRequest, actor: User) -> Partner:
    """Onboard a partner organisation. Always PENDING; never grants login."""
    tier = _resolve_tier(db, data.tier_id)

    partner = Partner(
        slug=_unique_slug(db, data.name),
        status="PENDING",
        verification_level="UNVERIFIED",
        is_listed=False,
        tier_id=tier.id if tier else None,
        onboarded_by=actor.id,
        created_by=actor.id,
        updated_by=actor.id,
        **data.model_dump(exclude={"tier_id"}),
    )

    db.add(partner)
    db.commit()
    db.refresh(partner)

    activity_service.record_created(
        db,
        subject_type="Partner",
        subject_id=partner.id,
        values={
            "name": partner.name,
            "slug": partner.slug,
            "status": partner.status,
            "tier": partner.tier_name,
        },
        actor=actor,
        label=partner.name,
    )

    # Emitted after the commit, deliberately: a webhook makes a network request,
    # and `emit` never raises, so a slow or broken receiver delays this response
    # without holding a lock or risking the write it is reporting.
    webhook_service.emit(
        db,
        "partner.created",
        {"id": partner.id, "name": partner.name, "slug": partner.slug, "status": partner.status},
    )
    return decorate(partner, actor)


def update_partner(
    db: Session, partner_id: str, data: UpdatePartnerRequest, actor: User
) -> Partner:
    """Edit a partner's details.

    Cannot touch status, verification or publication — those are absent from the
    schema and have their own endpoints. `slug` is not editable at all: it is the
    public URL, and changing it breaks every inbound link.
    """
    partner = get_or_404(db, Partner, partner_id, label="Partner")

    if not can_edit(actor, partner):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "You may not edit this partner."
        )

    changes = data.model_dump(exclude_unset=True)
    if "tier_id" in changes:
        tier = _resolve_tier(db, changes.pop("tier_id"))
        partner.tier_id = tier.id if tier else None

    for field, value in changes.items():
        setattr(partner, field, value)

    partner.updated_by = actor.id
    db.commit()
    db.refresh(partner)

    activity_service.record(
        db,
        description=f"Updated partner '{partner.name}'",
        event=EVENT_UPDATED,
        subject_type="Partner",
        subject_id=partner.id,
        actor=actor,
        # Field names only, not values. `notes` is internal and `billing_address`
        # is the partner's; the log records that they changed, not what to.
        properties={"fields": sorted(changes)},
    )
    return decorate(partner, actor)


def change_status(
    db: Session, partner_id: str, data: ChangePartnerStatusRequest, actor: User
) -> Partner:
    """Move a partner through its lifecycle, and evict sessions on suspension.

    **Suspension has to reach live sessions.** `get_current_user` re-reads the
    organisation on every request, so a suspended partner's users are refused as
    soon as their next request lands — but their sessions would otherwise remain
    valid rows, and reinstating the partner would silently restore access to
    sessions opened before the suspension. Revoking makes the decision explicit.
    """
    partner = get_or_404(db, Partner, partner_id, label="Partner")

    if not can_change_status(actor, partner):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "You may not change this partner's status.",
        )

    if data.status == partner.status:
        return decorate(partner, actor)

    allowed = _STATUS_TRANSITIONS.get(partner.status, frozenset())
    if data.status not in allowed:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"A {partner.status} partner cannot become {data.status}.",
        )

    previous = partner.status
    partner.status = data.status
    partner.updated_by = actor.id
    db.commit()
    db.refresh(partner)

    revoked = 0
    if data.status == "SUSPENDED":
        member_ids = list(
            db.scalars(select(User.id).where(User.partner_id == partner.id))
        )
        for member_id in member_ids:
            revoked += session_service.revoke_all(
                db, member_id, reason="partner suspended"
            )

    reason = f" — {data.reason}" if data.reason else ""
    activity_service.record(
        db,
        description=f"Partner '{partner.name}' {previous} → {data.status}{reason}",
        event=EVENT_STATUS_CHANGED,
        subject_type="Partner",
        subject_id=partner.id,
        actor=actor,
        properties={"from": previous, "to": data.status, "sessions_revoked": revoked},
    )

    # Only activation is published. A subscriber cares that a partner became
    # usable, not that it moved between two internal states — and `ACTIVE` is
    # what approval *is* here; there is no `APPROVED` status, which is why the
    # first version of this check could never have fired.
    if data.status == "ACTIVE" and previous == "PENDING":
        webhook_service.emit(
            db,
            "partner.activated",
            {
                "id": partner.id,
                "name": partner.name,
                "slug": partner.slug,
                "previous_status": previous,
            },
        )
    return decorate(partner, actor)


def set_verification(
    db: Session, partner_id: str, level: str, actor: User
) -> Partner:
    """Set what Leapswitch vouches for.

    Separate from `update_partner` because this is the directory's entire trust
    proposition (`PARTNER_DIRECTORY_PLAN.md` § 9) — whoever can set it is handing
    out Leapswitch's credibility, and § 9 ranks it above any paid placement.
    """
    partner = get_or_404(db, Partner, partner_id, label="Partner")

    if not can_verify(actor, partner):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "You may not verify this partner."
        )

    previous = partner.verification_level
    partner.verification_level = level
    partner.updated_by = actor.id

    if level == "UNVERIFIED":
        # Clearing the evidence with the claim. Leaving `verified_at` populated
        # would show a "verified on <date>" line under an unverified partner.
        partner.verified_at = None
        partner.verified_by = None
    else:
        partner.verified_at = datetime.now(timezone.utc)
        partner.verified_by = actor.id

    db.commit()
    db.refresh(partner)

    activity_service.record(
        db,
        description=f"Partner '{partner.name}' verification {previous} → {level}",
        event=EVENT_UPDATED,
        subject_type="Partner",
        subject_id=partner.id,
        actor=actor,
        properties={"from": previous, "to": level},
    )
    return decorate(partner, actor)


def set_listed(db: Session, partner_id: str, is_listed: bool, actor: User) -> Partner:
    """Publish or unpublish a partner in the directory.

    The only write in this module whose effect is visible to the anonymous
    internet, which is why it holds its own permission. Publishing requires the
    organisation to be ACTIVE — `publicly_visible` demands both, and allowing the
    flag to be set on a suspended partner would leave a row that claims to be
    published and is not, which is worse than refusing.
    """
    partner = get_or_404(db, Partner, partner_id, label="Partner")

    if not can_publish(actor, partner):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "You may not change this partner's directory visibility.",
        )

    if is_listed and partner.status != "ACTIVE":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Only an ACTIVE partner can be published to the directory.",
        )

    partner.is_listed = is_listed
    partner.updated_by = actor.id
    db.commit()
    db.refresh(partner)

    activity_service.record(
        db,
        description=(
            f"Partner '{partner.name}' "
            f"{'published to' if is_listed else 'removed from'} the directory"
        ),
        event=EVENT_UPDATED,
        subject_type="Partner",
        subject_id=partner.id,
        actor=actor,
        properties={"is_listed": is_listed},
    )
    return decorate(partner, actor)


def delete_partner(db: Session, partner_id: str, actor: User) -> None:
    """Delete an empty partner organisation.

    Refuses while any user still belongs to it. The FK is `ON DELETE SET NULL`,
    so the database would happily orphan them into looking like Leapswitch staff
    — `partner_id IS NULL` is exactly what "staff" means — which is a privilege
    change disguised as a cleanup.
    """
    partner = get_or_404(db, Partner, partner_id, label="Partner")

    if not can_delete(actor, partner):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "You may not delete this partner."
        )

    member_count = (
        db.scalar(
            select(func.count(User.id)).where(User.partner_id == partner.id)
        )
        or 0
    )
    if member_count:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"This partner still has {member_count} user"
            f"{'s' if member_count != 1 else ''}. Move or remove them first.",
        )

    # Snapshot BEFORE the delete: afterwards the row is gone, and an entry
    # saying only "deleted <uuid>" answers nothing later.
    activity_service.record_deleted(
        db,
        subject_type="Partner",
        subject_id=partner.id,
        values={
            "name": partner.name,
            "slug": partner.slug,
            "status": partner.status,
            "verification_level": partner.verification_level,
            "tier": partner.tier_name,
        },
        actor=actor,
        label=partner.name,
    )

    db.delete(partner)
    db.commit()


# --- Tiers ------------------------------------------------------------------


def list_tiers(db: Session, *, include_inactive: bool = False) -> list[PartnerTier]:
    stmt = select(PartnerTier).order_by(PartnerTier.sort_order, PartnerTier.id)
    if not include_inactive:
        stmt = stmt.where(PartnerTier.is_active.is_(True))
    return list(db.scalars(stmt))


def update_tier(
    db: Session, tier_id: int, data: UpdatePartnerTierRequest, actor: User
) -> PartnerTier:
    """Change what a tier grants.

    `name` is not editable — it is the key `core/partner_tiers.py` references,
    and the next seed would rename it back, leaving the database and the code
    disagreeing in between.
    """
    tier = get_or_404(db, PartnerTier, tier_id, label="Partner tier")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(tier, field, value)

    db.commit()
    db.refresh(tier)

    activity_service.record(
        db,
        description=f"Updated partner tier '{tier.display_name}'",
        event=EVENT_UPDATED,
        subject_type="PartnerTier",
        subject_id=str(tier.id),
        actor=actor,
    )
    return tier
