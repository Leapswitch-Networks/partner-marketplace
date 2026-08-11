from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class PartnerTier(Base):
    """What a partner is entitled to publish — reference data, seeded from code.

    Integer primary key, like `roles`, because this is a small fixed list an
    administrator picks from rather than a row anyone creates ad hoc. The names
    live in `app/core/partner_tiers.py` and `seed_partner_tiers` reconciles this
    table against them.

    **A tier is commercial entitlement, not trust.** `partners.verification_level`
    carries what Leapswitch vouches for, and § 9 of `PARTNER_DIRECTORY_PLAN.md`
    ranks on that first — a paid tier must never outrank a verification failure.
    Keeping the two on separate columns is what makes that rule expressible.
    """

    __tablename__ = "partner_tiers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    name: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False, index=True,
        comment="Stable code name, referenced from app/core/partner_tiers.py",
    )
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    max_listings: Mapped[int | None] = mapped_column(
        Integer, nullable=True,
        comment="NULL means unlimited. Not a -1 sentinel — see core/partner_tiers.py",
    )
    featured_slots: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0,
        comment="Concurrent featured listings. 0 means featured placement is unavailable",
    )

    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True,
        comment="An inactive tier keeps its partners but cannot be assigned to new ones",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    partners: Mapped[list["Partner"]] = relationship(  # noqa: F821
        back_populates="tier",
    )

    @property
    def is_unlimited(self) -> bool:
        return self.max_listings is None

    @property
    def can_feature(self) -> bool:
        return self.featured_slots > 0

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<PartnerTier {self.name}>"
