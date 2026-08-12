"""Schemas for Global Search — the box, and the registry behind it.

`model_class` is typed as a plain `str` here rather than an enum built from the
allowlist. That is deliberate: an enum would make an unknown value a *parsing*
failure, and the message a client got would be pydantic's rather than one naming
the models that are actually allowed. `search_service._validate_writable` raises
a 422 that lists them, and `resolve_model` is the authority at read time either
way.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import Page

#: A route template must contain a placeholder, and must be an app-relative path.
#: Anchoring it to `/` is what stops a row pointing results at another origin —
#: an admin-editable column that ends up in an `href` is a redirect surface.
ROUTE_PATTERN = r"^/[A-Za-z0-9/_\-{}\.]*$"


# --- The search itself -------------------------------------------------------


class SearchHit(BaseModel):
    """One record, already rendered for display.

    Templates are substituted server-side so the client never receives the raw
    row — it gets a title, a subtitle and a URL, and no column it was not meant
    to see rides along in an unused field.
    """

    id: str
    title: str
    subtitle: str | None = None
    url: str
    icon: str | None = None


class SearchGroup(BaseModel):
    group: str
    label: str
    icon: str | None = None
    items: list[SearchHit]


class SearchResponse(BaseModel):
    q: str
    groups: list[SearchGroup]
    #: Record types the caller may not search, by label. **Returned so the box
    #: can say "Partners was not searched" rather than "No results"** — the
    #: reference's own comment says that distinction is what hid a broken
    #: permission from it for two months. Empty for a reader who may see
    #: everything, which is the common case.
    hidden_areas: list[str] = []
    duration_ms: int


# --- The registry ------------------------------------------------------------


class SearchableEntityResponse(BaseModel):
    id: int
    model_class: str
    label: str
    group: str
    icon: str | None
    fields: list[str]
    display_template: str
    subtitle_template: str | None
    route_name: str
    route_param_field: str
    permission: str | None
    enabled: bool
    sort_order: int
    created_at: datetime
    updated_at: datetime

    #: `ok` · `degraded` · `broken`, computed from the allowlist rather than
    #: stored. Parity with the reference's `healthFor`, which is what tells an
    #: administrator that a row has drifted from the schema.
    health: str
    #: Why it is not `ok`. A colour alone does not tell anyone what to fix.
    health_reasons: list[str] = Field(default_factory=list)


class SearchableEntityWriteRequest(BaseModel):
    """Create and update take the same body — the write is a full replace."""

    #: Validated against the service's allowlist, which returns a 422 naming the
    #: models that are permitted. See this module's docstring for why it is not
    #: an enum.
    model_class: str = Field(min_length=1, max_length=150)
    label: str = Field(min_length=1, max_length=100)
    group: str = Field(min_length=1, max_length=64)
    icon: str | None = Field(default=None, max_length=50)
    #: Unknown names are dropped at search time rather than rejected here, so a
    #: renamed column narrows the search instead of blocking every save. The
    #: settings screen reports them as a health warning.
    fields: list[str] = Field(min_length=1)
    display_template: str = Field(min_length=1, max_length=191)
    subtitle_template: str | None = Field(default=None, max_length=191)
    route_name: str = Field(min_length=1, max_length=191, pattern=ROUTE_PATTERN)
    route_param_field: str = Field(default="id", min_length=1, max_length=64)
    permission: str | None = Field(default=None, max_length=100)
    enabled: bool = True
    sort_order: int = 0


class SearchableEntityPage(Page[SearchableEntityResponse]):
    """The standard envelope, plus what the screen needs to render its controls."""

    can_manage: bool
    #: Distinct groups, for the filter dropdown.
    groups: list[str] = Field(default_factory=list)
    #: The model names an administrator may legally choose. Drives the form's
    #: dropdown so a free-text box cannot produce a row that never matches.
    available_models: list[str] = Field(default_factory=list)
