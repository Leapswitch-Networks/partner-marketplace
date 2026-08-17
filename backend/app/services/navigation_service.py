"""Backend-driven sidebar navigation.

Ported from LeapDesk's `app/Services/NavigationService.php`. The tree is built and
permission-filtered **on the server**, so the frontend renders what it receives
rather than maintaining a parallel copy of the permission rules.

**Why invert this at all.** PM's sidebar previously hardcoded every item in
`Sidebar.tsx` with its own `can("user-view")` call. That is a second source of
truth for authorization: an item can be shown that the API refuses, or hidden that
it would allow, and the two drift silently because nothing compares them. It also
made per-role navigation preferences impossible — the client cannot know another
role's stored preference. LeapDesk solved both the same way, and its comment is
worth keeping: *to add or remove a nav item, edit ONLY this file*.

**Hiding a link is not a security control.** Every route is independently gated by
`require_permission`; this only decides what is worth showing. An item omitted here
and reached by typing the URL still returns 403.

**Icons are names, not markup.** The server sends `"users"`; the client owns the
SVG. Sending markup would put presentation in the API and make a restyle a backend
deploy.
"""

from typing import Any

from sqlalchemy.orm import Session

from app.core.nav import (
    collapsible_sections,
    nav_item,
    register_collapsible_section,
    registered_sections as _registered_nav_sections,
)
from app.core.permissions import (
    ACTIVITY_VIEW,
    API_CONSUMER_VIEW,
    API_CREDENTIAL_VIEW,
    DASHBOARD_VIEW,
    DATA_ACCESS_VIEW,
    ERROR_VIEW,
    HEALTH_VIEW,
    INVITATION_VIEW,
    RECYCLE_BIN_MANAGE,
    ROLE_VIEW,
    SEARCH_ENTITY_MANAGE,
    SETTINGS_MANAGE,
    SETTINGS_VIEW,
    USER_VIEW,
)
from app.models.user import User
from app.services import activity_service

#: `nav_item` moved to `core/nav.py` on 2026-08-17 so a domain package can build
#: entries without importing this service — `CORE_EXTRACTION_PLAN.md` phase 1, and
#: the layering note in `core/registry.py`. Aliased rather than renamed at every
#: call site below: the body of `build_sections` is otherwise unchanged, which is
#: what makes the refactor reviewable.
_item = nav_item

#: The core's own collapsible sections, registered at import so they land in the
#: same catalog a domain registers into. `register_nav_section` adds a domain's
#: entry automatically when its section declares `collapsible`.
#:
#: Registered in the order `build_sections` emits them, so the toggle list on the
#: role page reads top-to-bottom like the sidebar it configures. Lookups are by
#: key, so the order is presentation only — but letting it drift is exactly the
#: drift this catalog exists to prevent. The unlabelled Dashboard section is
#: deliberately absent: it has no label and is never a candidate for collapsing.
for _key, _label in (
    ("user-management", "User Management"),
    ("system-settings", "System Settings"),
    ("operations", "Operations"),
):
    register_collapsible_section(_key, _label)


#: Where each core section sits. Spaced by ten so a domain can slot between two
#: without renumbering — `app/domain/partners/navigation.py` registers at 15,
#: which puts Partner Directory second, under Dashboard and above User Management
#: (owner's call, 2026-08-17).
CORE_SECTION_ORDER: dict[str, int] = {
    "administration": 10,
    "user-management": 20,
    "system-settings": 30,
    "operations": 40,
}


def collapsible_section_catalog() -> dict[str, str]:
    """Core sections plus every section a domain registered.

    **A function, where this used to be a module-level dict.** A domain's entry
    is added during `import app.domain`, which `core/permissions.py` triggers —
    and a dict frozen at this module's import time could be read before that had
    run, silently dropping the domain's sections from the role-preferences UI.
    """
    return collapsible_sections()


def default_nav_preferences() -> dict[str, dict[str, bool]]:
    """The behaviour before per-role customisation existed.

    Used by the seeder to backfill existing roles, and by `get_navigation` as the
    fallback when none of a user's roles carry preferences.
    """
    return {key: {"collapsible": True} for key in collapsible_section_catalog()}


def _section_key_from_label(label: str) -> str:
    """Label → catalog slug.

    Kept inline rather than reaching for a slug helper so the catalog stays the
    only thing that decides these keys — a locale-sensitive slugifier changing
    behaviour under us is not a risk worth taking for three lookups.
    """
    return label.lower().replace(" ", "-")


def resolve_nav_preferences(user: User) -> dict[str, dict[str, bool]]:
    """Merge the preferences of every role the user holds.

    Iterates the roles **reversed** and merges, so the *first* role listed on the
    user wins on conflicts — matching LeapDesk, where Spatie returns the most
    recently assigned role first. Roles with no stored preferences contribute the
    global default rather than nothing, so a partially-configured estate still
    produces a complete answer.
    """
    merged = default_nav_preferences()

    for role in reversed(list(user.roles)):
        stored = getattr(role, "nav_preferences", None)
        if not isinstance(stored, dict):
            continue
        for key, value in stored.items():
            if key in merged and isinstance(value, dict):
                merged[key] = {**merged[key], **value}

    return merged


def build_sections(user: User) -> list[dict[str, Any]]:
    """Assemble every section — the core's own, plus every domain's — before
    permission filtering.

    Grouping follows LeapDesk; the ORDER no longer does. **Order is now a number,
    not a list position**: `CORE_SECTION_ORDER` places the core's four, and a
    domain calls `register_nav_section(..., order=N)` to slot in between them.
    That is what lets `app/domain/partners` put Partner Directory second (15,
    between Dashboard's 10 and User Management's 20) without editing this file —
    `CORE_EXTRACTION_PLAN.md` phase 1.

    `collapsible` here is the default; `get_navigation` overlays the per-role
    preference on top.

    ⚠️ The rule at the top of this file — *to add or remove a nav item, edit ONLY
    this file* — now reads: edit this file for a **core** item, or the owning
    domain's `navigation.py` for a domain item. There are still exactly two
    places a nav entry can come from, and both are named here.
    """
    core_sections: list[dict[str, Any]] = [
        {
            # Labelled "Administration" here rather than left null.
            #
            # The Sidebar used to hardcode this heading client-side while the
            # server sent `label: None`, which broke the rule at the top of this
            # file — *to add or remove a nav item, edit ONLY this file*. It also
            # produced a visible bug: when the nav fetch fails or returns nothing
            # (an expired session, say), `NavTree` correctly renders no items, but
            # the hardcoded heading had nothing to hide it, so the sidebar showed
            # a lone "Administration" over empty space.
            #
            # Not collapsible, and deliberately absent from
            # the collapsible catalog, so having a label does not make it a
            # candidate for the per-role collapse preference.
            "label": "Administration",
            "key": "administration",
            "collapsible": False,
            "items": [
                _item("Dashboard", "/dashboard", "dashboard", DASHBOARD_VIEW, exact=True),
            ],
        },
        {
            "label": "User Management",
            "key": "user-management",
            "collapsible": True,
            "items": [
                # One conceptual item over the module's four routes — index,
                # create, show and edit — which is what `_item`'s
                # `active_prefixes` is for. "Add User" used to be a second nav
                # entry, duplicating a button that sits directly above the table
                # the moment you arrive.
                #
                # Moved to `/dashboard/users` on 2026-08-07 with the
                # Index/Form/Show migration (CORE_COMPLETION_PLAN.md § 2.3). The
                # two old paths still resolve — they are 307 redirects, kept
                # because they are in bookmarks and in the dashboard's Add User
                # quick action — and stay listed here so a user who follows one
                # sees Users highlighted rather than nothing.
                _item(
                    "Users",
                    "/dashboard/users",
                    "users",
                    USER_VIEW,
                    active_prefixes=[
                        "/dashboard/users",
                        "/dashboard/all-users",
                        "/dashboard/add-user",
                    ],
                ),
                _item("Roles & Permissions", "/dashboard/roles", "roles", ROLE_VIEW),
                # LeapDesk parity Module 6. Sits here rather than under System
                # Settings because it is about who may see whose records —
                # the same question the two items above answer.
                _item("Data Access", "/dashboard/data-access", "dataAccess", DATA_ACCESS_VIEW),
                # Invitations is NOT here. LeapDesk files it under System
                # Settings, and on reflection that is the better reading: this
                # section is about people who already exist and what they may
                # see. An invitation is a pending grant, which is configuration.
                _item("Activity Log", "/dashboard/activity", "activity", ACTIVITY_VIEW),
            ],
        },
        {
            "label": "System Settings",
            "key": "system-settings",
            "collapsible": True,
            # Filling up as the parity modules land — API Credentials, Invitations,
            # Global Search, AI Assistant still to come. An empty section is dropped
            # by `filter_sections`, so this rendered nothing until Branding arrived.
            "items": [
                # Gated on SETTINGS_MANAGE so the entry is hidden from anyone who
                # cannot use it. Note the route itself is guarded by
                # `require_super_admin` — because ROLE_ADMIN holds the `"*"`
                # wildcard, this permission alone would show the link to every
                # Admin, and they would reach a 403. Both layers are needed: this
                # one for the nav, that one for the authorisation.
                # Branding is ours, not LeapDesk's — its installation identity
                # lives in config files. Filed here because it is the same kind of
                # thing as the rest of this section: settings for the whole
                # installation rather than for one person.
                #
                # Gated on SETTINGS_MANAGE so the entry is hidden from anyone who
                # cannot use it. The route itself is guarded by
                # `require_super_admin` — because ROLE_ADMIN holds the `"*"`
                # wildcard, this permission alone would show the link to every
                # Admin, and they would reach a 403. Both layers are needed.
                _item("Branding", "/dashboard/branding", "branding", SETTINGS_MANAGE),
                # LeapDesk parity Module 11. Gated on SETTINGS_VIEW, **not**
                # SETTINGS_MANAGE: the Configuration screen is readable by anyone
                # who may see settings, and the write is separately gated on
                # SETTINGS_UPDATE at the endpoint. Branding above uses MANAGE
                # because it has no read-only mode — the page *is* the editor.
                #
                # **Feature Flags is deliberately not a nav item of its own.**
                # LeapDesk reaches it from a button in the Configuration header
                # and lists `/settings/feature-flags` among Configuration's
                # `activePrefixes`, so Configuration stays highlighted while you
                # are on it. Two sibling entries for one settings surface is a
                # longer sidebar that says less; this is the same call `_item`'s
                # `active_prefixes` already makes for the four Users routes.
                _item(
                    "Configuration",
                    "/dashboard/configuration",
                    "configuration",
                    SETTINGS_VIEW,
                    active_prefixes=["/dashboard/configuration", "/dashboard/feature-flags"],
                ),
                # LeapDesk parity Module 12. Same gate as Configuration — it is a
                # filtered view of the same rows, so anyone who may read settings
                # may read these. The write is gated separately on
                # SETTINGS_UPDATE, and the endpoint refuses anything outside the
                # `security.` namespace whatever the permission says.
                _item("Security", "/dashboard/security", "security", SETTINGS_VIEW),
                _item(
                    "API Credentials",
                    "/dashboard/api-credentials",
                    "apiCredentials",
                    API_CREDENTIAL_VIEW,
                    active_prefixes=["/dashboard/api-credentials"],
                ),
                # Moved here from User Management on 2026-08-11 to match LeapDesk.
                # An invitation is a pending grant — configuration — rather than a
                # person who already exists.
                _item(
                    "Invitations",
                    "/dashboard/invitations",
                    "invitations",
                    INVITATION_VIEW,
                    active_prefixes=["/dashboard/invitations"],
                ),
                # "Global Search", not "Search" — LeapDesk's label, and the more
                # accurate one: this configures what the *global* search box looks
                # in, which is a different thing from the search box on every index.
                _item("Global Search", "/dashboard/search", "search", SEARCH_ENTITY_MANAGE),
                # Gated on API_CREDENTIAL_VIEW, not on `ai-assistant-use`, and the
                # difference is the point: this screen turns the integration on
                # and reports what it can reach, which is a credential-management
                # job. *Using* the assistant needs no nav entry at all — it is the
                # widget in the corner of every page.
                _item(
                    "AI Assistant",
                    "/dashboard/ai-assistant",
                    "ai",
                    API_CREDENTIAL_VIEW,
                    active_prefixes=["/dashboard/ai-assistant"],
                ),
                # Next to API Credentials and deliberately NOT merged with it.
                # That screen manages other people's secrets, encrypted so we can
                # send them; this one manages ours, hashed so nobody can read
                # them back. Housing them together would blur an access-control
                # boundary for the sake of both names containing "API".
                _item(
                    "Platform API",
                    "/dashboard/api-consumers",
                    "platformApi",
                    API_CONSUMER_VIEW,
                    active_prefixes=["/dashboard/api-consumers"],
                ),
                # Beside Platform API because a webhook belongs to a consumer —
                # it is the outbound half of the same integration, and gated on
                # the same permission rather than a sixth one.
                _item(
                    "Webhooks",
                    "/dashboard/webhooks",
                    "webhooks",
                    API_CONSUMER_VIEW,
                    active_prefixes=["/dashboard/webhooks"],
                ),
                # Reference material rather than a control surface, so it sits
                # last in the section. Same permission as the two above: it is a
                # map of every route in the application, which is not general
                # staff reading.
                _item(
                    "API Documentation",
                    "/dashboard/api-docs",
                    "apiDocs",
                    API_CONSUMER_VIEW,
                    active_prefixes=["/dashboard/api-docs"],
                ),
            ],
        },
        {
            # LeapDesk's fourth section, added 2026-08-11. It groups the screens
            # that watch the running system rather than configure it — you open
            # these because something is wrong, not because you want to change a
            # setting. Keeping them in System Settings had that distinction
            # collapsed and made a nine-item section.
            #
            # Two of its four are not built: Queue Monitor is blocked (we run no
            # worker) and Recycle Bin is not started. An empty section is dropped
            # by `filter_sections`, so this appears only once something in it does.
            "label": "Operations",
            "key": "operations",
            "collapsible": True,
            "items": [
                # LeapDesk parity Module 17.
                _item("Error Tracking", "/dashboard/errors", "errors", ERROR_VIEW),
                # LeapDesk parity Module 18.
                _item("System Health", "/dashboard/health", "health", HEALTH_VIEW),
                # Beside System Health because it answers the same kind of
                # question — is the running system healthy — and on the same
                # permission. Its own entry rather than a panel on that screen
                # because "the worker is not running" is a distinct failure with
                # its own remedy.
                _item("Background Jobs", "/dashboard/worker", "worker", HEALTH_VIEW),
                # LeapDesk parity. Operations, not System Settings: you open this
                # because something was deleted by mistake.
                _item("Recycle Bin", "/dashboard/recycle-bin", "recycleBin", RECYCLE_BIN_MANAGE),
            ],
        },
    ]

    # Merge the core's sections with every registered domain section, by order.
    #
    # `sorted` is stable, so two sections sharing an order keep core-before-domain
    # — deterministic rather than dependent on import timing. A core section with
    # no entry in CORE_SECTION_ORDER would sort to the end rather than raise:
    # losing a section from the sidebar is a worse failure than showing it last,
    # and the merge is not the right place to police the core's own table.
    ordered: list[tuple[int, dict[str, Any]]] = [
        (CORE_SECTION_ORDER.get(section.get("key", ""), 999), section)
        for section in core_sections
    ]
    ordered.extend(_registered_nav_sections())
    return [section for _order, section in sorted(ordered, key=lambda pair: pair[0])]


def _permitted(user: User, permission: str | list[str] | None) -> bool:
    """Does the user satisfy this item's permission requirement?

    `None` means unrestricted. A list means any-of.
    """
    if permission is None:
        return True
    if isinstance(permission, str):
        return user.has_permission(permission)
    return any(user.has_permission(name) for name in permission)


def _filter_items(user: User, items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Keep the items this user may use, recursing into children.

    A parent with children survives when **any child** does — a group heading whose
    every entry is hidden is noise. A parent whose `href` is a real route is also
    kept on its own permission, so a group that is both a link and a container does
    not vanish because its children happen to be hidden.
    """
    kept: list[dict[str, Any]] = []

    for item in items:
        children = item.get("items")
        if children is not None:
            visible_children = _filter_items(user, children)
            if visible_children:
                kept.append({**item, "items": visible_children})
            elif item["href"] != "#" and _permitted(user, item["permission"]):
                kept.append({k: v for k, v in item.items() if k != "items"})
            continue

        if _permitted(user, item["permission"]):
            kept.append(item)

    return kept


def filter_sections(user: User, sections: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Drop items the user cannot use, then drop sections left empty."""
    result: list[dict[str, Any]] = []

    for section in sections:
        items = _filter_items(user, section["items"])
        if items:
            result.append({**section, "items": items})

    return result


def get_navigation(db: Session, user: User) -> list[dict[str, Any]]:
    """The navigation tree this user should see.

    `db` is accepted for signature stability — the tree is derived from the user's
    already-loaded roles today, and a future section will need to query (a count
    badge, an enabled-integration check) without changing every caller.
    """
    sections = build_sections(user)

    # Overlay the per-role preference on the hardcoded default.
    preferences = resolve_nav_preferences(user)
    for section in sections:
        key = section.get("key")
        if key is None:
            continue
        if key in preferences and "collapsible" in preferences[key]:
            section["collapsible"] = bool(preferences[key]["collapsible"])

    # A super admin bypasses every permission check elsewhere in the app; the nav
    # has to agree, or they would be shown less than they can actually reach.
    if user.is_super_admin:
        return [section for section in sections if section["items"]]

    return filter_sections(user, sections)


# --- Per-role preferences ----------------------------------------------------


def role_nav_preferences(role: Any) -> list[dict[str, Any]]:
    """The role's effective preferences as a full catalog listing.

    Every catalog section is returned, whether or not the role has an override, so
    the UI renders a complete toggle list without having to know the defaults.
    """
    stored = role.nav_preferences if isinstance(role.nav_preferences, dict) else {}
    defaults = default_nav_preferences()

    return [
        {
            "key": key,
            "label": label,
            "collapsible": bool(
                stored.get(key, {}).get("collapsible", defaults[key]["collapsible"])
            ),
        }
        for key, label in collapsible_section_catalog().items()
    ]


def set_role_nav_preferences(
    db: Session, role: Any, preferences: dict[str, dict[str, bool]], actor: User
) -> list[dict[str, Any]]:
    """Replace a role's preferences, keeping only catalog-known sections.

    The schema already rejects unknown keys; filtering again here is defence in
    depth on the *stored shape* rather than on the request — it means the column
    cannot hold junk regardless of how the write arrived. LeapDesk strips the same
    way, and its comment says why: the DB shape stays clean even if a client posts
    additional arbitrary keys.
    """
    clean = {
        key: {"collapsible": bool(flags["collapsible"])}
        for key, flags in preferences.items()
        if key in collapsible_section_catalog() and "collapsible" in flags
    }

    before = role.nav_preferences or {}
    role.nav_preferences = clean
    db.commit()
    db.refresh(role)

    # Cosmetic, but it is still a write to a Role by whoever holds
    # `role-update`, and `record_change` costs nothing when nothing changed.
    activity_service.record_change(
        db,
        subject_type="Role",
        subject_id=str(role.id),
        before={"nav_preferences": before},
        after={"nav_preferences": clean},
        actor=actor,
        label=role.display_name or role.name,
    )

    return role_nav_preferences(role)
