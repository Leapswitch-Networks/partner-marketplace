"""Installation-wide settings — one row, for the whole deployment.

**This table holds what the application *is*, not what a user prefers.** Personal
preferences live on `users` (`timezone_preference`, `sidebar_preference`); this is
the project's identity, and changing a value here changes what every user sees.

Why a table rather than only environment variables: a new project built on this
core can be branded entirely from `.env` and never write a row — the service falls
back to `settings.APP_*` for every NULL. The table exists so an administrator can
change the identity **at runtime without a redeploy**, which env vars cannot do.

Phase 1 stores text only. The `logo_*` / `favicon_*` columns are deliberately
absent rather than nullable-and-unused: adding a column that nothing writes is
what PM-6 was about, and the storage decision they depend on is still open
(DYNAMIC_BRANDING_PLAN § 3.4).
"""

from datetime import datetime, timezone

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, SmallInteger, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

#: The primary key of the only row that may exist. Referenced by the service
#: rather than repeated as a literal.
SINGLETON_ID = 1


class AppSettings(Base):
    """The single settings row.

    Every text column is nullable, and NULL means *"fall back to the environment"*
    rather than *"empty"*. That distinction matters: it lets an administrator clear
    an override and get the deployment's configured default back, instead of
    blanking the application name.
    """

    __tablename__ = "app_settings"

    # The CHECK is the point of this column. "There is one row" enforced by a
    # convention is how a table ends up with two, and a settings table with two
    # rows has no defined behaviour — the symptom is branding that changes
    # depending on which row a query happens to return first.
    id: Mapped[int] = mapped_column(
        SmallInteger, primary_key=True, autoincrement=False, default=SINGLETON_ID
    )

    app_name: Mapped[str | None] = mapped_column(
        String(120), nullable=True,
        comment="NULL falls back to settings.APP_NAME",
    )
    app_short_name: Mapped[str | None] = mapped_column(
        String(40), nullable=True,
        comment="For tight spaces — the collapsed sidebar",
    )
    monogram: Mapped[str | None] = mapped_column(
        String(2), nullable=True,
        comment="1-2 chars for the square badge; longer clips",
    )
    chrome_subtitle: Mapped[str | None] = mapped_column(
        String(60), nullable=True,
        comment="The small uppercase line under the name",
    )
    tagline: Mapped[str | None] = mapped_column(
        String(200), nullable=True,
        comment="Sign-in screen copy. Product description, not branding",
    )

    # --- Audit --------------------------------------------------------------
    # SET NULL rather than RESTRICT: deleting the administrator who last renamed
    # the application must not be blocked by, or cascade into, the settings row.
    updated_by: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        CheckConstraint(f"id = {SINGLETON_ID}", name="app_settings_single_row"),
    )

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<AppSettings name={self.app_name!r}>"
