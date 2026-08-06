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

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.app_settings import SINGLETON_ID, AppSettings
from app.models.user import User
from app.schemas.settings import BrandingResponse, UpdateBrandingRequest
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
    return BrandingResponse(**resolved)


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
