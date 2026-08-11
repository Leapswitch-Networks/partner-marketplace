from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class FeatureFlag(Base):
    """A feature that can be switched on for everyone, some roles, or some people.

    Port of LeapDesk's `feature_flags` (Module 13). Columns match one for one.

    **The two `target_*` columns are what make this a flag system rather than a
    boolean table.** Without them a flag is `enabled` or not, and rolling a
    feature out to one team first means a schema change or a hardcoded list. With
    them, a flag can be on for the `Admin` role, or for three named accounts,
    with no migration.

    ## The resolution rule, and the direction it must fail in

    `enabled` is the master switch. When it is off the flag is off for everyone,
    whatever the targets say — otherwise "turn it off" would not be a thing an
    operator could reliably do in an incident.

    When `enabled` is on and **both** target lists are empty, the flag is on for
    everyone. When either list has entries, it is on **only** for accounts
    matching one of them.

    An **unknown** flag key is off. That is the important one: a missing flag must
    never read as enabled, or a typo in a key silently ships an unfinished
    feature to production.
    """

    __tablename__ = "feature_flags"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    key: Mapped[str] = mapped_column(
        String(150), unique=True, nullable=False,
        comment="What the code checks — 'partner.self_serve_listings'",
    )
    name: Mapped[str] = mapped_column(
        String(191), nullable=False,
        comment="Human name for the screen. The key is not it",
    )
    description: Mapped[str | None] = mapped_column(
        Text, nullable=True,
        comment="What turning this on actually does",
    )

    enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, index=True,
        comment="Master switch. Off means off for everyone, targets ignored",
    )

    #: JSONB arrays, nullable. NULL and `[]` both mean "no restriction on this
    #: axis" and are treated identically — the distinction is not worth a rule
    #: nobody would remember, and a flag row written by hand will produce both.
    target_roles: Mapped[list[str] | None] = mapped_column(
        JSONB, nullable=True,
        comment="Role names this is on for. NULL/[] means no role restriction",
    )
    target_user_ids: Mapped[list[str] | None] = mapped_column(
        JSONB, nullable=True,
        comment="User ids this is on for. NULL/[] means no user restriction",
    )

    updated_by: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
        comment="Who last changed it. SET NULL — the change outlives the account",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<FeatureFlag {self.key} enabled={self.enabled}>"
