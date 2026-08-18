"""Outbound webhooks: where we send events, and what happened when we did.

LeapDesk parity Module 14. **An endpoint belongs to an `api_consumer`, not to a
user** — a webhook is a machine-to-machine arrangement, and hanging it off a
person would mean the integration breaks when they leave.

**`secret` is stored decryptable, and that is not the mistake it looks like.**
Module 10's tokens are hashed because we only ever *compare* one. A webhook secret
is different in kind: we must reproduce the HMAC on every delivery, so we need the
value back. It is therefore encrypted at rest with the same Fernet helper as
Module 7's credentials — the rule is not "hash everything", it is "hash what you
compare, encrypt what you must reproduce, and never store plaintext either way".

**`failure_count` and `disabled_at` are a circuit breaker**, and the reason to
have one is specific: without it an endpoint that has been dead for a fortnight
is still retried on every event, forever, and the delivery log fills with the
same failure until nobody reads it.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    SmallInteger,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

#: A delivery that has not been attempted yet, or is waiting for its next go.
STATUS_PENDING = "pending"
#: 2xx from the receiver.
STATUS_DELIVERED = "delivered"
#: Out of attempts, or a 4xx that will never succeed.
STATUS_FAILED = "failed"

DELIVERY_STATUSES = (STATUS_PENDING, STATUS_DELIVERED, STATUS_FAILED)


def _now() -> datetime:
    return datetime.now(timezone.utc)


class WebhookEndpoint(Base):
    """One URL a consumer wants events posted to."""

    __tablename__ = "webhook_endpoints"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    api_consumer_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("api_consumers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(191), nullable=False)
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    #: Fernet ciphertext — see the module docstring for why this one is not hashed.
    secret: Mapped[str] = mapped_column(Text, nullable=False)
    #: Which events this endpoint wants. Validated against the catalogue on write,
    #: for the same reason Module 10 validates abilities: a typo would subscribe
    #: an endpoint to an event that will never fire, and it reads as configured.
    events: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)

    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, index=True
    )
    last_delivery_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    #: Consecutive failures. Reset to zero by any success — it measures "is this
    #: endpoint currently broken", not "has it ever failed".
    failure_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    #: Set when the circuit breaker trips. Distinct from `is_active`, which is a
    #: human switching it off: one says "we stopped trying", the other says "you
    #: stopped it", and an operator needs to tell those apart.
    disabled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    created_by: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now, onupdate=_now
    )

    deliveries: Mapped[list["WebhookDelivery"]] = relationship(
        back_populates="endpoint",
        cascade="all, delete-orphan",
        order_by="WebhookDelivery.created_at.desc()",
    )

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        # Never the secret.
        return f"<WebhookEndpoint {self.name} -> {self.url}>"


class WebhookDelivery(Base):
    """One attempt to hand an event to an endpoint, and how it went.

    **The delivery log with a redeliver button *is* the module.** Without it a
    webhook that failed silently is unrecoverable: the event happened, the
    receiver missed it, and nothing anywhere can replay it.
    """

    __tablename__ = "webhook_deliveries"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    webhook_endpoint_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("webhook_endpoints.id", ondelete="CASCADE"),
        nullable=False,
        # Not `index=True`: that would have SQLAlchemy name the index
        # `ix_webhook_deliveries_webhook_endpoint_id`, while the database has
        # `ix_webhook_deliveries_endpoint` from the migration that created it.
        # The index is declared in `__table_args__` under its real name instead,
        # so `--autogenerate` stops proposing a rename nobody needs.
    )
    event: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)

    status: Mapped[str] = mapped_column(String(20), nullable=False, default=STATUS_PENDING)
    response_status: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    #: Truncated before it is stored. A receiver that returns a megabyte of HTML
    #: on error would otherwise put a megabyte in this table per attempt.
    response_body: Mapped[str | None] = mapped_column(Text, nullable=True)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)

    #: When the next attempt becomes due, from the backoff schedule. Null once the
    #: delivery is settled either way.
    next_attempt_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    delivered_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    failed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now, onupdate=_now
    )

    endpoint: Mapped["WebhookEndpoint"] = relationship(back_populates="deliveries")

    __table_args__ = (
        # Its real name in the database — see the note on `webhook_endpoint_id`.
        Index("ix_webhook_deliveries_endpoint", "webhook_endpoint_id"),
        Index("webhook_deliveries_endpoint_created_index", "webhook_endpoint_id", "created_at"),
        # Ours: the retry sweep asks "what is due now", and without this it scans
        # every delivery ever made to find the handful that are.
        Index("webhook_deliveries_due_index", "status", "next_attempt_at"),
    )

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<WebhookDelivery {self.event} {self.status} attempts={self.attempts}>"
