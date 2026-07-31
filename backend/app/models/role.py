from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.permissions import PROTECTED_ROLES, SUPER_ADMIN_ROLES
from app.db.base import Base
from app.models.associations import role_permissions, user_roles


class Role(Base):
    """A named bundle of permissions, assigned to users.

    System roles (`is_system = True`) are created by the seeder and protected:
    they cannot be renamed or deleted, because the guards reference them by name.
    """

    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(
        String(100), unique=True, nullable=False, index=True
    )
    display_name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_system: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False,
        comment="Seeded role referenced by name in code; cannot be renamed or deleted",
    )

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

    permissions: Mapped[list["Permission"]] = relationship(  # noqa: F821
        secondary=role_permissions,
        back_populates="roles",
        lazy="selectin",
    )
    users: Mapped[list["User"]] = relationship(  # noqa: F821
        secondary=user_roles,
        back_populates="roles",
    )

    # --- Derived ------------------------------------------------------------
    # Python properties, NOT columns. They cannot be used in a SQL filter —
    # filter on Role.name instead.

    @property
    def is_super_admin_role(self) -> bool:
        return self.name in SUPER_ADMIN_ROLES

    @property
    def is_protected(self) -> bool:
        """Protected roles refuse rename and delete regardless of permissions."""
        return self.is_system or self.name in PROTECTED_ROLES

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<Role {self.name}>"
