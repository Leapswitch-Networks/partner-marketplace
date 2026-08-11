"""Schemas for the Feature Flags module.

`key` carries a pattern rather than being a free string. The reference validates
only `unique` + `max:150`, so it accepts a key with a space or a quote in it —
which then has to be typed exactly into every `feature_enabled(...)` call site
forever. That is a defect rather than behaviour, nothing a user can see depends
on it, and the cost of diverging is one 422 on a key nobody should be writing.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import Page

#: Lowercase words separated by `.`, `_` or `-`. Matches the shape the reference
#: uses in its own placeholder (`presales.overview_first`) and in every seeded
#: key, without accepting the ones it would also have allowed.
KEY_PATTERN = r"^[a-z0-9]+([._-][a-z0-9]+)*$"


class FeatureFlagResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    key: str
    name: str
    description: str | None
    enabled: bool
    #: `None` and `[]` both mean "no restriction on this axis". The service
    #: normalises writes to `None`, but rows written before that — or by hand —
    #: may hold either, so the frontend must treat them the same.
    target_roles: list[str] | None
    target_user_ids: list[str] | None
    updated_by: str | None
    created_at: datetime
    updated_at: datetime

    #: Denormalised for the table: the reference shows a targeting summary, and
    #: computing "Everyone" from two nullable arrays is a rule better applied
    #: once here than in every client that renders a flag.
    targets_everyone: bool


class FeatureFlagWriteRequest(BaseModel):
    """Create and update take the same body.

    One schema, not `Create` + `Update`, because the write is a full replace in
    both directions — see `update_flag`'s docstring on why a PATCH over a set has
    no honest meaning.
    """

    key: str = Field(min_length=1, max_length=150, pattern=KEY_PATTERN)
    name: str = Field(min_length=1, max_length=191)
    description: str | None = Field(default=None, max_length=500)
    enabled: bool = False
    #: Role **names**, not ids — the reference targets by name and an audit entry
    #: holding `["Admin"]` is legible where `[3]` is not.
    target_roles: list[str] | None = None
    target_user_ids: list[str] | None = None


class RoleOption(BaseModel):
    """A role, for the targeting picker. Targeted by `name`, not `id`."""

    id: int
    name: str
    display_name: str


class UserOption(BaseModel):
    """An ACTIVE user, for the targeting picker. Targeted by `id`."""

    id: str
    name: str
    email: str


class FeatureFlagOptionsResponse(BaseModel):
    """Both targeting pickers, in one request.

    Split out of the index rather than shipped with it, unlike the reference's
    Inertia payload: our index refetches on every filter keystroke, and resending
    the whole role and ACTIVE-user list each time would be the dominant cost of
    the screen.
    """

    roles: list[RoleOption]
    users: list[UserOption]


class FeatureFlagPage(Page[FeatureFlagResponse]):
    """The standard page envelope plus the caller's write capability.

    Same shape as the Data Access index: `can_manage` is computed from the
    permission constant the write routes are guarded on, so the button and the
    guard cannot drift apart.
    """

    can_manage: bool
