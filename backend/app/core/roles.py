"""The core role vocabulary — **platform roles only, no domain roles.**

Split out of `core/permissions.py` on 2026-08-17 (`CORE_EXTRACTION_PLAN.md`
phase 1) for one structural reason: a domain package has to be able to name a
role in order to register grants against it, and if role names lived in
`core/permissions.py` — which imports the domain to collect its registrations —
that would be an import cycle.

This module therefore imports **nothing**. It is the bottom of the stack, and it
must stay that way.

`core/permissions.py` re-exports every name here, so the forty-odd existing
`from app.core.permissions import ROLE_ADMIN` call sites keep working. New code
may import from either; this one is the definition.

## What belongs here and what does not

A role belongs here if a project with no partner directory, no marketplace and
no listings would still want it. `Admin` and `Staff` pass that test. `Partner`
does not — it is registered by `app/domain/partners/permissions.py` instead, and
a new project built on this core simply never registers it.
"""

from __future__ import annotations

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


#: Human-readable descriptions for the core roles, surfaced in the roles UI.
#: A domain that registers a role supplies its own; see `registry.register_role`.
CORE_ROLE_DESCRIPTIONS: dict[str, str] = {
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
    ROLE_USER: "Default role for a new account. Dashboard only.",
}


__all__ = [
    "ROLE_ROOT",
    "ROLE_SUPER_ADMIN",
    "ROLE_BACKEND_DEVELOPER",
    "ROLE_ADMIN",
    "ROLE_SALES",
    "ROLE_STAFF",
    "ROLE_USER",
    "SUPER_ADMIN_ROLES",
    "ADMIN_ACCESS_ROLES",
    "PROTECTED_ROLES",
    "CORE_ROLE_DESCRIPTIONS",
]
