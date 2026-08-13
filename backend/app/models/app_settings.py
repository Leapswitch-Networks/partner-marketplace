"""Installation-wide settings — one row, for the whole deployment.

**This table holds what the application *is*, not what a user prefers.** Personal
preferences live on `users` (`timezone_preference`, `sidebar_preference`); this is
the project's identity, and changing a value here changes what every user sees.

Why a table rather than only environment variables: a new project built on this
core can be branded entirely from `.env` and never write a row — the service falls
back to `settings.APP_*` for every NULL. The table exists so an administrator can
change the identity **at runtime without a redeploy**, which env vars cannot do.

Text, theme and brand assets (phases 1, 3 and 4). Every column is nullable and
NULL always means *"fall back"* — to an environment variable for text, to the
default preset for the theme, and to the monogram for the logo. There is no state
in which this table being empty degrades the application.
"""

from datetime import datetime, timezone

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    LargeBinary,
    SmallInteger,
    String,
)
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
    # A preset KEY. NULL falls back to theme.DEFAULT_PRESET. The colour space
    # was closed on purpose until 2026-08-13 — see core/theme.py's docstring for
    # the history; `brand_color` below is what opened it.
    theme_preset: Mapped[str | None] = mapped_column(
        String(40), nullable=True,
        comment="Key into core.theme.THEME_PRESETS; NULL means the default",
    )
    # A custom `#rrggbb`, validated by `theme.validate_brand_colour` at write
    # time (white-on-brand must clear WCAG AA; every other shade derives). When
    # set it wins over `theme_preset`; the preset is kept so clearing the custom
    # colour restores the previous choice rather than the default.
    brand_color: Mapped[str | None] = mapped_column(
        String(7), nullable=True,
        comment="Custom brand hex; overrides theme_preset when set",
    )

    # --- Brand assets (phase 4) ---------------------------------------------
    # Bytes in the database. See the migration for why that is the right call for
    # two rows of ~50 KB that change once a project, and not a general licence to
    # store uploads here.
    #
    # `*_mime` is written from the file's MAGIC BYTES, never from the request's
    # Content-Type or filename — both are client-supplied. See core/images.py.
    #
    # `*_updated_at` is the cache key, not decoration: asset URLs carry
    # `?v=<epoch>` and the serve route derives its ETag from it, so replacing a
    # logo invalidates it everywhere instead of leaving the old one cached.
    logo_mime: Mapped[str | None] = mapped_column(String(60), nullable=True)
    logo_bytes: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    logo_updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    favicon_mime: Mapped[str | None] = mapped_column(String(60), nullable=True)
    favicon_bytes: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    favicon_updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
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
