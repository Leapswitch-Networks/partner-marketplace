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
ROLE_ADMIN = "Admin"
ROLE_STAFF = "Staff"
ROLE_PARTNER = "Partner"
ROLE_USER = "User"

#: Bypass every permission check. Kept deliberately tiny.
SUPER_ADMIN_ROLES: frozenset[str] = frozenset({ROLE_ROOT, ROLE_SUPER_ADMIN})

#: "Sees all data" rather than only their own. Drives data-visibility scoping.
ADMIN_ACCESS_ROLES: frozenset[str] = frozenset({ROLE_ROOT, ROLE_SUPER_ADMIN, ROLE_ADMIN})

#: Cannot be deleted or renamed, and cannot be edited by a non-super-admin.
PROTECTED_ROLES: frozenset[str] = frozenset({ROLE_ROOT, ROLE_SUPER_ADMIN, ROLE_USER})

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
}


#: Which permissions each system role receives on seed.
#: "*" is a wildcard meaning every permission in the catalog.
ROLE_PERMISSION_MATRIX: dict[str, list[str] | str] = {
    ROLE_ROOT: "*",
    ROLE_SUPER_ADMIN: "*",
    ROLE_ADMIN: "*",
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
    ],
    ROLE_PARTNER: [
        DASHBOARD_VIEW,
    ],
    ROLE_USER: [
        DASHBOARD_VIEW,
    ],
}


#: Human-readable descriptions, used by the seeder and surfaced in the roles UI.
ROLE_DESCRIPTIONS: dict[str, str] = {
    ROLE_ROOT: "System owner. Bypasses every permission check. Cannot be deleted or edited.",
    ROLE_SUPER_ADMIN: "Emergency and maintenance access. Bypasses every permission check.",
    ROLE_ADMIN: "Full management access across the platform. Sees all data.",
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
