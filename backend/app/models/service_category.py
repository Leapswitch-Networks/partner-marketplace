from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ServiceCategory(Base):
    """The taxonomy a partner's expertise and listings hang off.

    **Leapswitch owns this table. Partners never write to it** —
    `PARTNER_DIRECTORY_PLAN.md` § 6.2. A directory whose vocabulary its listers
    can extend is not a taxonomy, it is a tag cloud, and the joins that make
    filtering work stop working the day two partners invent two spellings of the
    same thing.

    ## Two levels, and the third is an error rather than a limit

    `parent_id` is a self-reference and a child may not have children. § 19.12
    makes that a **409**, not a silent flattening: an admin who tries to nest
    three deep has a model of the taxonomy that disagrees with ours, and
    accepting the write quietly would leave them believing theirs.

    The FK is `RESTRICT`, not `CASCADE`. Deleting a parent that still has
    children should fail loudly — cascading it would silently delete a subtree
    and, with it, the category every listing under it points at.

    ## `listing_count` is denormalised on purpose

    § 8's indexing threshold reads it on every category page and every sitemap
    build. Counting live would mean an aggregate per category per render, and the
    number only changes when a listing is published or unpublished — which is a
    moderation action, not a hot path. `listing_service` maintains it; nothing
    else may write it.
    """

    __tablename__ = "service_categories"
    __table_args__ = (UniqueConstraint("slug", name="uq_service_categories_slug"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    parent_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("service_categories.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    #: The URL segment. Unique across BOTH levels, not just within a parent —
    #: `/services/<slug>` has no room for a parent in it, so two children called
    #: "backup" under different parents would collide at the route.
    slug: Mapped[str] = mapped_column(String(140), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    icon: Mapped[str | None] = mapped_column(String(60), nullable=True)

    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    #: Maintained by `listing_service` on publish/unpublish. Never written by a
    #: router, and never trusted as a source of truth for anything but display
    #: and the § 8 threshold.
    listing_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    parent: Mapped["ServiceCategory | None"] = relationship(
        "ServiceCategory", remote_side="ServiceCategory.id", back_populates="children"
    )
    children: Mapped[list["ServiceCategory"]] = relationship(
        "ServiceCategory", back_populates="parent", order_by="ServiceCategory.sort_order"
    )

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<ServiceCategory {self.slug!r} parent={self.parent_id}>"
