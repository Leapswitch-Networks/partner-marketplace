"""Wire contracts for Error Tracking (Module 17)."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.models.error_group import ERROR_STATUSES, ErrorStatus


class ErrorOccurrenceResponse(BaseModel):
    """One sighting.

    `context` carries user agent and referer **only** — never request input. The
    reason is on `ErrorOccurrence`; it is repeated wherever this shape crosses a
    boundary because the temptation to "just add the body, it would help debug"
    arrives at every one of them.
    """

    model_config = {"from_attributes": True}

    id: int
    user_id: str | None
    ip: str | None
    url: str | None
    method: str | None
    message: str
    stack_trace: str | None
    context: dict[str, Any] | None
    occurred_at: datetime


class ErrorGroupResponse(BaseModel):
    """One distinct error, as the index renders it."""

    model_config = {"from_attributes": True}

    id: int
    fingerprint: str
    exception_class: str
    module: str
    route_name: str | None
    method: str | None
    path: str | None
    file: str
    line: int
    latest_message: str
    status: ErrorStatus
    occurrence_count: int
    first_seen_at: datetime | None
    last_seen_at: datetime | None
    resolved_by: str | None
    resolved_at: datetime | None
    notes: str | None


class ErrorGroupDetailResponse(ErrorGroupResponse):
    """The detail view — the group plus its most recent sightings."""

    occurrences: list[ErrorOccurrenceResponse]
    #: How many sightings exist in total, which is **not** `len(occurrences)`:
    #: the list is capped. Sent so the UI can say "20 of 4,312" rather than
    #: implying the cap is the count.
    occurrence_total: int


class UpdateErrorStatusRequest(BaseModel):
    """Triage one group.

    `notes` is optional and independent of the status: recording *why* something
    was ignored is the whole value of the field, and requiring a status change to
    write one would mean the note only ever gets added at the moment you have
    least to say.
    """

    status: ErrorStatus = Field(description=f"One of {', '.join(ERROR_STATUSES)}")
    notes: str | None = Field(default=None, max_length=5000)


__all__ = [
    "ErrorGroupDetailResponse",
    "ErrorGroupResponse",
    "ErrorOccurrenceResponse",
    "UpdateErrorStatusRequest",
]
