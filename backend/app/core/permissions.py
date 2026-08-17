"""The RBAC vocabulary: **the core's permissions, plus whatever a domain registers.**

This module is still the single source of truth that the seeder writes the
database from, the guards read role names from, and the roles UI renders. What
changed on 2026-08-17 (`CORE_EXTRACTION_PLAN.md` phase 1) is that it is now an
*assembly point* rather than one big literal:

* **Role names** live in `core/roles.py` and are re-exported here, so the
  forty-odd `from app.core.permissions import ROLE_ADMIN` call sites are
  unaffected.
* **Core permissions** are declared and registered below, exactly as before.
* **Domain permissions** — the nine `PARTNER_*`, the `Partner` role, its grant to
  `Staff` — now live in `app/domain/partners/permissions.py` and arrive through
  `core/registry.py`.

`PERMISSION_CATALOG`, `ROLE_PERMISSION_MATRIX` and `ROLE_DESCRIPTIONS` are still
plain module-level dicts with the same shapes. They are materialised at the
bottom of this file, after the domain import has run.

**Deleting `app/domain/` leaves a working platform** with no partner vocabulary
in it. That is the property `tests/test_core_extraction.py` asserts, and it is
the whole reason for the indirection.

Naming convention (inherited from LeapDesk):
    permissions   {resource}-{action}, resource SINGULAR, kebab-case
                  e.g. user-view, role-create, api-credential-update
    actions       view | create | update | delete  (+ domain verbs like approve)

⚠️ **Do not import this module from anything under `app/domain/`.** The import
below is what makes registration happen, so a domain importing back would be a
cycle. Domain modules import `app.core.roles` and `app.core.registry` instead.
"""

from __future__ import annotations

from app.core import registry

# Re-exported for backwards compatibility — these are DEFINED in `core/roles.py`.
from app.core.roles import (  # noqa: F401
    ADMIN_ACCESS_ROLES,
    CORE_ROLE_DESCRIPTIONS,
    PROTECTED_ROLES,
    ROLE_ADMIN,
    ROLE_BACKEND_DEVELOPER,
    ROLE_ROOT,
    ROLE_SALES,
    ROLE_STAFF,
    ROLE_SUPER_ADMIN,
    ROLE_USER,
    SUPER_ADMIN_ROLES,
)

# Imported for its registration side effects. Must come AFTER `core.roles` and
# `core.registry` above, and must be the only `app.` import in this file that is
# not from `app.core`.
#
# **Optional, and the narrowness of the except clause is the whole point.**
# `CORE_EXTRACTION_PLAN.md` claims you can delete `app/domain/` and still have a
# working platform. A hard import makes that false — verified 2026-08-17 by
# actually deleting the directory, which is a check the unit test could not make
# because it stubs the module in `sys.modules`.
#
# A bare `except ImportError` would be much worse than the hard import: a typo
# inside a domain module raises ImportError too, so the whole domain would
# silently vanish from the catalog and the only symptom would be missing
# permissions. Comparing `exc.name` distinguishes "there is no domain package"
# from "the domain package is broken", and re-raises the second.
try:  # noqa: E402
    import app.domain  # noqa: F401  isort:skip
except ModuleNotFoundError as exc:  # pragma: no cover - exercised by deleting the package
    if exc.name != "app.domain":
        raise

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
# `"*"` in the matrix below, so every permission added here is granted to Admin on
# the next seed — the same consequence PM-32 hit with `activity-view`. The write
# routes are therefore gated on `require_super_admin` as well, and that guard is
# the actual control. The permission exists so the capability is visible in the
# catalog and on the role permissions page.
SETTINGS_MANAGE = "settings-manage"


# --- The eight-module core (CORE_COMPLETION_PLAN.md) -------------------------
#
# ⚠️ These are named in THIS project's convention — `{resource}-{action}`,
# singular, kebab-case — not the reference implementation's dotted names
# (`data-access.view`, `api-credentials.providers.create`). The mapping is
# recorded below so it stays reversible.
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
#: reference separates them for the same reason.
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
#: nothing.
FEATURE_FLAG_VIEW = "feature-flag-view"
FEATURE_FLAG_MANAGE = "feature-flag-manage"

#: Error tracking (LeapDesk parity, Module 17). Their split is
#: `system.errors.view` / `system.errors.manage` and it is kept: reading which
#: errors are happening is an on-call concern, and **deleting an error group
#: destroys the evidence of a bug** — a different risk level.
ERROR_VIEW = "error-view"
ERROR_MANAGE = "error-manage"

#: System health (LeapDesk parity, Module 18). Read-only — there is nothing to
#: manage on that screen, so unlike errors and feature flags it does not split.
HEALTH_VIEW = "health-view"

#: Recycle bin (LeapDesk parity). **One permission, not view/manage.** Seeing
#: what was deleted is nearly as sensitive as restoring it — the list is a
#: record of what somebody tried to remove, and reading it tells you a user
#: existed, what they were called and when they went.
RECYCLE_BIN_MANAGE = "recycle-bin-manage"


# --- Core catalog registration ------------------------------------------------
#
# Shape: group name -> (display name, display order, module, [(permission, label)])
#
# Orders are spaced by ten so a domain can slot a group between two core ones
# without renumbering. The partner directory registers at 75, which is exactly
# where its group sat when this was one literal.

_CORE_PERMISSION_GROUPS: list[tuple[str, str, int, str, list[tuple[str, str]]]] = [
    ("dashboard", "Dashboard", 10, "core", [
        (DASHBOARD_VIEW, "View dashboard"),
    ]),
    ("users", "User Management", 20, "core", [
        (USER_VIEW, "View users"),
        (USER_CREATE, "Create users"),
        (USER_UPDATE, "Update users"),
        (USER_DELETE, "Delete users"),
        (USER_APPROVE, "Approve pending users"),
        (USER_EMAIL, "Send email to a user"),
    ]),
    ("roles", "Role Management", 30, "core", [
        (ROLE_VIEW, "View roles"),
        (ROLE_CREATE, "Create roles"),
        (ROLE_UPDATE, "Update a role's name and description"),
        (ROLE_PERMISSIONS, "Change which permissions a role grants"),
        (ROLE_DELETE, "Delete roles"),
    ]),
    ("permissions", "Permissions", 40, "core", [
        (PERMISSION_VIEW, "View the permission catalog"),
    ]),
    ("invitations", "User Invitations", 50, "core", [
        (INVITATION_VIEW, "View invitations"),
        (INVITATION_CREATE, "Send invitations"),
        (INVITATION_RESEND, "Resend invitations"),
        (INVITATION_CANCEL, "Cancel invitations"),
    ]),
    ("activity", "Activity Log", 60, "core", [
        (ACTIVITY_VIEW, "View the activity log"),
    ]),
    ("settings", "Application Settings", 70, "core", [
        (SETTINGS_MANAGE, "Change the application's name, monogram and branding"),
        (SETTINGS_VIEW, "View the application settings"),
        (SETTINGS_UPDATE, "Change the application settings"),
        (FEATURE_FLAG_VIEW, "View feature flags and who they are on for"),
        (FEATURE_FLAG_MANAGE, "Create, change and switch feature flags"),
        (ERROR_VIEW, "View recorded application errors"),
        (ERROR_MANAGE, "Triage, resolve and delete recorded errors"),
        (HEALTH_VIEW, "View system health"),
        (RECYCLE_BIN_MANAGE, "Restore or permanently remove deleted records"),
    ]),
    ("data-access", "Data Access", 80, "core", [
        (DATA_ACCESS_VIEW, "View data access grants"),
        (DATA_ACCESS_MANAGE, "Grant and revoke data access"),
    ]),
    ("api-credentials", "API Credentials", 90, "core", [
        (API_CREDENTIAL_VIEW, "View stored credentials (values stay masked)"),
        (API_CREDENTIAL_CREATE, "Add a credential"),
        (API_CREDENTIAL_UPDATE, "Change a credential"),
        (API_CREDENTIAL_DELETE, "Delete a credential"),
        (API_PROVIDER_VIEW, "View integration providers"),
        (API_PROVIDER_CREATE, "Add an integration provider"),
        (API_PROVIDER_UPDATE, "Change an integration provider"),
        (API_PROVIDER_DELETE, "Delete an integration provider"),
    ]),
    ("search", "Global Search", 100, "core", [
        (SEARCH_ENTITY_MANAGE, "Choose which records are searchable"),
    ]),
    ("ai-assistant", "AI Assistant", 110, "core", [
        (AI_ASSISTANT_USE, "Use the assistant"),
        (AI_ASSISTANT_QUERY_DATABASE, "Let the assistant query the database"),
    ]),
    ("platform-api", "Platform API", 120, "core", [
        (API_CONSUMER_VIEW, "View the systems permitted to call our API"),
        (API_CONSUMER_CREATE, "Register a new system"),
        (API_CONSUMER_UPDATE, "Edit a system, and switch its access off"),
        (API_CONSUMER_DELETE, "Remove a system and every token it holds"),
        # Read the description twice: this one mints standing, unattended
        # credentials for a third party. It is separate from the four above so it
        # can be withheld from someone who may administer the list.
        (API_TOKEN_MANAGE, "Issue and revoke API tokens"),
    ]),
]

for _name, _display, _order, _module, _entries in _CORE_PERMISSION_GROUPS:
    registry.register_permission_group(_name, _display, _order, _module, _entries)


# --- Core role grants ---------------------------------------------------------
#
# "*" is a wildcard meaning every permission in the assembled catalog — resolved
# by the seeder, so it picks up domain permissions too.

registry.register_role(ROLE_ROOT, CORE_ROLE_DESCRIPTIONS[ROLE_ROOT], "*")
registry.register_role(ROLE_SUPER_ADMIN, CORE_ROLE_DESCRIPTIONS[ROLE_SUPER_ADMIN], "*")
# Holds every permission explicitly AND bypasses the check, which is
# belt-and-braces on purpose: the grant is what the Roles screen shows a reader,
# and the bypass is what survives a permission added after the last seed. Neither
# alone gives both properties.
registry.register_role(
    ROLE_BACKEND_DEVELOPER, CORE_ROLE_DESCRIPTIONS[ROLE_BACKEND_DEVELOPER], "*"
)
registry.register_role(ROLE_ADMIN, CORE_ROLE_DESCRIPTIONS[ROLE_ADMIN], "*")

# The reference's `Sales` grants, ported name for name. **Deliberately narrow,
# and worth not widening by reflex** — it holds no `user-view`, so a salesperson
# cannot read the staff directory, and no `ai-assistant-query-database`, so the
# assistant will converse with them but not read records for them. Both omissions
# are the reference's.
registry.register_role(
    ROLE_SALES,
    CORE_ROLE_DESCRIPTIONS[ROLE_SALES],
    [DASHBOARD_VIEW, SETTINGS_VIEW, SETTINGS_UPDATE, AI_ASSISTANT_USE],
)

registry.register_role(
    ROLE_STAFF,
    CORE_ROLE_DESCRIPTIONS[ROLE_STAFF],
    [
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
        # data access has been granted, and may converse with the assistant. It
        # gets neither DATA_ACCESS_MANAGE (granting access is an admin act) nor
        # AI_ASSISTANT_QUERY_DATABASE (that reads the database).
        DATA_ACCESS_VIEW,
        AI_ASSISTANT_USE,
        # NOTE: Staff's read access to the partner directory is NOT here — the
        # domain adds it via `register_role_grants`, so a project without that
        # domain gives Staff no partner permissions it cannot use.
    ],
)

registry.register_role(ROLE_USER, CORE_ROLE_DESCRIPTIONS[ROLE_USER], [DASHBOARD_VIEW])


# --- The assembled catalogs ----------------------------------------------------
#
# Materialised once, here, after every registration above and every registration
# `import app.domain` triggered. Read-only from this point — see the note in
# `core/registry.py` on why the registry has no `unregister`.

#: Permission groups, in display order. The seeder creates these verbatim.
#: Shape: group name -> (display name, display order, module, [(permission, label)])
PERMISSION_CATALOG: dict[str, tuple[str, int, str, list[tuple[str, str]]]] = (
    registry.permission_groups()
)

#: Which permissions each role receives on seed. "*" means the whole catalog.
ROLE_PERMISSION_MATRIX: dict[str, list[str] | str] = registry.role_grants()

#: Human-readable descriptions, used by the seeder and surfaced in the roles UI.
ROLE_DESCRIPTIONS: dict[str, str] = registry.registered_role_descriptions()

#: Assigned automatically to a self-registering EXTERNAL account. The core's
#: fallback is `User` (dashboard only); `app/domain/partners` overrides it to
#: `Partner`. Named for the account class rather than for this project's domain,
#: which is what makes it survive into the next one.
DEFAULT_EXTERNAL_ROLE: str = registry.default_external_role(ROLE_USER)

#: Assigned automatically to a first-time INTERNAL account arriving via SSO.
DEFAULT_INTERNAL_ROLE: str = registry.default_internal_role(ROLE_USER)


def all_permission_names() -> list[str]:
    """Every permission in the catalog, in catalog order."""
    names: list[str] = []
    for _display, _order, _module, entries in PERMISSION_CATALOG.values():
        names.extend(name for name, _label in entries)
    return names
