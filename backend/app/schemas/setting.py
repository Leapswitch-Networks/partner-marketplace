"""Wire contracts for the settings registry (Module 11 — Configuration)."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.core.setting_types import SettingType


class SettingResponse(BaseModel):
    """One row of the Configuration screen.

    `value` is `Any` on purpose — it is whatever the row's `type` says it is, and
    narrowing it per type would need five response models and a discriminated
    union to express something the `type` field already tells the client.
    """

    model_config = {"from_attributes": True}

    id: int
    key: str
    label: str
    description: str | None
    type: SettingType
    type_label: str
    group: str
    module: str
    value: Any
    updated_at: datetime


class SettingListResponse(BaseModel):
    """The whole registry, plus what the filters need.

    **Not a `Page[T]`.** Every other list endpoint returns the paged envelope;
    this one deliberately does not, because the registry is declared in code and
    is tens of rows. Paging it server-side would add a round trip per page to a
    list that fits on one screen, and the filter dropdowns need the full set of
    modules anyway.
    """

    items: list[SettingResponse]
    #: Distinct module names present in the data — the index filter's options.
    #: Read from the rows rather than hardcoded, so a new module's settings
    #: appear in the filter the moment they are seeded.
    modules: list[str]
    #: `[{value, label}]` for every setting type, so the client renders the right
    #: editor without carrying its own copy of the type vocabulary.
    types: list[dict[str, str]]


class UpdateSettingRequest(BaseModel):
    """Write one setting.

    `value` is `Any` and validation happens in the service against the row's own
    declared type. It cannot happen here: Pydantic would have to know which
    setting is being written to know what shape to accept, and it does not — the
    id is in the path.
    """

    value: Any = Field(
        default=None,
        description="Cast against the setting's declared type; a mismatch is a 422",
    )


__all__ = [
    "SettingResponse",
    "SettingListResponse",
    "UpdateSettingRequest",
]
