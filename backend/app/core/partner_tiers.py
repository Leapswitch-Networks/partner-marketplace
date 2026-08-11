"""Partner tier reference data, as a constant the seeder writes from.

Same pattern as `permissions.py`: the code names tiers, the database mirrors the
code, and nothing hardcodes a tier string anywhere else. A tier renamed here is
renamed everywhere on the next seed.

## These are LISTING entitlements, not discount authority

`MARKETPLACE_DOMAIN_PLAN.md` specified `partner_tiers` with `discount_percentage`
and `max_self_approve_discount`, because that plan modelled partners **reselling**
Leapswitch services through a quote approval machine. The owner chose the
directory instead on 2026-08-10, and `PARTNER_DIRECTORY_PLAN.md` § 0 keeps this
table while repurposing it: **same table, different numbers.** A tier now answers
"how many listings may this partner publish, and can they be featured?"

The two discount columns are deliberately **not** carried over. Reviving the
reseller channel later would add them back in its own migration rather than
leaving two dead `Numeric` columns implying a pricing feature that does not
exist — the anti-pattern `FASTAPI_STANDARDS.md` § 12 names as live today.

## Naming is deliberately disjoint from `verification_level`

A partner carries both, and they are different axes:

    verification_level   UNVERIFIED | VERIFIED | PREMIER   what Leapswitch vouches for
    tier                 starter | standard | premium      what the partner is entitled to

Reusing "premier"/"premium" across both would be read as one concept. They are
not: § 9 of the directory plan ranks on verification **first** and never lets a
paid tier outrank a verification failure.
"""

from __future__ import annotations

#: `max_listings = None` means unlimited. NULL rather than a -1 sentinel so the
#: "no limit" case is unrepresentable as a wrong number, and so a COALESCE is
#: never needed to compare against it.
#:
#: Shape: name -> (display_name, description, max_listings, featured_slots, sort_order)
PARTNER_TIER_CATALOG: dict[str, tuple[str, str, int | None, int, int]] = {
    "starter": (
        "Starter",
        "Entry tier for a newly onboarded partner. A small catalogue, no featured placement.",
        5,
        0,
        10,
    ),
    "standard": (
        "Standard",
        "The default working tier. Room for a full service catalogue and one featured slot.",
        15,
        1,
        20,
    ),
    "premium": (
        "Premium",
        "Unlimited listings and several featured slots.",
        None,
        5,
        30,
    ),
}

#: Assigned when staff onboard a partner without naming a tier. Must be a key of
#: PARTNER_TIER_CATALOG — asserted at import so a rename cannot leave a dangling
#: default that only fails at the first onboarding.
DEFAULT_PARTNER_TIER = "starter"

assert DEFAULT_PARTNER_TIER in PARTNER_TIER_CATALOG, (
    f"DEFAULT_PARTNER_TIER {DEFAULT_PARTNER_TIER!r} is not in PARTNER_TIER_CATALOG"
)


def all_tier_names() -> list[str]:
    """Every tier name, in display order."""
    return sorted(PARTNER_TIER_CATALOG, key=lambda name: PARTNER_TIER_CATALOG[name][4])
