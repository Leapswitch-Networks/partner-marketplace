from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.associations import role_permissions


class Permission(Base):
    """A single grantable capability, e.g. `user-create`.

    Permissions are reference data: they are created by the seeder from
    `app.core.permissions.PERMISSION_CATALOG` and are not user-editable. Roles
    are the thing administrators compose.
    """

    __tablename__ = "permissions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(
        String(150), unique=True, nullable=False,
        comment="{resource}-{action}, resource singular, e.g. 'user-view'",
    )
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    permission_group_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("permission_groups.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    group: Mapped["PermissionGroup | None"] = relationship(  # noqa: F821
        back_populates="permissions"
    )
    roles: Mapped[list["Role"]] = relationship(  # noqa: F821
        secondary=role_permissions,
        back_populates="permissions",
    )
