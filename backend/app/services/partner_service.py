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

## Row scoping — PM-5, closed 2026-08-17

`list_partners` and `get_partner_for` used to filter on the actor's organisation
**by hand**, which `MARKETPLACE_DOMAIN_PLAN.md` § Row-Level Scoping rule 1
explicitly forbids: *"never write `where(organisation_id == ...)` in a
service."* The rule was right and unenforceable, because the module it named did
not exist.

It does now. This module **registers** its ownership rule with
`app/services/scoping.py` (see below) and both call sites go through
`apply_scope` / `assert_can_read`. Nothing here compares an organisation id
itself any more, and `tests/test_scoping.py` covers every branch the hand-rolled
version spelled out.

The filter still reaches the SQL rather than post-filtering the page, which is
the half of the rule that matters most: post-filtering corrupts the count and
the caller is told there are 40 rows and handed 12 (`FASTAPI_STANDARDS.md` § 12).
"""

from __future__ import annotations

import re
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import Select, and_, func, select
from sqlalchemy.orm import Session

from app.core.crud import get_or_404
from app.core.query import ListParams, ListSpec, run_list
from app.domain.partners.permissions import (
    PARTNER_APPROVE,
    PARTNER_DELETE,
    PARTNER_PUBLISH,
    PARTNER_UPDATE,
    PARTNER_VERIFY,
)
from app.domain.partners.tiers import DEFAULT_PARTNER_TIER
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
from app.services import (
    activity_service,
    enquiry_service,
    listing_service,
    scoping,
    session_service,
    webhook_service,
)

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

# --- Row scoping (PM-5) ------------------------------------------------------
#
# **A partner IS the organisation**, so its own primary key is the owner column.
# Not a special case: the organisation's row is owned by the organisation.
#
# The public predicate requires BOTH `is_listed` and `status == ACTIVE`, matching
# `Partner.publicly_visible`. Either alone publishes the wrong rows — `is_listed`
# on a SUSPENDED organisation leaves a row claiming to be published that is not,
# and ACTIVE alone would publish every partner the moment it was activated.
#
# Registered here rather than in `scoping.py` so the core module names no domain
# model; `tests/test_core_extraction.py` enforces that.
scoping.register_scope(
    Partner,
    owner_column=Partner.id,
    public_predicate=and_(Partner.is_listed.is_(True), Partner.status == "ACTIVE"),
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


def _writable_or_404(db: Session, partner_id: str, actor: User) -> Partner:
    """Fetch a partner for a **write**, refusing another organisation's row.

    Closes TECH_DEBT PM-46. Reads went through `scoping.assert_can_read` from the
    day PM-5 was closed; the five id-taking writes fetched with a bare
    `get_or_404` and then checked a permission, so nothing in the write path ever
    consulted the tenancy registration that `Partner` carries.

    ## Why this was safe and is still worth fixing

    It was never exploitable in the shipped configuration: `partner-update`,
    `-delete`, `-approve` and `-verify` reach only the four wildcard admin roles,
    and no account holding one of those has an `organisation_id`.
    `tests/test_partner_write_permissions.py` turns that fact into an enforced
    invariant. But it *was* a fact about configuration rather than about code, and
    a role edit could have undone it silently — the read path would have refused a
    row the write path would happily have changed.

    ## 404, not 403

    Same reason as `get_partner_for`: a 403 confirms the row exists, and in a
    directory that discloses a competitor before they are published.
    `assert_within_tenant` raises 404 and says nothing, so a wrong-tenant write
    is indistinguishable from a partner id that was never real.

    ## Staff and admins are unaffected

    `assert_within_tenant` returns immediately for `has_admin_access` or a NULL
    `organisation_id`, which is every account that holds these permissions today.
    So this changes no behaviour now — it removes the dependency on that staying
    true. It is the same helper `user_service.update_user` already uses, rather
    than a second way of expressing the rule.
    """
    partner = get_or_404(db, Partner, partner_id, label="Partner")
    scoping.assert_within_tenant(partner, Partner, actor)
    return partner


# --- Predicates (one source of truth for both the flags and the writes) ------


def can_edit(actor: User, partner: Partner) -> bool:
    return actor.has_permission(PARTNER_UPDATE)


def can_delete(actor: User, partner: Partner) -> bool:
    # A partner user can never delete their own organisation, whatever they hold.
    if actor.organisation_id == partner.id:
        return False
    return actor.has_permission(PARTNER_DELETE)


def can_change_status(actor: User, partner: Partner) -> bool:
    # Changing your own organisation's status is self-approval, and the ACTIVE
    # case would let a partner lift their own suspension.
    if actor.organisation_id == partner.id:
        return False
    return actor.has_permission(PARTNER_APPROVE)


def can_verify(actor: User, partner: Partner) -> bool:
    if actor.organisation_id == partner.id:
        return False
    return actor.has_permission(PARTNER_VERIFY)


def can_publish(actor: User, partner: Partner) -> bool:
    return actor.has_permission(PARTNER_PUBLISH)


def decorate(partner: Partner, actor: User, *, user_count: int) -> Partner:
    """Attach the per-row flags and counts the schemas read.

    ⚠️ **`user_count` has no default, deliberately.** It used to default to 0, and
    six of the eight call sites relied on that default — so every write route and
    `/partners/me` reported an organisation as having zero members. Seeding the
    first partner logins on 2026-08-18 made it visible: an owner opened their own
    organisation and was told nobody was in it. A default of 0 for a count is a
    wrong answer that reads exactly like a correct one.
    """
    partner.can_edit = can_edit(actor, partner)
    partner.can_delete = can_delete(actor, partner)
    partner.can_change_status = can_change_status(actor, partner)
    partner.can_verify = can_verify(actor, partner)
    partner.can_publish = can_publish(actor, partner)
    partner.user_count = user_count
    return partner


# --- Reads ------------------------------------------------------------------


def _user_count(db: Session, partner: Partner) -> int:
    """Members of one partner. For the single-row paths; the list path batches."""
    return _user_counts(db, [partner.id]).get(partner.id, 0)


def _user_counts(db: Session, partner_ids: list[str]) -> dict[str, int]:
    """Members per partner, in one query rather than one per row."""
    if not partner_ids:
        return {}
    rows = db.execute(
        select(User.organisation_id, func.count(User.id))
        .where(User.organisation_id.in_(partner_ids))
        .group_by(User.organisation_id)
    ).all()
    return {partner_id: count for partner_id, count in rows}


def get_partner_for(db: Session, partner_id: str, actor: User) -> Partner:
    """One partner the actor is allowed to see, or 404.

    **404, never 403**, when a partner user asks for another organisation — a 403
    confirms the row exists, which in a directory tells one partner that a
    competitor is on the platform before it is published.
    """
    partner = get_or_404(db, Partner, partner_id, label="Partner")

    # PM-5 closed 2026-08-17: one rule, in `scoping.py`, instead of a hand-rolled
    # comparison here. It raises 404 rather than 403 for the same reason the old
    # code did — a 403 confirms the row exists.
    scoping.assert_can_read(partner, Partner, actor)

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

    # PM-5 closed 2026-08-17. Every branch this used to spell out by hand — admin
    # sees all, a member sees their own organisation, an internal account without
    # admin access sees NOTHING rather than everything — now lives in one place
    # and is covered by `tests/test_scoping.py`.
    stmt = scoping.apply_scope(stmt, Partner, actor)

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
    return decorate(partner, actor, user_count=_user_count(db, partner))


def update_partner(
    db: Session, partner_id: str, data: UpdatePartnerRequest, actor: User
) -> Partner:
    """Edit a partner's details.

    Cannot touch status, verification or publication — those are absent from the
    schema and have their own endpoints. `slug` is not editable at all: it is the
    public URL, and changing it breaks every inbound link.
    """
    partner = _writable_or_404(db, partner_id, actor)

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
    return decorate(partner, actor, user_count=_user_count(db, partner))


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
    partner = _writable_or_404(db, partner_id, actor)

    if not can_change_status(actor, partner):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "You may not change this partner's status.",
        )

    if data.status == partner.status:
        return decorate(partner, actor, user_count=_user_count(db, partner))

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
            db.scalars(select(User.id).where(User.organisation_id == partner.id))
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
    return decorate(partner, actor, user_count=_user_count(db, partner))


def set_verification(
    db: Session, partner_id: str, level: str, actor: User
) -> Partner:
    """Set what Leapswitch vouches for.

    Separate from `update_partner` because this is the directory's entire trust
    proposition (`PARTNER_DIRECTORY_PLAN.md` § 9) — whoever can set it is handing
    out Leapswitch's credibility, and § 9 ranks it above any paid placement.
    """
    partner = _writable_or_404(db, partner_id, actor)

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
    return decorate(partner, actor, user_count=_user_count(db, partner))


def set_listed(db: Session, partner_id: str, is_listed: bool, actor: User) -> Partner:
    """Publish or unpublish a partner in the directory.

    The only write in this module whose effect is visible to the anonymous
    internet, which is why it holds its own permission. Publishing requires the
    organisation to be ACTIVE — `publicly_visible` demands both, and allowing the
    flag to be set on a suspended partner would leave a row that claims to be
    published and is not, which is worse than refusing.
    """
    partner = _writable_or_404(db, partner_id, actor)

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
    return decorate(partner, actor, user_count=_user_count(db, partner))


def delete_partner(db: Session, partner_id: str, actor: User) -> None:
    """Delete an empty partner organisation.

    Refuses while any user still belongs to it. The FK is `ON DELETE SET NULL`,
    so the database would happily orphan them into looking like Leapswitch staff
    — `organisation_id IS NULL` is exactly what an internal account is — a privilege
    change disguised as a cleanup.
    """
    partner = _writable_or_404(db, partner_id, actor)

    if not can_delete(actor, partner):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "You may not delete this partner."
        )

    member_count = (
        db.scalar(
            select(func.count(User.id)).where(User.organisation_id == partner.id)
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


# --- The partner's own organisation — punchlist 3.2 / 3.4 --------------------


def get_own_organisation(db: Session, actor: User) -> Partner:
    """The caller's own partner record.

    **Reads `actor.organisation_id`, never a path parameter.** That is the whole
    security model of the "my organisation" screens: there is no id to tamper
    with, so there is no scoping check to forget. A route taking `/partners/{id}`
    and checking it matches the actor would be one forgotten comparison away from
    letting anyone edit anyone.
    """
    if actor.organisation_id is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "Your account is not attached to an organisation.",
        )
    partner = db.get(Partner, actor.organisation_id)
    if partner is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Organisation not found")
    return decorate(partner, actor, user_count=_user_count(db, partner))


def own_overview(db: Session, actor: User) -> dict[str, object]:
    """The partner landing page's numbers, computed here rather than in a browser.

    Replaces three list calls and four client-side reductions. The reductions were
    each wrong in a way that rendered cleanly:

    * `items.length` was reported as the total, so a partner with more listings
      than the page size was told they had exactly the page size.
    * `unanswered` was recomputed from `first_responded_at`, which since PM-47 is
      **not** the server's rule — spam is excluded there. So the partner's own
      dashboard would have gone on counting junk against them after the fix.
    * 200 rows were fetched to render four numbers.

    Entitlement is included because § 20.6.1 asks for "listings against
    entitlement" and it was the one item of that four never rendered — the data
    has existed since 2026-08-20 with no consumer outside the moderation queue.

    Four queries: the organisation, the listing counts, the enquiry counts, and
    the published count entitlement needs. No route here loops.
    """
    partner = get_own_organisation(db, actor)

    counts = listing_service.status_counts(db, partner.id)
    # Reuse the count already taken rather than making `entitlement` fetch it
    # again — it takes `published` for exactly this reason.
    entitlement = listing_service.entitlement(
        db, partner, published=counts["PUBLISHED"]
    )

    return {
        "organisation_name": partner.name,
        "status": partner.status,
        "is_listed": partner.is_listed,
        "verification_level": partner.verification_level,
        "entitlement": entitlement,
        "listings": {
            "draft": counts["DRAFT"],
            "pending_review": counts["PENDING_REVIEW"],
            "published": counts["PUBLISHED"],
            "rejected": counts["REJECTED"],
        },
        "enquiries": enquiry_service.partner_metrics(db, partner.id),
    }


def update_own_organisation(db: Session, partner: Partner, *, actor: User, **fields) -> Partner:
    """Update the public half of a partner's own record.

    ⚠️ **The fields a partner may write are an allowlist, not an exclusion list.**
    `status`, `verification_level`, `is_listed`, `tier_id`, `notes`, `gst_number`
    and `pan_number` are all absent — each is either staff's judgement about the
    partner or internal, and an exclusion list is one new column away from
    leaking write access to it.
    """
    writable = {
        "name",
        "tagline",
        "about",
        "website",
        "public_email",
        "public_phone",
        "founded_year",
        "employee_range",
        "city",
        "state",
        "country",
        "postal_code",
        "service_areas",
    }
    for field, value in fields.items():
        if field in writable and value is not None:
            setattr(partner, field, value)
    partner.updated_by = actor.id
    db.flush()
    return partner


def set_expertise(db: Session, partner: Partner, category_ids: list[int]) -> Partner:
    """Replace what a partner advertises expertise in.

    Replaces rather than diffs: the form submits the whole selection, and the
    pivot rows are two integers each.

    **This is what makes the public filter work.** A category chosen here is a
    foreign key the directory index joins on — which is why partners pick from
    the taxonomy rather than typing, and why this takes ids rather than names.
    """
    from app.models.service_category import ServiceCategory

    categories = (
        db.execute(select(ServiceCategory).where(ServiceCategory.id.in_(category_ids)))
        .scalars()
        .all()
        if category_ids
        else []
    )
    partner.expertise = list(categories)
    db.flush()
    return partner


# --- Brand assets — punchlist 3.3 -------------------------------------------


def set_brand_asset(db: Session, partner: Partner, *, asset: str, data: bytes) -> Partner:
    """Store a validated logo or banner on the partner's own row.

    **Validation is `core/images.py`'s, not a second copy.** That module refuses
    anything over 512 KB before parsing it, checks magic bytes rather than the
    claimed content type or the filename, caps dimensions, and scans SVG for
    script, embedded HTML, external references and DOCTYPEs — refusing rather than
    stripping, because silently rewriting somebody's logo produces a file they did
    not upload.

    A second validator here would be a second thing to keep in agreement with the
    first, and the first is the one that has been thought about.

    ⚠️ `ImageValidationError` is translated to a 422 with the module's own message.
    Those messages deliberately never echo the filename or the claimed MIME type
    back — the whole point is that neither was trusted.
    """
    from app.core import images

    if asset not in ("logo", "banner"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Unknown asset {asset!r}.")

    try:
        validated = images.validate(data, asset=asset)
    except images.ImageValidationError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc

    now = datetime.now(timezone.utc)
    if asset == "logo":
        partner.logo_mime = validated.mime
        partner.logo_bytes = validated.data
        partner.logo_updated_at = now
    else:
        partner.banner_mime = validated.mime
        partner.banner_bytes = validated.data
        partner.banner_updated_at = now
    db.flush()
    return partner


def clear_brand_asset(db: Session, partner: Partner, *, asset: str) -> Partner:
    """Remove an asset.

    Clears the timestamp too, so the serving route's validator changes and any
    cached copy of the old image is invalidated rather than lingering.
    """
    if asset == "logo":
        partner.logo_mime = None
        partner.logo_bytes = None
        partner.logo_updated_at = None
    elif asset == "banner":
        partner.banner_mime = None
        partner.banner_bytes = None
        partner.banner_updated_at = None
    else:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Unknown asset {asset!r}.")
    db.flush()
    return partner


def brand_asset(partner: Partner, asset: str) -> tuple[bytes, str, datetime] | None:
    """The stored bytes, mime and timestamp, or None when unset."""
    if asset == "logo" and partner.logo_bytes and partner.logo_mime:
        return partner.logo_bytes, partner.logo_mime, partner.logo_updated_at
    if asset == "banner" and partner.banner_bytes and partner.banner_mime:
        return partner.banner_bytes, partner.banner_mime, partner.banner_updated_at
    return None
