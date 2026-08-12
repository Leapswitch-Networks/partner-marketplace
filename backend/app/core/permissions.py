"""The RBAC vocabulary: system roles, permission groups, and permission names.

This module is the single source of truth. The seeder writes the database from
it, the guards read role names from it, and nothing else should hardcode a role
or permission string.

Naming convention (inherited from LeapDesk):
    permissions   {resource}-{action}, resource SINGULAR, kebab-case
                  e.g. user-view, role-create, api-credential-update
    actions       view | create | update | delete  (+ domain verbs like approve)
"""

# --- System roles -----------------------------------------------------------

ROLE_ROOT = "RootUser"
ROLE_SUPER_ADMIN = "SuperAdmin"
#: Added 2026-08-12 for parity. The reference's engineering role, and it is
#: **privileged, not descriptive**: it sits in the same bypass list as RootUser,
#: so it is a second key to the building rather than a job title. Named after the
#: reference's rather than invented, because an operator who knows one system's
#: role names should not have to learn a second set.
ROLE_BACKEND_DEVELOPER = "BackendDeveloper"
ROLE_ADMIN = "Admin"
#: The reference's commercial role, added 2026-08-12 alongside BackendDeveloper
#: so the role vocabulary matches. **It is not a synonym for `Staff`**: Staff is
#: ours and holds read access across the admin modules; Sales is the reference's
#: and holds four permissions, none of which read another person's records.
ROLE_SALES = "Sales"
ROLE_STAFF = "Staff"
ROLE_PARTNER = "Partner"
ROLE_USER = "User"

#: Bypass every permission check. Kept deliberately tiny.
#:
#: Verified against LeapDesk source on 2026-08-12 — `AppServiceProvider`'s
#: `Gate::before` and `AdminAccess::$superAdminRoles`, which are **both**
#: `['RootUser', 'BackendDeveloper']`. Two notes on how ours differs, both
#: deliberate:
#:
#: 1. **`BackendDeveloper` is added**, matching the reference. Its stated reason
#:    is worth keeping: these roles must never see a 403 from a permission that
#:    has not been seeded into their assignments yet.
#: 2. **`SuperAdmin` stays, where the reference does not bypass for it.** Ours is
#:    documented as emergency and maintenance access and has held the bypass
#:    since the RBAC rebuild; removing it would be a privilege *reduction* to a
#:    live role, made on the strength of a comparison rather than a decision.
#:    In practice the gap is narrow — SuperAdmin holds `"*"` in the matrix, so
#:    the bypass only matters for a permission added but not yet seeded, which is
#:    precisely the case the reference wrote it for.
SUPER_ADMIN_ROLES: frozenset[str] = frozenset(
    {ROLE_ROOT, ROLE_SUPER_ADMIN, ROLE_BACKEND_DEVELOPER}
)

#: "Sees all data" rather than only their own. Drives data-visibility scoping.
#: The reference's `admin_roles()` verbatim: RootUser, SuperAdmin, Admin,
#: BackendDeveloper.
ADMIN_ACCESS_ROLES: frozenset[str] = frozenset(
    {ROLE_ROOT, ROLE_SUPER_ADMIN, ROLE_BACKEND_DEVELOPER, ROLE_ADMIN}
)

#: Cannot be deleted or renamed, and cannot be edited by a non-super-admin.
#:
#: `BackendDeveloper` belongs here for a reason specific to it: **its name is
#: hardcoded in the bypass set above.** A role whose name is a security rule
#: must not be renameable, or the rename silently detaches the rule and the role
#: keeps its label while losing its power — or worse, a new role created under
#: the old name inherits it.
PROTECTED_ROLES: frozenset[str] = frozenset(
    {ROLE_ROOT, ROLE_SUPER_ADMIN, ROLE_BACKEND_DEVELOPER, ROLE_USER}
)

#: Assigned automatically to a self-registering partner.
DEFAULT_PARTNER_ROLE = ROLE_PARTNER

#: Assigned automatically to a self-registering / first-time staff SSO user.
DEFAULT_STAFF_ROLE = ROLE_USER


# --- Permissions ------------------------------------------------------------

# Users
USER_VIEW = "user-view"
USER_CREATE = "user-create"
USER_UPDATE = "user-update"
USER_DELETE = "user-delete"
USER_APPROVE = "user-approve"

# Roles
ROLE_VIEW = "role-view"
ROLE_CREATE = "role-create"
ROLE_UPDATE = "role-update"
ROLE_DELETE = "role-delete"
#: Changing WHAT a role can do, as distinct from its name and description.
#: Split from ROLE_UPDATE deliberately (LeapDesk has the same separation): renaming
#: a role and rewriting its grants are different risk levels, and conflating them
#: means anyone who can tidy up a label can also hand out every permission.
ROLE_PERMISSIONS = "role-permissions"

# Permissions (read-only for everyone but super admins)
PERMISSION_VIEW = "permission-view"

# Invitations
INVITATION_VIEW = "invitation-view"
INVITATION_CREATE = "invitation-create"
INVITATION_RESEND = "invitation-resend"
INVITATION_CANCEL = "invitation-cancel"

# Activity log (PM-32)
ACTIVITY_VIEW = "activity-view"

# Dashboard
DASHBOARD_VIEW = "dashboard-view"

# Application settings — project identity (DYNAMIC_BRANDING_PLAN phase 1)
#
# ⚠️ Listing this in the catalog does NOT make it super-admin-only. ROLE_ADMIN is
# `"*"` in ROLE_PERMISSION_MATRIX below, so every permission added here is granted
# to Admin on the next seed — the same consequence PM-32 hit with `activity-view`.
# The write routes are therefore gated on `require_super_admin` as well, and that
# guard is the actual control. The permission exists so the capability is visible
# in the catalog and on the role permissions page.
SETTINGS_MANAGE = "settings-manage"


# --- The eight-module core (CORE_COMPLETION_PLAN.md) -------------------------
#
# ⚠️ These are named in THIS project's convention — `{resource}-{action}`,
# singular, kebab-case — not the reference implementation's dotted names
# (`data-access.view`, `api-credentials.providers.create`). The mapping is
# recorded below so it stays reversible.
#
# That contradicts one line in LEAPDESK_PARITY_PLAN.md, which is worth being
# explicit about. That document says **both**: § Decisions settled records
# "LeapDesk's dotted names verbatim", while § Open decisions still lists the same
# question as undecided. It contradicts itself, so neither line settles it.
#
# What settles it is this module's own docstring — it calls itself the single
# source of truth, states the convention, and gives `api-credential-update` as
# its example. All 18 existing permissions follow it. Adopting dotted names would
# put two conventions in one catalog, and the roles page renders that catalog.
#
# Permission names are internal identifiers, never shown to a user, so the parity
# contract in CORE_COMPLETION_PLAN.md § 1.1 — which binds *what the user sees and
# can do* — does not require the reference's spelling here. Behaviour is at
# parity; the identifier is ours.
#
#   Reference                            Ours
#   data-access.view                     data-access-view
#   data-access.manage                   data-access-manage
#   api-credentials.index                api-credential-view
#   api-credentials.credentials.*        api-credential-{create,update,delete}
#   api-credentials.providers.*          api-provider-{view,create,update,delete}
#   search.entities.manage               search-entity-manage
#   ai-assistant.use                     ai-assistant-use
#   ai-assistant.query-database          ai-assistant-query-database
#   user-email                           user-email          (already kebab)
#   settings-view / settings-update      same
#
# The reference splits `api-credentials.index` (reach the module) from
# `api-credentials.credentials.index` (list credentials). Both are required to
# use the page, so they are merged into `api-credential-view`. That is the only
# lossy step in the mapping.

# Data Access (module 5)
DATA_ACCESS_VIEW = "data-access-view"
DATA_ACCESS_MANAGE = "data-access-manage"

# API Credentials (module 6)
API_CREDENTIAL_VIEW = "api-credential-view"
API_CREDENTIAL_CREATE = "api-credential-create"
API_CREDENTIAL_UPDATE = "api-credential-update"
API_CREDENTIAL_DELETE = "api-credential-delete"
API_PROVIDER_VIEW = "api-provider-view"
API_PROVIDER_CREATE = "api-provider-create"
API_PROVIDER_UPDATE = "api-provider-update"
API_PROVIDER_DELETE = "api-provider-delete"

# Platform API — machine consumers and their tokens (LeapDesk parity Module 10).
#
# **Token management is separate from consumer editing on purpose**, and it is the
# one line of this permission design that is about security rather than tidiness:
# editing a description and minting standing credentials are not the same act and
# must not ride on one checkbox.
API_CONSUMER_VIEW = "api-consumer-view"
API_CONSUMER_CREATE = "api-consumer-create"
API_CONSUMER_UPDATE = "api-consumer-update"
API_CONSUMER_DELETE = "api-consumer-delete"
API_TOKEN_MANAGE = "api-token-manage"

# Global Search (module 7)
SEARCH_ENTITY_MANAGE = "search-entity-manage"

# AI Assistant (module 8)
AI_ASSISTANT_USE = "ai-assistant-use"
#: Distinct from AI_ASSISTANT_USE on purpose, and the more dangerous of the two:
#: it lets the assistant read the database rather than only converse. The
#: reference separates them for the same reason, and Partner holds neither.
AI_ASSISTANT_QUERY_DATABASE = "ai-assistant-query-database"

# Users — sending mail to an account from the admin UI (module 1 gap)
USER_EMAIL = "user-email"

#: Read and write the application settings surface. Distinct from
#: SETTINGS_MANAGE, which predates these and gates the Branding nav entry
#: specifically. Kept rather than merged: SETTINGS_MANAGE is live in
#: `navigation_service`, and collapsing them would silently widen or narrow who
#: sees that item.
SETTINGS_VIEW = "settings-view"
SETTINGS_UPDATE = "settings-update"

#: Feature flags (LeapDesk parity, Module 13). LeapDesk has one permission,
#: `feature-flags.manage`. Split into view/manage here for the same reason
#: SETTINGS_VIEW and SETTINGS_UPDATE are split: the list is worth reading for
#: anyone debugging why a feature is off for one role, and reading it grants
#: nothing. Merging them would mean the only way to see which flags exist is to
#: hold the permission that lets you switch them.
FEATURE_FLAG_VIEW = "feature-flag-view"
FEATURE_FLAG_MANAGE = "feature-flag-manage"

#: Error tracking (LeapDesk parity, Module 17). Their split is
#: `system.errors.view` / `system.errors.manage` and it is kept: reading which
#: errors are happening is an on-call concern, and **deleting an error group
#: destroys the evidence of a bug** — a different risk level, and the reason this
#: is not one permission.
ERROR_VIEW = "error-view"
ERROR_MANAGE = "error-manage"

#: System health (LeapDesk parity, Module 18). Read-only — there is nothing to
#: manage on that screen, so unlike errors and feature flags it does not split.
HEALTH_VIEW = "health-view"

#: Recycle bin (LeapDesk parity). **One permission, not view/manage.** Seeing
#: what was deleted is nearly as sensitive as restoring it — the list is a
#: record of what somebody tried to remove, and reading it tells you a user
#: existed, what they were called and when they went. LeapDesk makes the same
#: call with a single `system.recycle-bin.manage`.
RECYCLE_BIN_MANAGE = "recycle-bin-manage"


# --- Partner directory (PARTNER_DIRECTORY_PLAN.md phase 1) -------------------
#
# Same `{resource}-{action}` convention, resource singular. The domain verbs are
# split from PARTNER_UPDATE on purpose, and the split is the same one this
# codebase already draws between USER_UPDATE and USER_APPROVE: editing a record
# and changing what it is ALLOWED TO DO are different risk levels.
#
# Three separate verbs rather than one because they gate three different
# consequences, and the plan's § 9 depends on them not collapsing:
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

#: Tiers are reference data seeded from `core/partner_tiers.py`. Viewing them is
#: needed by anyone who can edit a partner (the tier selector); changing what a
#: tier grants is an administrative act of its own.
PARTNER_TIER_VIEW = "partner-tier-view"
PARTNER_TIER_MANAGE = "partner-tier-manage"


#: Permission groups, in display order. The seeder creates these verbatim.
#: Shape: group name -> (display name, display order, module, [(permission, label)])
PERMISSION_CATALOG: dict[str, tuple[str, int, str, list[tuple[str, str]]]] = {
    "dashboard": (
        "Dashboard",
        10,
        "core",
        [
            (DASHBOARD_VIEW, "View dashboard"),
        ],
    ),
    "users": (
        "User Management",
        20,
        "core",
        [
            (USER_VIEW, "View users"),
            (USER_CREATE, "Create users"),
            (USER_UPDATE, "Update users"),
            (USER_DELETE, "Delete users"),
            (USER_APPROVE, "Approve pending users"),
            (USER_EMAIL, "Send email to a user"),
        ],
    ),
    "roles": (
        "Role Management",
        30,
        "core",
        [
            (ROLE_VIEW, "View roles"),
            (ROLE_CREATE, "Create roles"),
            (ROLE_UPDATE, "Update a role's name and description"),
            (ROLE_PERMISSIONS, "Change which permissions a role grants"),
            (ROLE_DELETE, "Delete roles"),
        ],
    ),
    "permissions": (
        "Permissions",
        40,
        "core",
        [
            (PERMISSION_VIEW, "View the permission catalog"),
        ],
    ),
    "invitations": (
        "User Invitations",
        50,
        "core",
        [
            (INVITATION_VIEW, "View invitations"),
            (INVITATION_CREATE, "Send invitations"),
            (INVITATION_RESEND, "Resend invitations"),
            (INVITATION_CANCEL, "Cancel invitations"),
        ],
    ),
    "activity": (
        "Activity Log",
        60,
        "core",
        [
            (ACTIVITY_VIEW, "View the activity log"),
        ],
    ),
    "settings": (
        "Application Settings",
        70,
        "core",
        [
            (SETTINGS_MANAGE, "Change the application's name, monogram and branding"),
            (SETTINGS_VIEW, "View the application settings"),
            (SETTINGS_UPDATE, "Change the application settings"),
            (FEATURE_FLAG_VIEW, "View feature flags and who they are on for"),
            (FEATURE_FLAG_MANAGE, "Create, change and switch feature flags"),
            (ERROR_VIEW, "View recorded application errors"),
            (ERROR_MANAGE, "Triage, resolve and delete recorded errors"),
            (HEALTH_VIEW, "View system health"),
            (RECYCLE_BIN_MANAGE, "Restore or permanently remove deleted records"),
        ],
    ),
    "partners": (
        "Partner Directory",
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
    ),
    # --- The four modules still to be built --------------------------------
    #
    # Seeded ahead of their code deliberately. Nothing in modules 5–8 can be
    # gated until the permissions exist, so seeding them first means each module
    # starts with its guards available rather than adding a migration and a
    # re-seed halfway through. They grant access to routes that do not exist
    # yet, which is harmless — a permission with no route behind it is inert.
    "data-access": (
        "Data Access",
        80,
        "core",
        [
            (DATA_ACCESS_VIEW, "View data access grants"),
            (DATA_ACCESS_MANAGE, "Grant and revoke data access"),
        ],
    ),
    "api-credentials": (
        "API Credentials",
        90,
        "core",
        [
            (API_CREDENTIAL_VIEW, "View stored credentials (values stay masked)"),
            (API_CREDENTIAL_CREATE, "Add a credential"),
            (API_CREDENTIAL_UPDATE, "Change a credential"),
            (API_CREDENTIAL_DELETE, "Delete a credential"),
            (API_PROVIDER_VIEW, "View integration providers"),
            (API_PROVIDER_CREATE, "Add an integration provider"),
            (API_PROVIDER_UPDATE, "Change an integration provider"),
            (API_PROVIDER_DELETE, "Delete an integration provider"),
        ],
    ),
    "search": (
        "Global Search",
        100,
        "core",
        [
            (SEARCH_ENTITY_MANAGE, "Choose which records are searchable"),
        ],
    ),
    "ai-assistant": (
        "AI Assistant",
        110,
        "core",
        [
            (AI_ASSISTANT_USE, "Use the assistant"),
            (AI_ASSISTANT_QUERY_DATABASE, "Let the assistant query the database"),
        ],
    ),
    "platform-api": (
        "Platform API",
        120,
        "core",
        [
            (API_CONSUMER_VIEW, "View the systems permitted to call our API"),
            (API_CONSUMER_CREATE, "Register a new system"),
            (API_CONSUMER_UPDATE, "Edit a system, and switch its access off"),
            (API_CONSUMER_DELETE, "Remove a system and every token it holds"),
            # Read the description twice: this one mints standing, unattended
            # credentials for a third party. It is separate from the four above
            # so it can be withheld from someone who may administer the list.
            (API_TOKEN_MANAGE, "Issue and revoke API tokens"),
        ],
    ),
}


#: Which permissions each system role receives on seed.
#: "*" is a wildcard meaning every permission in the catalog.
ROLE_PERMISSION_MATRIX: dict[str, list[str] | str] = {
    ROLE_ROOT: "*",
    ROLE_SUPER_ADMIN: "*",
    # Holds every permission explicitly AND bypasses the check, which is
    # belt-and-braces on purpose: the grant is what the Roles screen shows a
    # reader, and the bypass is what survives a permission added after the last
    # seed. Neither alone gives both properties.
    ROLE_BACKEND_DEVELOPER: "*",
    ROLE_ADMIN: "*",
    # The reference's `Sales` grants, ported name for name:
    # dashboard-view, settings-view, settings-update, ai-assistant.use.
    # **Deliberately narrow, and worth not widening by reflex** — it holds no
    # `user-view`, so a salesperson cannot read the staff directory, and no
    # `ai-assistant-query-database`, so the assistant will converse with them but
    # not read records for them. Both omissions are the reference's.
    ROLE_SALES: [
        DASHBOARD_VIEW,
        SETTINGS_VIEW,
        SETTINGS_UPDATE,
        AI_ASSISTANT_USE,
    ],
    ROLE_STAFF: [
        DASHBOARD_VIEW,
        USER_VIEW,
        ROLE_VIEW,
        PERMISSION_VIEW,
        INVITATION_VIEW,
        INVITATION_CREATE,
        # Resend and cancel go with create. Staff could previously send an
        # invitation and then neither resend nor cancel it: they are not in
        # ADMIN_ACCESS_ROLES, so they see only their own rows, and held no
        # permission to act on them. That is an incoherent set — the ability to
        # start something without the ability to correct it.
        #
        # Safe to grant because `_get_owned_or_404` scopes both actions to
        # invitations the actor sent, and returns the same 404 for someone
        # else's rather than a 403 that would confirm it exists.
        INVITATION_RESEND,
        INVITATION_CANCEL,
        # Matching the reference's grants for the new modules: Staff may see what
        # data access has been granted, and may converse with the assistant.
        # It gets neither DATA_ACCESS_MANAGE (granting access is an admin act)
        # nor AI_ASSISTANT_QUERY_DATABASE (that reads the database).
        DATA_ACCESS_VIEW,
        AI_ASSISTANT_USE,
        # Read-only on the directory, matching Staff's posture everywhere else.
        # Deliberately NOT approve/verify/publish: each of those either grants
        # login to an organisation, hands out Leapswitch's credibility, or
        # publishes to the anonymous internet.
        PARTNER_VIEW,
        PARTNER_TIER_VIEW,
    ],
    ROLE_PARTNER: [
        DASHBOARD_VIEW,
        # A partner user may read their OWN organisation. This permission alone
        # grants nothing across organisations — row scoping does that, and it
        # does not exist yet (PM-5). Until it does, every partner-facing read
        # path must filter on the actor's partner_id itself; see
        # partner_service.list_partners.
        PARTNER_VIEW,
    ],
    ROLE_USER: [
        DASHBOARD_VIEW,
    ],
}


#: Human-readable descriptions, used by the seeder and surfaced in the roles UI.
ROLE_DESCRIPTIONS: dict[str, str] = {
    ROLE_ROOT: "System owner. Bypasses every permission check. Cannot be deleted or edited.",
    ROLE_SUPER_ADMIN: "Emergency and maintenance access. Bypasses every permission check.",
    ROLE_BACKEND_DEVELOPER: (
        "Engineering access. Bypasses every permission check and sees all data — "
        "a second key to the building, not a job title."
    ),
    ROLE_ADMIN: "Full management access across the platform. Sees all data.",
    ROLE_SALES: (
        "Commercial team. Dashboard, their own settings, and the assistant — "
        "no access to other people's records."
    ),
    ROLE_STAFF: "Internal staff. Read access across modules, may invite users.",
    ROLE_PARTNER: "External partner. Sees only their own records.",
    ROLE_USER: "Default role for a new account. Dashboard only.",
}


def all_permission_names() -> list[str]:
    """Every permission in the catalog, in catalog order."""
    names: list[str] = []
    for _display, _order, _module, entries in sorted(
        PERMISSION_CATALOG.values(), key=lambda group: group[1]
    ):
        names.extend(name for name, _label in entries)
    return names
