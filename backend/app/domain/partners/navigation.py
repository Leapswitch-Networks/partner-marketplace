"""The Partner Directory sidebar section, registered into the core nav.

Moved out of `services/navigation_service.py` on 2026-08-17. The section, its
ordering and its two items are unchanged; what changed is that the core service
no longer names them.
"""

from __future__ import annotations

from app.core.nav import nav_item, register_nav_section
from app.domain.partners.permissions import (
    CATEGORY_MANAGE,
    ENQUIRY_VIEW,
    LISTING_VIEW,
    MODERATION_REVIEW,
    ORGANISATION_MANAGE,
    PARTNER_TIER_VIEW,
    PARTNER_VIEW,
)

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
            # --- Added 2026-08-18 -------------------------------------------
            #
            # The comment above this section promised it "will grow listings,
            # moderation and enquiries as the later phases land". Those phases
            # landed on 2026-08-18 and the pages shipped **unreachable** — eleven
            # routes that worked only if you typed the URL. Reported by the owner,
            # which is the wrong way to find out.
            #
            # Every item is permission-gated, so one section serves both
            # audiences: a partner sees their own listings, enquiries and
            # organisation; staff see the same listings and enquiries plus
            # moderation and the taxonomy. Nobody sees a link they cannot use.

            # Both audiences. One route, scoped by the API.
            nav_item(
                "Listings",
                "/dashboard/listings",
                "listings",
                LISTING_VIEW,
                active_prefixes=["/dashboard/listings"],
            ),
            nav_item(
                "Enquiries",
                "/dashboard/enquiries",
                "enquiries",
                ENQUIRY_VIEW,
                active_prefixes=["/dashboard/enquiries"],
            ),
            # Staff only. `MODERATION_REVIEW` is not granted to partners, because
            # a partner approving their own listing would make the queue
            # decorative.
            nav_item(
                "Moderation",
                "/dashboard/moderation",
                "moderation",
                MODERATION_REVIEW,
            ),
            # Staff only, on `CATEGORY_MANAGE` rather than `CATEGORY_VIEW`:
            # partners hold the view permission so they can pick a category for a
            # listing, but the taxonomy is ours to edit (§ 6.2) and a read-only
            # link into an admin screen is just a dead end.
            nav_item(
                "Service Categories",
                "/dashboard/categories",
                "configuration",
                CATEGORY_MANAGE,
            ),
            # Partner only, and gated twice. `ORGANISATION_MANAGE` exists
            # precisely so these three can be hidden from staff, who would
            # otherwise follow them to a 404. But the permission alone was not
            # enough: **Admin holds 65 of them, including this one**, and belongs
            # to no organisation — so it saw all three links and every one of them
            # led to a page whose only possible answer was "your account is not
            # attached to an organisation". `requires_organisation` is the second
            # gate, and it is the honest one: these pages need an organisation to
            # resolve, which is a fact about the account, not about its permissions.
            nav_item(
                "Your Organisation",
                "/dashboard/organisation",
                "partners",
                ORGANISATION_MANAGE,
                # Without this the item would not highlight on the branding
                # sub-page, and "Partners" above shares the /dashboard/partner
                # prefix — so both are pinned explicitly.
                active_prefixes=["/dashboard/organisation"],
                requires_organisation=True,
            ),
            nav_item(
                "Logo & Banner",
                "/dashboard/organisation/branding",
                "branding",
                ORGANISATION_MANAGE,
                exact=True,
                requires_organisation=True,
            ),
            nav_item(
                "Your Team",
                "/dashboard/team",
                "users",
                ORGANISATION_MANAGE,
                active_prefixes=["/dashboard/team"],
                requires_organisation=True,
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
