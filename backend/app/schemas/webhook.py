"""Request and response shapes for outbound webhooks.

**No response model exposes `secret`.** It is returned exactly twice in the
module's life — when an endpoint is created and when its secret is rotated — and
both times through `WebhookCreated`, which exists to make that visible in the
contract rather than implied by an absence.
"""

from datetime import datetime

from pydantic import BaseModel, Field


class EventOption(BaseModel):
    name: str
    description: str


class WebhookResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    api_consumer_id: str
    name: str
    url: str
    events: list[str]
    is_active: bool
    last_delivery_at: datetime | None
    #: Consecutive failures. Reset by any success — it answers "is this broken
    #: now", not "has it ever failed".
    failure_count: int
    #: Set when the circuit breaker tripped, as distinct from a person switching
    #: the endpoint off. An operator needs to tell those apart.
    disabled_at: datetime | None
    created_at: datetime
    updated_at: datetime


class WebhookCreateRequest(BaseModel):
    api_consumer_id: str
    name: str = Field(min_length=2, max_length=191)
    #: Validated against private, loopback, link-local and metadata addresses
    #: before it is stored — see `webhook_service.assert_safe_url`.
    url: str = Field(min_length=8, max_length=500)
    events: list[str] = Field(min_length=1)
    is_active: bool = True


class WebhookUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=191)
    url: str | None = Field(default=None, min_length=8, max_length=500)
    events: list[str] | None = None
    is_active: bool | None = None


class WebhookCreated(BaseModel):
    """⚠️ Carries the signing secret in plaintext. Returned once, stored hashed
    nowhere and encrypted at rest — the receiver needs it to verify us, so unlike
    an API token it must be reproducible on our side."""

    secret: str
    warning: str
    endpoint: WebhookResponse


class DeliveryResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    event: str
    status: str
    response_status: int | None
    #: Truncated server-side. Kept because "it returned 500 and said what" is the
    #: first question anyone asks of a failed delivery.
    response_body: str | None
    attempts: int
    duration_ms: int | None
    next_attempt_at: datetime | None
    delivered_at: datetime | None
    failed_at: datetime | None
    created_at: datetime


class DeliverySummary(BaseModel):
    total: int
    delivered: int
    failed: int
    pending: int
