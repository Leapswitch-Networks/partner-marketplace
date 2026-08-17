"""The seam a domain package registers itself through.

**Why this exists.** `CORE_EXTRACTION_PLAN.md` § 1 measured five places where
the partner directory reaches into the platform layer. Three of them were one
big literal each — `PERMISSION_CATALOG`, `ROLE_PERMISSION_MATRIX` and
`navigation_service.build_sections` — mixing core groups with domain groups in a
single dict. Lifting the core into a second project meant hand-editing all three
and hoping nothing was missed.

Now the core owns its entries and a domain **adds** its own. Deleting
`app/domain/` from a fresh copy of this repo yields a working platform with no
partner vocabulary anywhere in it, and that property is what
`tests/test_core_extraction.py` asserts.

## The import rule that keeps this working

This module imports **nothing from `app`**. `core/permissions.py` imports
`app.domain` to trigger registration, so anything the domain imports must sit
below `core/permissions.py` in the graph:

    core/roles.py      ← no imports at all
    core/registry.py   ← this file, no app imports
    core/nav.py        ← no app imports
        ↑
    app/domain/…       ← imports the three above, never core/permissions
        ↑
    core/permissions.py ← imports app.domain, then materialises the catalogs

Adding `from app.core.permissions import …` to a domain module reintroduces the
cycle this layering exists to prevent. Import from `app.core.roles` instead.

## Registration is boot-time and one-way

There is no `unregister`. The catalogs are materialised once, by
`core/permissions.py` at import, and are read-only from then on — a registry
that could change under a running application would mean the permission list
depended on when you asked.
"""

from __future__ import annotations

from typing import Any

# --- Storage ----------------------------------------------------------------
#
# Module-level mutable state, which is normally a smell. It is correct here for
# the same reason a plugin registry always is: registration happens exactly once,
# during import, before anything reads it.

#: group name -> (display name, display order, module, [(permission, label)])
_PERMISSION_GROUPS: dict[str, tuple[str, int, str, list[tuple[str, str]]]] = {}

#: role name -> "*" | [permission, …]. Domains APPEND to a core role's list.
_ROLE_GRANTS: dict[str, list[str] | str] = {}

#: role name -> description. Only for roles a domain registers; core roles carry
#: theirs in `core/roles.py`.
_ROLE_DESCRIPTIONS: dict[str, str] = {}

#: The role assigned to a self-registering EXTERNAL account (a partner here, a
#: customer or a supplier in the next project). `None` means the core default.
_DEFAULT_EXTERNAL_ROLE: str | None = None

#: The role assigned to a first-time INTERNAL account — staff arriving by SSO.
_DEFAULT_INTERNAL_ROLE: str | None = None


# --- Registration -----------------------------------------------------------


def register_permission_group(
    name: str,
    display_name: str,
    order: int,
    module: str,
    entries: list[tuple[str, str]],
) -> None:
    """Add a permission group to the catalog.

    Raises on a duplicate name rather than merging. Two groups under one key
    would mean whichever imported last silently won, and the loser's permissions
    would vanish from the roles screen without any error — the exact failure a
    registry is supposed to make impossible.
    """
    if name in _PERMISSION_GROUPS:
        raise ValueError(
            f"Permission group '{name}' is already registered. "
            "Group names are unique across the core and every domain."
        )
    _PERMISSION_GROUPS[name] = (display_name, order, module, list(entries))


def register_role_grants(role: str, permissions: list[str]) -> None:
    """Grant `permissions` to `role`, adding to whatever it already holds.

    **Additive on purpose.** A domain says "Staff may also read partners"; it
    does not restate Staff's whole grant list. Restating would mean the core
    adding a permission to Staff is silently reverted by a domain written before
    it existed.

    A role holding the `"*"` wildcard is left alone — it already has everything,
    and turning it into a concrete list here would freeze it at today's catalog.
    """
    existing = _ROLE_GRANTS.get(role)
    if existing == "*":
        return
    if existing is None:
        _ROLE_GRANTS[role] = list(permissions)
        return
    for permission in permissions:
        if permission not in existing:
            existing.append(permission)


def register_role(role: str, description: str, grants: list[str] | str) -> None:
    """Register a role the core does not ship.

    `Partner` arrives this way. A project with no partner directory never calls
    this and never gets the role — which is the whole point of the seam.
    """
    if role in _ROLE_DESCRIPTIONS:
        raise ValueError(f"Role '{role}' is already registered by another domain.")
    _ROLE_DESCRIPTIONS[role] = description
    if grants == "*":
        _ROLE_GRANTS[role] = "*"
    else:
        register_role_grants(role, list(grants))


def set_default_external_role(role: str) -> None:
    """Name the role a self-registering external account receives."""
    global _DEFAULT_EXTERNAL_ROLE
    _DEFAULT_EXTERNAL_ROLE = role


def set_default_internal_role(role: str) -> None:
    """Name the role a first-time internal (SSO) account receives."""
    global _DEFAULT_INTERNAL_ROLE
    _DEFAULT_INTERNAL_ROLE = role


# --- Reads ------------------------------------------------------------------


def permission_groups() -> dict[str, tuple[str, int, str, list[tuple[str, str]]]]:
    """Every registered group, **in display order**.

    Sorted here rather than at the call site because the order is a property of
    the catalog: `order` is what decides where a domain's group lands among the
    core's, and a caller iterating a dict in insertion order would instead get
    "core first, then whichever domain imported first".
    """
    return dict(sorted(_PERMISSION_GROUPS.items(), key=lambda item: (item[1][1], item[0])))


def role_grants() -> dict[str, list[str] | str]:
    return {role: ("*" if grants == "*" else list(grants)) for role, grants in _ROLE_GRANTS.items()}


def registered_role_descriptions() -> dict[str, str]:
    return dict(_ROLE_DESCRIPTIONS)


def default_external_role(fallback: str) -> str:
    return _DEFAULT_EXTERNAL_ROLE or fallback


def default_internal_role(fallback: str) -> str:
    return _DEFAULT_INTERNAL_ROLE or fallback


def reset_for_tests() -> None:
    """Empty the registry. **Tests only.**

    Named so it cannot be mistaken for part of the runtime contract. Nothing in
    `app/` calls it; `tests/test_core_extraction.py` uses it to prove the core
    still assembles with no domain registered, which is the property that makes
    this repo liftable.
    """
    global _DEFAULT_EXTERNAL_ROLE, _DEFAULT_INTERNAL_ROLE
    _PERMISSION_GROUPS.clear()
    _ROLE_GRANTS.clear()
    _ROLE_DESCRIPTIONS.clear()
    _DEFAULT_EXTERNAL_ROLE = None
    _DEFAULT_INTERNAL_ROLE = None


__all__: list[str] = [
    "register_permission_group",
    "register_role_grants",
    "register_role",
    "set_default_external_role",
    "set_default_internal_role",
    "permission_groups",
    "role_grants",
    "registered_role_descriptions",
    "default_external_role",
    "default_internal_role",
    "reset_for_tests",
]

# Re-exported so a domain module can type its nav entries without reaching for
# `typing` itself. Kept at the bottom: it is a convenience, not part of the API.
NavEntry = dict[str, Any]
