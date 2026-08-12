"""Machine identities, their tokens, and what those tokens did.

LeapDesk parity Module 10, Part I. A *consumer* is a system — not a person —
permitted to call our API. It holds tokens; each token carries a set of abilities
and an optional expiry.

**A machine consumer is deliberately not a `User`.** The tempting shortcut is a
hidden service account per integration, and it must be refused: it puts machine
identities into user lists, RBAC screens and every `SELECT * FROM users`, and one
forgotten filter turns an integration into a login. Tokens hang off the consumer,
so an integration can never appear in a user list, never hold a role and never
sign in. See `app/core/principal.py` for the type that keeps the two apart at the
call sites.

**`active` is a kill switch that outranks the token.** An inactive consumer is
refused at the gate even holding a valid, unexpired token — that is the "disable
an integration at 2am without hunting down its credentials" control, and it is
why the flag lives here rather than being inferred from whether tokens exist.

**Tokens are hashed, never encrypted.** The direction is the opposite of Module
7's credentials and the distinction is the whole reason the two modules stay
apart: there we hold someone else's secret and must be able to send it, so it is
encrypted and decryptable; here we issue our own and only ever need to *compare*
one, so it is hashed and unrecoverable. A stored API token we could read back
would be a stored password we could read back.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    ARRAY,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class ApiConsumer(Base):
    """One system permitted to call the API."""

    __tablename__ = "api_consumers"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    #: Names the **system**, never a person. A consumer called after whoever
    #: asked for it breaks when they change role or leave while the integration
    #: keeps running, and makes an audit row read as though a human made the call
    #: when a server did. Renaming is safe: tokens and logs key on `id`.
    slug: Mapped[str] = mapped_column(String(150), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    owner_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    #: **Nullable in the column, required by the schema** — the reference's rule,
    #: kept with its reasoning: someone must be contactable when this integration
    #: needs revoking. The column stays nullable so an imported row with no owner
    #: can be stored and then fixed, rather than being unrepresentable.
    owner_email: Mapped[str | None] = mapped_column(String(255), nullable=True)

    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    created_by: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    updated_by: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now, onupdate=_now
    )

    tokens: Mapped[list["ApiConsumerToken"]] = relationship(
        back_populates="consumer",
        cascade="all, delete-orphan",
        order_by="ApiConsumerToken.created_at.desc()",
    )

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<ApiConsumer {self.slug} active={self.active}>"


class ApiConsumerToken(Base):
    """One credential belonging to a consumer. The plaintext exists once, in the
    response that mints it, and is never recoverable afterwards."""

    __tablename__ = "api_consumer_tokens"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    #: CASCADE: the credential dies with the system it belongs to. Contrast
    #: `created_by` below, which is SET NULL — the record of who issued a token
    #: outlives whoever issued it. Same split as `data_access_grants`.
    consumer_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("api_consumers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)

    #: **SHA-256, unique-indexed — not bcrypt**, and this is the decision most
    #: likely to be got wrong because `core/security.py` already offers
    #: `hash_password`. Bcrypt is wrong here three times over: it is deliberately
    #: slow, which is right for a low-entropy human password and pointless for
    #: 256 bits of `secrets.token_urlsafe`; it salts every hash, so an incoming
    #: bearer token could not be *looked up* at all and every request would scan
    #: every row; and it truncates at 72 bytes. The token's entropy is the
    #: security property, not the hash's cost factor.
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    #: The first characters of the plaintext, so a screen that can never re-read
    #: the token can still identify it: `pmp_a1b2c3d4…`.
    prefix: Mapped[str] = mapped_column(String(16), nullable=False)

    #: Validated against the catalogue on write. A typo would otherwise mint a
    #: token carrying an ability nothing honours — which reads as "granted" on
    #: the screen and fails as a 403 at the consumer.
    abilities: Mapped[list[str]] = mapped_column(
        ARRAY(String(100)), nullable=False, default=list
    )

    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_by: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now
    )

    consumer: Mapped["ApiConsumer"] = relationship(back_populates="tokens")

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        # Never the hash, and there is no plaintext to leak.
        return f"<ApiConsumerToken {self.prefix}… for {self.consumer_id}>"


class ApiRequestLog(Base):
    """One API call by a machine consumer, **including the rejected ones**.

    Kept separate from `activity_log` for reasons that are ours rather than
    inherited: the activity trail records *meaningful actions* and commits a row
    at a time; this records *every request* at request volume, and rejections
    matter most — a burst of 401s is how a leaked or probed token shows up.

    Which means the table grows fastest exactly when something is wrong. It has a
    retention helper on day one; the reference has none and its tracker does not
    list one as planned.
    """

    __tablename__ = "api_request_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    #: **No foreign key, and nullable.** A rejected call may name no valid
    #: consumer at all, and the log of a deleted consumer's traffic is exactly
    #: what someone investigating that deletion needs. Same call `search_logs`
    #: and `activity_log` already make.
    consumer_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    token_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    #: Which token was presented, by prefix — enough to identify it after it has
    #: been revoked and deleted, and useless to anyone who reads the table.
    token_prefix: Mapped[str | None] = mapped_column(String(16), nullable=True)

    method: Mapped[str] = mapped_column(String(10), nullable=False)
    path: Mapped[str] = mapped_column(String(500), nullable=False)
    status_code: Mapped[int] = mapped_column(Integer, nullable=False)
    #: Why a call was refused: `no_token`, `unknown_token`, `expired`, `revoked`,
    #: `consumer_inactive`, `missing_ability`. Null for a call that succeeded.
    outcome: Mapped[str | None] = mapped_column(String(50), nullable=True)
    ip: Mapped[str | None] = mapped_column(String(45), nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now
    )

    __table_args__ = (
        Index("api_request_logs_consumer_created_index", "consumer_id", "created_at"),
        Index("api_request_logs_created_index", "created_at"),
    )

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<ApiRequestLog {self.method} {self.path} -> {self.status_code}>"
