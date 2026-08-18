import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

#: pending -> accepted | expired | cancelled. Only `pending` is actionable.
InvitationStatusEnum = Enum(
    "pending", "accepted", "expired", "cancelled", name="invitation_status"
)

#: Mirrors User.account_type so an invitation can onboard either account class.
#: Renamed from `staff | partner` on 2026-08-17 with `account_type` itself —
#: migration `c9a71f4e2b60`. The two MUST stay in step: `accept_invitation`
#: copies one into the other, so a drift here becomes an invalid enum value on
#: the users table.
InvitationAccountTypeEnum = Enum(
    "internal", "external", name="invitation_account_type"
)


class UserInvitation(Base):
    """A tokenised invitation that pre-assigns a role before the user exists.

    The token is the only credential, so two checks matter and are both enforced
    in `invitation_service`: the token must still be pending and unexpired, and
    the accepting account's email must match the invited address. Without the
    second check, anyone holding a link could claim the invited role.
    """

    __tablename__ = "user_invitations"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    email: Mapped[str] = mapped_column(
        String(255), nullable=False, index=True,
        comment="Stored lower-cased; must match the accepting account's email",
    )
    token: Mapped[str] = mapped_column(
        String(128), unique=True, nullable=False,
        comment="URL-safe random token from security.generate_token()",
    )
    status: Mapped[str] = mapped_column(
        InvitationStatusEnum, nullable=False, default="pending", index=True
    )
    account_type: Mapped[str] = mapped_column(
        InvitationAccountTypeEnum, nullable=False, default="external"
    )

    #: Which organisation the invitee joins. Added 2026-08-17 — until then there
    #: was **no way at all** to attach a person to an organisation through the
    #: application, so the org gate in `get_current_user` governed zero users.
    #: `CORE_EXTRACTION_PLAN.md` phase 2, task 2.6.
    #:
    #: SET NULL, matching `users.organisation_id`: deleting an organisation must
    #: not delete the record that someone was invited into it.
    organisation_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("partners.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Organisation the invitee joins. NULL means an internal account",
    )

    role_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("roles.id", ondelete="SET NULL"), nullable=True,
        comment="Role applied on acceptance",
    )

    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    invited_by: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    accepted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    accepted_user_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    resent_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_sent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    note: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="Optional message included in the email"
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    role: Mapped["Role | None"] = relationship(  # noqa: F821
        lazy="selectin", foreign_keys=[role_id]
    )
    inviter: Mapped["User | None"] = relationship(  # noqa: F821
        lazy="selectin", foreign_keys=[invited_by]
    )

    #: Soft delete (Recycle Bin). NULL means live. See `recycle_bin_service` for
    #: which queries filter on it and which deliberately do not.
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True,
        comment="Soft delete. NULL means live; set means in the recycle bin",
    )

    # --- Derived ------------------------------------------------------------

    @property
    def is_expired(self) -> bool:
        return self.expires_at <= datetime.now(timezone.utc)

    @property
    def is_pending(self) -> bool:
        return self.status == "pending"

    @property
    def is_usable(self) -> bool:
        """Pending AND not past its expiry — the only state that may be accepted."""
        return self.is_pending and not self.is_expired

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<UserInvitation {self.email} [{self.status}]>"
