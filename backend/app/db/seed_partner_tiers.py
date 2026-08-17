"""Seed the partner tier reference data.

Idempotent, and safe to re-run after every deploy: it reconciles `partner_tiers`
against `app.domain.partners.tiers.PARTNER_TIER_CATALOG`, which is the source of
truth. Same contract `seed_rbac` has with `app.core.permissions`.

Usage (from backend/):
    python -m app.db.seed_partner_tiers

Or, on the Docker path — `run`, not `exec`, so the entrypoint rewrites
DATABASE_URL (ONBOARDING § 4.3):

    docker compose run --rm backend python -m app.db.seed_partner_tiers

## What it will and will not do

A tier present in the catalog is created, or updated in place to match it. A tier
in the database that is **not** in the catalog is left completely alone — it is
either an administrator's own row or a rename in progress, and deleting it would
orphan every partner on it. `partners.tier_id` is `ON DELETE SET NULL`, so a
silent delete would quietly demote real organisations to the most restrictive
entitlement, which is exactly the kind of change nobody notices until a partner
complains their listings vanished.

Kept out of `seed_rbac` deliberately. That module seeds RBAC and the bootstrap
account; tiers are directory reference data with a different lifecycle, and
`AGENTS.md` § Core Principles asks for one responsibility per file.
"""

import sys

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.domain.partners.tiers import PARTNER_TIER_CATALOG
from app.models.partner_tier import PartnerTier


def seed_partner_tiers(db: Session) -> dict[str, PartnerTier]:
    """Create or update every tier in the catalog. Returns them by name."""
    by_name: dict[str, PartnerTier] = {}
    created = 0

    for name, (
        display_name,
        description,
        max_listings,
        featured_slots,
        sort_order,
    ) in PARTNER_TIER_CATALOG.items():
        tier = db.scalar(select(PartnerTier).where(PartnerTier.name == name))
        if tier is None:
            tier = PartnerTier(name=name)
            db.add(tier)
            created += 1

        tier.display_name = display_name
        tier.description = description
        tier.max_listings = max_listings
        tier.featured_slots = featured_slots
        tier.sort_order = sort_order
        # Re-activated on purpose: a tier that is back in the catalog is meant to
        # be assignable again. Deactivating one is done by removing it from the
        # catalog and flipping the flag by hand, not by this seeder.
        tier.is_active = True

        by_name[name] = tier

    db.commit()
    for tier in by_name.values():
        db.refresh(tier)

    unknown = db.scalars(
        select(PartnerTier.name).where(PartnerTier.name.notin_(PARTNER_TIER_CATALOG))
    ).all()

    print(
        f"[seed] partner tiers: {len(by_name)} in catalog "
        f"({created} created, {len(by_name) - created} updated)"
    )
    if unknown:
        print(
            f"[seed] partner tiers: left alone, not in the catalog: {', '.join(unknown)}"
        )

    return by_name


def seed() -> None:
    db = SessionLocal()
    try:
        seed_partner_tiers(db)
        print("[seed] done")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
    sys.exit(0)
