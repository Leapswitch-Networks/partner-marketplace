import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

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

    # --- Password reset -----------------------------------------------------
    password_reset_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    password_reset_expires_at: Mapped[datetime | None] = mapped_column(
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
    def is_locked(self) -> bool:
        """True while a failed-login lockout is still in force."""
        if self.locked_until is None:
            return False
        return self.locked_until > datetime.now(timezone.utc)

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
