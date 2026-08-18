"""Partner directory permissions and roles, registered into the core catalog.

Moved out of `core/permissions.py` on 2026-08-17 (`CORE_EXTRACTION_PLAN.md`
phase 1). The constants and their reasoning are unchanged — only their home is.

**Imports `app.core.roles`, never `app.core.permissions`.** See the layering
note in `app/core/registry.py`: `core/permissions.py` imports `app.domain`, so a
domain importing it back would be a cycle.
"""

from __future__ import annotations

from app.core import registry
from app.core.roles import ROLE_STAFF

# --- Permissions -------------------------------------------------------------
#
# Same `{resource}-{action}` convention as the core catalog, resource singular.
# The domain verbs are split from PARTNER_UPDATE on purpose, and the split is the
# same one this codebase already draws between USER_UPDATE and USER_APPROVE:
# editing a record and changing what it is ALLOWED TO DO are different risk
# levels.
#
# Three separate verbs rather than one because they gate three different
# consequences, and `PARTNER_DIRECTORY_PLAN.md` § 9 depends on them not
# collapsing:
#
#   PARTNER_APPROVE  PENDING -> ACTIVE, and suspend/reinstate. Gates LOGIN for
#                    every user in the organisation.
#   PARTNER_VERIFY   Sets verification_level. This is what Leapswitch VOUCHES
#                    for, it is the directory's whole trust proposition (§ 9),
#                    and it ranks above any paid placement. Whoever can grant it
#                    can hand out the platform's credibility.
#   PARTNER_PUBLISH  Flips is_listed. The only permission in this module whose
#                    effect is visible to the anonymous internet.
PARTNER_VIEW = "partner-view"
PARTNER_CREATE = "partner-create"
PARTNER_UPDATE = "partner-update"
PARTNER_DELETE = "partner-delete"
PARTNER_APPROVE = "partner-approve"
PARTNER_VERIFY = "partner-verify"
PARTNER_PUBLISH = "partner-publish"

#: Tiers are reference data seeded from `domain/partners/tiers.py`. Viewing them is
#: needed by anyone who can edit a partner (the tier selector); changing what a
#: tier grants is an administrative act of its own.
PARTNER_TIER_VIEW = "partner-tier-view"
PARTNER_TIER_MANAGE = "partner-tier-manage"

# --- The directory itself, added 2026-08-18 (punchlist 1.9) ------------------
#
# The taxonomy is Leapswitch's, so its verbs are staff-only and there is no
# partner-facing counterpart — § 6.2: a directory whose vocabulary its listers
# can extend is a tag cloud, not a taxonomy.
CATEGORY_VIEW = "category-view"
CATEGORY_MANAGE = "category-manage"

# Listings are partner-authored, so these are held by BOTH partners and staff and
# the difference is enforced by row scoping rather than by a second set of verbs.
#
# LISTING_PUBLISH is deliberately separate from LISTING_UPDATE and is **not**
# granted to partners: authoring and approving are the two halves of moderation,
# and a partner holding both would make the queue decorative. It is the same
# split as PARTNER_UPDATE versus PARTNER_APPROVE above.
LISTING_VIEW = "listing-view"
LISTING_CREATE = "listing-create"
LISTING_UPDATE = "listing-update"
LISTING_DELETE = "listing-delete"
LISTING_PUBLISH = "listing-publish"

# Reviewing the queue is its own permission rather than an alias for
# LISTING_PUBLISH, because approving and rejecting are one job and somebody may
# reasonably be given the queue without being given the ability to publish a
# listing they were never shown.
MODERATION_REVIEW = "moderation-review"

# ENQUIRY_RESPOND is what makes staff oversight safe. Staff get ENQUIRY_VIEW so
# they can measure response rates (§ 16.2); they must NEVER get ENQUIRY_RESPOND,
# because § 20.6.1 forbids staff replying as the partner — a buyer would have no
# way to know who they were talking to.
ENQUIRY_VIEW = "enquiry-view"
ENQUIRY_RESPOND = "enquiry-respond"


# --- Roles -------------------------------------------------------------------

#: The external-account role. **Registered, not core** — a project without a
#: partner directory never calls this module and therefore never gets a role
#: called "Partner". `core/roles.py` ships only the seven platform roles.
ROLE_PARTNER = "Partner"


# --- Registration ------------------------------------------------------------

registry.register_permission_group(
    "partners",
    "Partner Directory",
    # 75 — between the core's `settings` (70) and `data-access` (80), which is
    # where this group sat when it was a literal in the core catalog. Preserved
    # exactly so the roles screen does not reorder under the refactor.
    75,
    "directory",
    [
        (PARTNER_VIEW, "View partner organisations"),
        (PARTNER_CREATE, "Onboard a partner organisation"),
        (PARTNER_UPDATE, "Update a partner's details"),
        (PARTNER_DELETE, "Delete a partner organisation"),
        (PARTNER_APPROVE, "Activate, suspend or reinstate a partner"),
        (PARTNER_VERIFY, "Set a partner's verification level"),
        (PARTNER_PUBLISH, "Publish or unpublish a partner in the directory"),
        (PARTNER_TIER_VIEW, "View partner tiers"),
        (PARTNER_TIER_MANAGE, "Change what a partner tier grants"),
    ],
)

#: The directory's own group. 76 — immediately after "partners" (75), so the
#: roles screen reads company first, then what the company publishes.
registry.register_permission_group(
    "directory",
    "Listings & Enquiries",
    76,
    "directory",
    [
        (CATEGORY_VIEW, "View the service taxonomy"),
        (CATEGORY_MANAGE, "Create, edit and reorder service categories"),
        (LISTING_VIEW, "View service listings"),
        (LISTING_CREATE, "Create a service listing"),
        (LISTING_UPDATE, "Edit a service listing"),
        (LISTING_DELETE, "Delete a service listing"),
        (LISTING_PUBLISH, "Approve or reject a listing for publication"),
        (MODERATION_REVIEW, "Work the moderation queue"),
        (ENQUIRY_VIEW, "View enquiries"),
        (ENQUIRY_RESPOND, "Reply to an enquiry"),
    ],
)

registry.register_role(
    ROLE_PARTNER,
    "External partner. Sees only their own records.",
    [
        # `dashboard-view` is a CORE permission and is named as a string rather
        # than imported, which is the one place this module accepts a literal:
        # importing it would mean importing `core.permissions` and reopening the
        # cycle. The seeder validates every name in this list against the
        # assembled catalog and fails loudly on a typo, so the literal is checked.
        "dashboard-view",
        # A partner user may read their OWN organisation. This permission alone
        # grants nothing across organisations — row scoping does that, and it now
        # exists: see `app/services/scoping.py`.
        PARTNER_VIEW,
        # Their own listings and their own enquiries. Scoping decides *which*;
        # these decide *whether*. Note what is absent: LISTING_PUBLISH, because a
        # partner who could approve their own listing would make moderation a
        # formality, and MODERATION_REVIEW for the same reason.
        CATEGORY_VIEW,
        LISTING_VIEW,
        LISTING_CREATE,
        LISTING_UPDATE,
        LISTING_DELETE,
        ENQUIRY_VIEW,
        ENQUIRY_RESPOND,
    ],
)

#: Read-only on the directory for internal staff, matching Staff's posture
#: everywhere else. Deliberately NOT approve/verify/publish: each of those either
#: grants login to an organisation, hands out Leapswitch's credibility, or
#: publishes to the anonymous internet.
#:
#: Additive — `register_role_grants` appends to whatever the core gave Staff, so
#: a permission the core adds to Staff later is not silently reverted here.
#: Staff read the directory and work the queue. **ENQUIRY_RESPOND is absent and
#: that is the point** — staff may read an enquiry to measure whether it was
#: answered, and may never answer it as the partner (§ 20.6.1).
registry.register_role_grants(
    ROLE_STAFF,
    [
        PARTNER_VIEW,
        PARTNER_TIER_VIEW,
        CATEGORY_VIEW,
        LISTING_VIEW,
        ENQUIRY_VIEW,
    ],
)

#: A self-registering external account becomes a Partner. The core's fallback is
#: `User` (dashboard only), which is what a project without this domain gets.
registry.set_default_external_role(ROLE_PARTNER)


__all__ = [
    "PARTNER_VIEW",
    "PARTNER_CREATE",
    "PARTNER_UPDATE",
    "PARTNER_DELETE",
    "PARTNER_APPROVE",
    "PARTNER_VERIFY",
    "PARTNER_PUBLISH",
    "PARTNER_TIER_VIEW",
    "PARTNER_TIER_MANAGE",
    "CATEGORY_VIEW",
    "CATEGORY_MANAGE",
    "LISTING_VIEW",
    "LISTING_CREATE",
    "LISTING_UPDATE",
    "LISTING_DELETE",
    "LISTING_PUBLISH",
    "MODERATION_REVIEW",
    "ENQUIRY_VIEW",
    "ENQUIRY_RESPOND",
    "ROLE_PARTNER",
]
