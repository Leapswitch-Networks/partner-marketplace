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
