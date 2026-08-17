"""The Partner Directory sidebar section, registered into the core nav.

Moved out of `services/navigation_service.py` on 2026-08-17. The section, its
ordering and its two items are unchanged; what changed is that the core service
no longer names them.
"""

from __future__ import annotations

from app.core.nav import nav_item, register_nav_section
from app.domain.partners.permissions import PARTNER_TIER_VIEW, PARTNER_VIEW

register_nav_section(
    {
        # The directory's supply side — PARTNER_DIRECTORY_PLAN.md § 15 row 2,
        # the staff UI over the phase-1 backend. Its own section rather than a
        # row under User Management: a partner is an ORGANISATION, and the
        # section will grow listings, moderation and enquiries around it as the
        # later phases land.
        "label": "Partner Directory",
        "key": "partner-directory",
        "collapsible": True,
        "items": [
            nav_item(
                "Partners",
                "/dashboard/partners",
                "partners",
                PARTNER_VIEW,
                active_prefixes=["/dashboard/partners"],
            ),
            # Reference data, not a module: what each tier entitles. Its own
            # top-level path — NOT /dashboard/partners/tiers — because the
            # Partners item highlights on the /dashboard/partners prefix, and a
            # nested path would light both rows at once.
            nav_item(
                "Partner Tiers",
                "/dashboard/partner-tiers",
                "partnerTiers",
                PARTNER_TIER_VIEW,
            ),
        ],
    },
    # **Second, directly under Dashboard (10) and above User Management (20)** —
    # owner's call, 2026-08-17. It sat below User Management until then, which
    # ordered the nav by how the platform is administered rather than by what it
    # is for. The partner directory IS the product; user and role admin is
    # plumbing underneath it, so the plumbing goes below.
    #
    # Expressed as a number the domain owns rather than a position in a core
    # list, which is the whole point of the seam: reordering this section is now
    # a one-line change here, not an edit to `navigation_service`.
    order=15,
)
