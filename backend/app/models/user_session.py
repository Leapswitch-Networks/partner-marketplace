"""Server-side session records, so a token can actually be revoked.

**Why this table exists.** Authentication is stateless JWT in cookies. That was
fine until you ask the obvious question: what does *logout* do? Clearing the
cookie removes the browser's copy and nothing else — a token captured before
logout stays valid for the rest of its lifetime, an hour for access and seven
days for refresh. There was no way to say "this credential is finished".

LeapDesk (Laravel) does not have that problem because Laravel sessions live in a
database row: deleting the row ends the session. This table is the same idea
adapted to JWT — every token carries a `sid` naming the row, and every request
checks the row is still live. It buys three things a pure JWT cannot:

  * **Logout ends the session immediately**, on that device only.
  * **A password change ends every *other* session**, which is the entire point
    of changing a password after a compromise. Fortify does this for LeapDesk.
  * **A revoked refresh token stops working**, instead of remaining a renewable
    seven-day credential.

**The cost, stated plainly:** one extra indexed lookup per authenticated request.
That is the price of revocation. A stateless token cannot be un-issued, so any
design that can revoke has server state somewhere; the only real choice is where.

`last_seen_at` is written at most once every `SESSION_TOUCH_INTERVAL_MINUTES`
rather than on every request — otherwise every read would become a write, and a
polled endpoint like `/api/auth/me` would generate constant row churn for
information nobody needs to the second.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class UserSession(Base):
    """One sign-in. Revoking the row ends it, whatever tokens exist."""

    __tablename__ = "user_sessions"

    #: This value is the `sid` claim in both the access and refresh tokens.
    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # --- Provenance, so a user can recognise their own sessions --------------
    # Kept for a future "active sessions" screen and for answering "was that me?"
    # after a breach. User-Agent is untrusted, self-reported text: display it,
    # never make a decision on it.
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)

    # --- Lifecycle ----------------------------------------------------------
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    #: Mirrors the refresh token's expiry. A session past this is dead even if
    #: it was never explicitly revoked, so an abandoned session cannot be
    #: resurrected by a refresh token that happens to still decode.
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    #: Why it ended — 'logout' | 'password_change' | 'password_reset' |
    #: 'revoked_by_admin' | 'reuse_detected'. Diagnostic: "why am I signed out?"
    #: is otherwise unanswerable.
    revoked_reason: Mapped[str | None] = mapped_column(String(50), nullable=True)

    #: When this session last re-proved the account password. Fortify's
    #: `confirmPassword` gate, stored per session rather than per user: it means
    #: "this browser proved it knows the password recently", which is a property
    #: of the session. On the user it would let a confirmation on one device
    #: authorise a sensitive action on another.
    password_confirmed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    user: Mapped["User"] = relationship(back_populates="sessions")  # noqa: F821

    # --- Derived ------------------------------------------------------------

    @property
    def is_active(self) -> bool:
        """Live means not revoked and not past expiry.

        Both halves matter: revocation is the deliberate end, expiry is the
        automatic one, and a session needs to fail either check to be refused.
        """
        if self.revoked_at is not None:
            return False
        return self.expires_at > datetime.now(timezone.utc)

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        state = "active" if self.is_active else (self.revoked_reason or "expired")
        return f"<UserSession {self.id[:8]} user={self.user_id[:8]} {state}>"
