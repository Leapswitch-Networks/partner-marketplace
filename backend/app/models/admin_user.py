import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Enum, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

AdminRoleEnum = Enum("admin", "super_admin", name="admin_role")


class AdminUser(Base):
    """
    Dedicated table for admin credentials.

    Kept separate from the general `users` table so that admin accounts
    can have stricter controls (MFA, IP allowlist, audit log, etc.)
    without affecting regular user records.
    """

    __tablename__ = "admin_users"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    email: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    password: Mapped[str] = mapped_column(
        String(255), nullable=False, comment="plain text password (dev/test only)"
    )
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)

    # Account status
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True,
        comment="Inactive admins cannot sign in"
    )
    role: Mapped[str] = mapped_column(
        AdminRoleEnum, nullable=False, default="admin",
        comment="admin or super_admin"
    )

    @property
    def is_super_admin(self) -> bool:
        return self.role == "super_admin"

    # Security tracking
    failed_login_attempts: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0,
        comment="Consecutive failed sign-in attempts; reset on success"
    )
    locked_until: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
        comment="Account locked until this timestamp after too many failures"
    )
    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_login_ip: Mapped[str | None] = mapped_column(
        String(45), nullable=True,
        comment="IPv4 or IPv6 address of the last successful sign-in"
    )

    # Password reset
    password_reset_token: Mapped[str | None] = mapped_column(
        Text, nullable=True,
        comment="Short-lived token for password reset flow"
    )
    password_reset_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
