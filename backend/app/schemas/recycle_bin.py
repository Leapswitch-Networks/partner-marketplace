"""Wire contracts for the Recycle Bin."""

from datetime import datetime

from pydantic import BaseModel, Field


class BinnedItem(BaseModel):
    """One deleted record, described by its own type's rules."""

    #: Allowlist key — `user`, `invitation`, … Sent back on restore/purge.
    type: str
    type_label: str
    #: String even for integer keys, so one shape serves every type.
    id: str
    label: str
    subtitle: str | None
    deleted_at: datetime


class RecycleBinResponse(BaseModel):
    items: list[BinnedItem]
    #: `{type: n}` for the filter chips. Types with nothing binned read 0.
    counts: dict[str, int]
    types: list[dict[str, str]]


class RecycleBinActionRequest(BaseModel):
    """Which record to act on.

    `type` is validated against the service allowlist, never used to resolve a
    class. See `recycle_bin_service` — this is the field that would otherwise be
    an arbitrary-model-load primitive.
    """

    type: str = Field(description="Allowlist key from `types`")
    id: str


__all__ = ["BinnedItem", "RecycleBinActionRequest", "RecycleBinResponse"]
