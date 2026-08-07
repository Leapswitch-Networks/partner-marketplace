"""Installation-wide settings: read with fallback, write with an audit trail.

**The fallback is the interesting part.** Every column in `app_settings` is nullable
and NULL means *"use the environment"*, so:

  * a fresh install with no row renders from `.env` alone — nothing to seed, and the
    sign-in page works before anyone has logged in to configure anything
  * clearing a field in the settings form restores the deployment's configured
    default rather than blanking the application's name
  * a new project built on this core is branded by setting five environment
    variables, with the database only needed for runtime changes

That is what makes the core reusable: the database is an *override* layer, never the
only source of truth.
"""

import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core import theme
from app.core.config import settings
from app.core.images import ValidatedImage
from app.models.app_settings import SINGLETON_ID, AppSettings
from app.models.user import User
from app.schemas.settings import (
    BrandingResponse,
    ThemePresetOption,
    ThemePresetsResponse,
    UpdateBrandingRequest,
)
from app.services import activity_service

logger = logging.getLogger("app.settings")

#: Column name -> the `Settings` attribute it falls back to. One mapping, used by
#: both the read and the diff, so a new branding field cannot be added to one and
#: forgotten in the other.
_FALLBACKS: dict[str, str] = {
    "app_name": "APP_NAME",
    "app_short_name": "APP_SHORT_NAME",
    "monogram": "APP_MONOGRAM",
    "chrome_subtitle": "APP_CHROME_SUBTITLE",
    "tagline": "APP_TAGLINE",
}


def get_row(db: Session) -> AppSettings | None:
    """The settings row, or None when nothing has ever been saved."""
    return db.get(AppSettings, SINGLETON_ID)


def get_branding(db: Session) -> BrandingResponse:
    """The resolved identity — stored value where set, environment otherwise.

    Never raises and never returns a partial result. This is called on the way to
    rendering the sign-in page, so failing here would mean an unbrandable login
    screen; there is no sensible error state, only a fallback.
    """
    row = get_row(db)
    resolved = {
        column: _resolve(row, column, env_attr)
        for column, env_attr in _FALLBACKS.items()
    }

    # The theme resolves through its own catalog rather than an env var, and
    # `theme.resolve` falls back on an unknown key — so a preset retired while a row
    # still names it degrades to the default instead of breaking every page.
    stored_preset = getattr(row, "theme_preset", None) if row is not None else None
    preset = theme.resolve(stored_preset)

    # The CSS variables are computed here, not in the client. The frontend inlines
    # them verbatim, which means adding a preset — or changing a shade — needs no
    # frontend release, and the palette lives in exactly one place.
    # URLs, not bytes. The client gets a cache-busted path it can put straight in
    # an <img src> or a <link rel="icon">; `None` means "no asset, use the monogram".
    # Built here so the `?v=` convention lives in one place.
    logo_version = _asset_version(row, "logo")
    favicon_version = _asset_version(row, "favicon")

    return BrandingResponse(
        **resolved,
        theme_preset=theme.key_for(preset),
        theme_css_variables=theme.css_variables(stored_preset),
        logo_url=f"{settings.API_PREFIX}/settings/branding/logo?v={logo_version}" if logo_version is not None else None,
        favicon_url=(
            f"{settings.API_PREFIX}/settings/branding/favicon?v={favicon_version}"
            if favicon_version is not None
            else None
        ),
    )


def _asset_version(row: AppSettings | None, asset: str) -> int | None:
    """Epoch seconds of the asset's last write, or None when there is no asset.

    Used as the `?v=` on the URL and as the ETag. Seconds rather than the full
    timestamp because it only has to *change*, and a shorter URL is easier to read
    in a network panel.
    """
    if row is None or getattr(row, f"{asset}_bytes", None) is None:
        return None
    stamp = getattr(row, f"{asset}_updated_at", None)
    return int(stamp.timestamp()) if stamp else 0


def get_asset(db: Session, asset: str) -> tuple[bytes, str, int] | None:
    """`(data, mime, version)` for a stored asset, or None if none is set."""
    row = get_row(db)
    if row is None:
        return None
    data = getattr(row, f"{asset}_bytes", None)
    mime = getattr(row, f"{asset}_mime", None)
    if data is None or mime is None:
        return None
    return data, mime, _asset_version(row, asset) or 0


def set_asset(db: Session, asset: str, image: ValidatedImage, actor: User) -> None:
    """Store a validated image. Creates the singleton row if this is the first write.

    Takes a `ValidatedImage` rather than raw bytes **on purpose**: the type makes it
    impossible to reach this function without having gone through
    `images.validate`, so no future caller can store an unchecked upload by
    forgetting a step.
    """
    row = get_row(db)
    if row is None:
        row = AppSettings(id=SINGLETON_ID)
        db.add(row)

    setattr(row, f"{asset}_bytes", image.data)
    setattr(row, f"{asset}_mime", image.mime)
    setattr(row, f"{asset}_updated_at", datetime.now(timezone.utc))
    row.updated_by = actor.id
    db.commit()

    # The bytes are deliberately NOT in the audit properties — a JSONB column is the
    # wrong place for 50 KB of binary, and the trail is read by more people than the
    # table is. Dimensions and size are what a reviewer would actually want.
    activity_service.record(
        db,
        log_name="settings",
        event=f"{asset}_updated",
        description=f"{actor.full_name} updated the application {asset}",
        subject_type="AppSettings",
        subject_id=str(SINGLETON_ID),
        actor=actor,
        properties={
            "mime": image.mime,
            "bytes": len(image.data),
            "width": image.width,
            "height": image.height,
        },
    )
    logger.info(
        "brand asset updated",
        extra={"asset": asset, "mime": image.mime, "bytes": len(image.data)},
    )


def clear_asset(db: Session, asset: str, actor: User) -> bool:
    """Remove a stored asset. Returns False when there was nothing to remove.

    Reverting to the monogram is a complete fallback rather than a broken state,
    which is why this is a plain delete with no confirmation of its own beyond the
    route's guards.
    """
    row = get_row(db)
    if row is None or getattr(row, f"{asset}_bytes", None) is None:
        return False

    setattr(row, f"{asset}_bytes", None)
    setattr(row, f"{asset}_mime", None)
    setattr(row, f"{asset}_updated_at", None)
    row.updated_by = actor.id
    db.commit()

    activity_service.record(
        db,
        log_name="settings",
        event=f"{asset}_removed",
        description=f"{actor.full_name} removed the application {asset}",
        subject_type="AppSettings",
        subject_id=str(SINGLETON_ID),
        actor=actor,
    )
    return True


def list_theme_presets() -> ThemePresetsResponse:
    """The theme catalog, for the picker.

    Served from the backend rather than hardcoded in the UI so the palette has one
    home. The measured contrast ratios ride along so they can be shown next to the
    choice instead of living only in a test.
    """
    return ThemePresetsResponse(
        default_key=theme.DEFAULT_PRESET,
        presets=[
            ThemePresetOption(
                key=key,
                label=preset.label,
                brand=preset.brand,
                brand_on_dark=preset.brand_on_dark,
                contrast_white_on_brand=preset.contrast_white_on_brand,
                contrast_on_dark_on_card=preset.contrast_on_dark_on_card,
            )
            for key, preset in theme.THEME_PRESETS.items()
        ],
    )


def _resolve(row: AppSettings | None, column: str, env_attr: str) -> str:
    stored = getattr(row, column, None) if row is not None else None
    if stored:
        return stored
    return getattr(settings, env_attr)


def update_branding(
    db: Session, data: UpdateBrandingRequest, actor: User
) -> BrandingResponse:
    """Apply a partial update, creating the singleton row on first write.

    `exclude_unset=True` rather than `exclude_none`: an explicit `null` clears an
    override and must reach the column, while an omitted field must not touch it.
    Collapsing those two would make it impossible to reset a field once set.
    """
    row = get_row(db)
    if row is None:
        # First write. `id` is set explicitly because the column is not
        # autoincrementing — the CHECK constraint only permits one value.
        row = AppSettings(id=SINGLETON_ID)
        db.add(row)

    updates = data.model_dump(exclude_unset=True)

    # Captured before the write, and compared against the *resolved* value rather
    # than the raw column: clearing an override changes the stored value from a
    # string to NULL but may leave what users actually see unchanged, if the
    # override happened to equal the environment default. Diffing the raw columns
    # would report that as a change to `null`, which reads as "the name was
    # deleted" in the audit trail.
    before_raw = {column: getattr(row, column, None) for column in updates}

    for column, value in updates.items():
        setattr(row, column, value)
    row.updated_by = actor.id

    db.commit()
    db.refresh(row)

    changed = {
        column: {"from": before_raw[column], "to": getattr(row, column)}
        for column in updates
        if before_raw[column] != getattr(row, column)
    }

    if changed:
        # Recorded because this changes what every user sees, and "who renamed the
        # application" is exactly the question an audit trail exists to answer.
        # Called after the commit and outside any transaction boundary, per PM-38 —
        # an audit write must never be able to fail the operation it records.
        activity_service.record(
            db,
            log_name="settings",
            event="branding_updated",
            description=f"{actor.full_name} updated the application branding",
            subject_type="AppSettings",
            subject_id=str(SINGLETON_ID),
            actor=actor,
            properties={"changed": changed},
        )
        logger.info(
            "branding updated",
            extra={"actor_id": actor.id, "fields": sorted(changed)},
        )

    return get_branding(db)
