import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.config import settings
from app.core.permissions import ADMIN_ACCESS_ROLES, SUPER_ADMIN_ROLES
from app.db.base import Base
from app.models.associations import user_roles

#: Only ACTIVE accounts may authenticate. Every new account starts INACTIVE and
#: needs an admin to approve it — a valid Google login alone grants nothing.
UserStatusEnum = Enum("INACTIVE", "ACTIVE", "SUSPENDED", name="user_status")

#: Staff are domain-gated and may use Google SSO; partners self-register with
#: credentials. The distinction drives the signup policy, not authorization —
#: what an account may *do* is decided entirely by its roles.
AccountTypeEnum = Enum("staff", "partner", name="account_type")

#: How the account authenticates. A 'google' account has password = NULL.
#: Values match LeapDesk's enum exactly — 'password', not 'credentials'.
AuthProviderEnum = Enum("password", "google", name="auth_provider")

#: Sidebar collapsed state. The naming is LeapDesk's and reads backwards:
#: ACTIVE means collapsed, INACTIVE means expanded. Kept verbatim so the two
#: schemas agree; see the comment on the column.
SidebarPreferenceEnum = Enum("ACTIVE", "INACTIVE", name="sidebar_preference")


class User(Base):
    """The single account table for the whole platform.

    Replaced the previous `users` + `admin_users` split: one table, and roles
    decide everything. Nothing in the codebase should reintroduce a second
    identity table — add a role instead.
    """

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )

    # --- Authentication -----------------------------------------------------
    email: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True,
        comment="Stored lower-cased; compare against a lower-cased input",
    )
    password: Mapped[str | None] = mapped_column(
        String(255), nullable=True,
        comment="bcrypt digest. NULL for Google-only accounts",
    )
    email_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
        comment="Set automatically for Google sign-ups",
    )
    auth_provider: Mapped[str] = mapped_column(
        AuthProviderEnum, nullable=False, default="password"
    )
    google_id: Mapped[str | None] = mapped_column(
        String(255), unique=True, nullable=True, index=True
    )
    google_avatar: Mapped[str | None] = mapped_column(
        String(500), nullable=True,
        comment="Remote URL from Google. See profile_photo_path for an upload",
    )

    # --- Profile ------------------------------------------------------------
    first_name: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    last_name: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    designation: Mapped[str | None] = mapped_column(String(150), nullable=True)
    employee_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    personal_mobile_number: Mapped[str | None] = mapped_column(String(30), nullable=True)
    personal_email: Mapped[str | None] = mapped_column(
        String(255), nullable=True,
        comment="Personal address. NOT an identity — `email` is what signs in",
    )
    profile_photo_path: Mapped[str | None] = mapped_column(
        String(2048), nullable=True,
        comment="Uploaded avatar path, as opposed to google_avatar's remote URL",
    )
    company_name: Mapped[str | None] = mapped_column(
        String(255), nullable=True,
        comment="Partner's organisation; NULL for staff",
    )

    # --- Classification & status --------------------------------------------
    account_type: Mapped[str] = mapped_column(
        AccountTypeEnum, nullable=False, default="partner", index=True
    )
    status: Mapped[str] = mapped_column(
        UserStatusEnum, nullable=False, default="INACTIVE", index=True,
        comment="Only ACTIVE may sign in; re-checked on every request",
    )

    # --- Preferences --------------------------------------------------------
    timezone_preference: Mapped[str] = mapped_column(
        String(50), nullable=False, default="Asia/Kolkata"
    )
    sidebar_preference: Mapped[str] = mapped_column(
        SidebarPreferenceEnum, nullable=False, default="INACTIVE",
        comment="LeapDesk semantics: ACTIVE = collapsed, INACTIVE = expanded",
    )

    # --- Login throttling (these columns ARE written — see auth_service) -----
    failed_login_attempts: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0,
        comment="Consecutive failures; reset to 0 on success",
    )
    locked_until: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
        comment="Login refused until this time after too many failures",
    )
    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_login_ip: Mapped[str | None] = mapped_column(String(45), nullable=True)

    # --- Two-factor auth (Fortify's column names) ---------------------------
    # Both secrets are Fernet-encrypted at rest; see core/encryption.py. Read them
    # through two_factor_service, never directly — a caller that forgets to
    # decrypt would compare a code against ciphertext and always fail closed,
    # which looks like "the user's authenticator is wrong".
    two_factor_secret: Mapped[str | None] = mapped_column(Text, nullable=True)
    two_factor_recovery_codes: Mapped[str | None] = mapped_column(Text, nullable=True)
    two_factor_confirmed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
        comment="NULL means enrolled but unproven — 2FA is not enforced until set",
    )

    # --- Password reset -----------------------------------------------------
    password_reset_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    password_reset_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # --- Password OTP recovery (settings page) -------------------------------
    # A signed-in user who does not know their current password proves ownership
    # of their email instead. `password_otp_verified_at` is the grace marker that
    # lets change-password omit the current password; LeapDesk keeps that flag in
    # the session, which a stateless JWT has no equivalent for. The code itself is
    # hashed — see migration e2b8d5c31f47 for why that diverges from LeapDesk.
    password_otp: Mapped[str | None] = mapped_column(Text, nullable=True)
    password_otp_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
        comment="Send cooldown derives from this — sent_at is expires_at minus the TTL",
    )
    password_otp_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # --- Audit --------------------------------------------------------------
    created_by: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    updated_by: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # --- Relationships ------------------------------------------------------
    # selectin so a permission check never triggers a lazy load per role.
    roles: Mapped[list["Role"]] = relationship(  # noqa: F821
        secondary=user_roles,
        back_populates="users",
        lazy="selectin",
    )
    # Deliberately lazy: the guard loads one session by primary key, so pulling
    # every session on every authenticated request would be pure waste.
    sessions: Mapped[list["UserSession"]] = relationship(  # noqa: F821
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    # --- Derived values -----------------------------------------------------
    # All Python properties, NOT columns — none of these can appear in a SQL
    # filter. Filter on User.status / User.account_type, or join roles.

    @property
    def full_name(self) -> str:
        name = f"{self.first_name} {self.last_name}".strip()
        return name or self.email

    @property
    def initials(self) -> str:
        if self.first_name and self.last_name:
            return (self.first_name[0] + self.last_name[0]).upper()
        source = self.first_name or self.last_name or self.email
        return source[:2].upper()

    @property
    def avatar_url(self) -> str | None:
        return self.google_avatar

    @property
    def is_active(self) -> bool:
        return self.status == "ACTIVE"

    @property
    def two_factor_enabled(self) -> bool:
        """True only when 2FA is enrolled **and confirmed**.

        Named without a `has_` prefix, unlike its neighbours, so the API schemas
        can serialise it directly by field name. One name for one concept beats a
        second alias property that drifts.

        The confirmation half is load-bearing. Treating a stored secret as
        "enabled" would lock out anyone who scanned the QR badly and never
        produced a working code — they would be required to supply a code their
        authenticator cannot generate, with no way back in.
        """
        return self.two_factor_secret is not None and self.two_factor_confirmed_at is not None

    @property
    def is_locked(self) -> bool:
        """True while a failed-login lockout is still in force."""
        if self.locked_until is None:
            return False
        return self.locked_until > datetime.now(timezone.utc)

    @property
    def password_otp_grace(self) -> bool:
        """Recently proved control of their email, so may skip the current password.

        A property rather than a service function because the API serialises it by
        field name, and because `auth_service` and `rbac_service` both need it —
        putting it in either one would make the other import it circularly.

        The window is intentionally the same length as the code's own TTL: the
        permission it grants should not outlive the evidence for it.
        """
        if self.password_otp_verified_at is None:
            return False
        window = timedelta(minutes=settings.PASSWORD_OTP_GRACE_MINUTES)
        return self.password_otp_verified_at + window > datetime.now(timezone.utc)

    @property
    def role_names(self) -> set[str]:
        return {role.name for role in self.roles}

    @property
    def is_super_admin(self) -> bool:
        """Bypasses every permission check."""
        return bool(self.role_names & SUPER_ADMIN_ROLES)

    @property
    def has_admin_access(self) -> bool:
        """Sees all records rather than only their own — drives data scoping."""
        return bool(self.role_names & ADMIN_ACCESS_ROLES)

    @property
    def permission_names(self) -> set[str]:
        """The union of permissions across every assigned role.

        Note this does NOT expand the super-admin bypass into a concrete list —
        callers must go through `has_permission`, which applies the bypass.
        """
        return {
            permission.name
            for role in self.roles
            for permission in role.permissions
        }

    # --- Checks -------------------------------------------------------------

    def has_role(self, *names: str) -> bool:
        return bool(self.role_names & set(names))

    def has_permission(self, permission: str) -> bool:
        """Super admins pass unconditionally; everyone else needs the grant."""
        if self.is_super_admin:
            return True
        return permission in self.permission_names

    def has_any_permission(self, *permissions: str) -> bool:
        return any(self.has_permission(p) for p in permissions)

    def has_all_permissions(self, *permissions: str) -> bool:
        return all(self.has_permission(p) for p in permissions)

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<User {self.email} [{self.status}]>"
