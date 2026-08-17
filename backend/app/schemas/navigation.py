"""Schemas for the server-driven sidebar."""

from pydantic import BaseModel, Field, field_validator

from app.services.navigation_service import collapsible_section_catalog


class NavigationItem(BaseModel):
    """One sidebar entry.

    `permission` is echoed back for debuggability — the server has already filtered
    on it, so the client never needs to evaluate it. Being able to see *why* an item
    is present is worth the handful of bytes.
    """

    title: str
    #: `"#"` for a group heading that only contains children.
    href: str
    #: An icon *name*; the client owns the markup. See the service docstring.
    icon: str
    permission: str | list[str] | None = None
    #: Match the pathname exactly rather than by prefix. Needed for `/dashboard`,
    #: which would otherwise be "active" on every page beneath it.
    exact: bool = False
    #: Pathname prefixes that should highlight this item — one conceptual item can
    #: own several routes.
    active_prefixes: list[str] = Field(default_factory=list)
    items: list["NavigationItem"] | None = None


class NavigationSection(BaseModel):
    """A group of items, optionally labelled."""

    #: `None` for the unlabelled first section (Dashboard).
    label: str | None = None
    #: Catalog slug, `None` when unlabelled. This is what `nav_preferences` keys on.
    key: str | None = None
    collapsible: bool = False
    items: list[NavigationItem]


class NavigationResponse(BaseModel):
    sections: list[NavigationSection]


class UpdateNavPreferencesRequest(BaseModel):
    """Per-role sidebar preferences.

    Validated against the catalog here **and** filtered again in the service, which
    is not redundant: this rejects a bad request loudly, and the service guarantees
    the stored shape even if a future caller bypasses this schema. LeapDesk does the
    same two-step for the same reason.
    """

    preferences: dict[str, dict[str, bool]]

    @field_validator("preferences")
    @classmethod
    def _known_sections_only(
        cls, value: dict[str, dict[str, bool]]
    ) -> dict[str, dict[str, bool]]:
        catalog = collapsible_section_catalog()
        unknown = sorted(set(value) - set(catalog))
        if unknown:
            raise ValueError(
                f"Unknown navigation section(s): {', '.join(unknown)}. "
                f"Known sections: {', '.join(sorted(catalog))}"
            )
        for key, flags in value.items():
            if "collapsible" not in flags:
                raise ValueError(f"Section '{key}' must specify 'collapsible'")
        return value


class NavSectionOption(BaseModel):
    """One row of the catalog, for the toggle list on the role permissions page."""

    key: str
    label: str
    collapsible: bool


class NavPreferencesResponse(BaseModel):
    """The role's effective preferences, every catalog section present.

    Always returns the full catalog rather than only what is stored, so the UI can
    render a complete toggle list without knowing the defaults.
    """

    sections: list[NavSectionOption]
