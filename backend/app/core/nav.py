"""Navigation primitives and the section registry.

Split out of `services/navigation_service.py` on 2026-08-17 so a domain package
can contribute a sidebar section without editing the core service — the same
move `core/registry.py` makes for permissions, and for the same reason.

**Imports nothing from `app`.** `services/navigation_service.py` imports
`core/permissions.py`, which imports `app.domain`, so a domain's navigation
module cannot import the service. It imports this instead. See the layering
diagram in `core/registry.py`.

The `_item` builder lived in the service and is now `nav_item` here, because
both the core sections and every domain section need it.
"""

from __future__ import annotations

from typing import Any

#: Sections an admin may configure as collapsible or always-open, per role, from
#: the role permissions page. Keys are the slugs stored in `roles.nav_preferences`;
#: values are the labels the section emits.
#:
#: Single source of truth for three things that would otherwise drift: the seeder
#: defaults, the toggle list the UI renders, and the overlay step in
#: `get_navigation`. A section that is not in here cannot be collapsed per role —
#: which is why the unlabelled Dashboard section is deliberately absent.
_COLLAPSIBLE_SECTIONS: dict[str, str] = {}

#: Registered domain sections, in the order they were registered. Core sections
#: are NOT held here — `navigation_service` owns those as a literal, and splices
#: these in at the position each one asks for.
_SECTIONS: list[tuple[int, dict[str, Any]]] = []


def nav_item(
    title: str,
    href: str,
    icon: str,
    permission: str | list[str] | None = None,
    *,
    exact: bool = False,
    active_prefixes: list[str] | None = None,
    items: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """One nav entry.

    `permission` accepts a list, meaning *any of* — a landing page that several
    permissions can reach should appear for all of them.

    `active_prefixes` exists because "which item is highlighted" is not always
    "which href matches": `/dashboard/all-users` and `/dashboard/add-user` are two
    routes under one conceptual Users item.
    """
    entry: dict[str, Any] = {
        "title": title,
        "href": href,
        "icon": icon,
        "permission": permission,
        "exact": exact,
        "active_prefixes": active_prefixes or ([href] if href != "#" else []),
    }
    if items is not None:
        entry["items"] = items
    return entry


def register_collapsible_section(key: str, label: str) -> None:
    """Make a section a candidate for the per-role collapse preference.

    Separate from `register_nav_section` because the core's own sections need it
    too, and they are not registered — they are a literal in the service.
    """
    _COLLAPSIBLE_SECTIONS[key] = label


def register_nav_section(section: dict[str, Any], *, order: int) -> None:
    """Add a sidebar section.

    `order` is the sort key against the core's own section positions, which are
    spaced by ten (`navigation_service.CORE_SECTION_ORDER`). The partner
    directory registers at 15 — after Dashboard (10), before User Management (20)
    — which is the owner's 2026-08-17 ordering, now expressed as a number the
    domain owns rather than a literal position in a core list.

    A section that declares `collapsible` is registered as one automatically, so
    a domain cannot add a collapsible section and forget the catalog entry — that
    mismatch would render a collapse toggle the seeder never wrote a default for.
    """
    key = section.get("key")
    if not key:
        raise ValueError("A nav section must carry a 'key' — it is the slug stored in nav_preferences.")
    if any(existing.get("key") == key for _order, existing in _SECTIONS):
        raise ValueError(f"Nav section '{key}' is already registered.")

    _SECTIONS.append((order, section))
    if section.get("collapsible") and section.get("label"):
        register_collapsible_section(key, section["label"])


def registered_sections() -> list[tuple[int, dict[str, Any]]]:
    """Every registered section with its order key. The service does the merge."""
    return list(_SECTIONS)


def collapsible_sections() -> dict[str, str]:
    return dict(_COLLAPSIBLE_SECTIONS)


def reset_for_tests() -> None:
    """Empty the nav registry. **Tests only** — see `registry.reset_for_tests`."""
    _COLLAPSIBLE_SECTIONS.clear()
    _SECTIONS.clear()


__all__ = [
    "nav_item",
    "register_collapsible_section",
    "register_nav_section",
    "registered_sections",
    "collapsible_sections",
    "reset_for_tests",
]
