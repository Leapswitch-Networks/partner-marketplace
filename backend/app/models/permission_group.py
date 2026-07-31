from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class PermissionGroup(Base):
    """Groups permissions by module so the roles UI can render them in sections.

    Purely organisational — a group grants nothing on its own.
    """

    __tablename__ = "permission_groups"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(
        String(100), unique=True, nullable=False, index=True,
        comment="Slug, e.g. 'users'",
    )
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    display_order: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0,
        comment="Ascending sort order in the permissions UI",
    )
    module: Mapped[str | None] = mapped_column(
        String(100), nullable=True,
        comment="Owning module, e.g. 'core' or 'legacy'",
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
        back_populates="group",
        order_by="Permission.id",
    )
