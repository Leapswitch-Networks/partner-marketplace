"""Read and write the platform settings registry.

Port of LeapDesk's `SettingService` (Module 11, read 2026-08-11): `get`, `set`,
`register`, `grouped`. Same responsibilities, same idempotence guarantee.

## The one deliberate divergence: there is no cache

LeapDesk wraps every read in `Cache::rememberForever` and busts the key on every
write. **We do not, and the reason is their own comment**, which says a cache is
worth it because *"a setting that takes five minutes to take effect is worse than
one that costs a query."*

That reasoning argues **against** caching in our deployment, not for it. Laravel
runs against a shared cache store, so one process busting a key busts it for all
of them. We have no Redis and no shared cache — an in-process dictionary would be
per-worker, so a write served by worker A would leave workers B and C serving the
old value **until the next restart**. That is not a five-minute staleness window;
it is an unbounded one, and it is exactly the failure their comment rejects.

So reads are a single indexed query on a table with tens of rows. Revisit when
there is a shared cache to put this in, or when a setting is read inside a hot
loop rather than once per request — and not before, because the version with a
cache is only correct once the cache is shared.
"""

from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.setting_types import SettingType, SettingValueError, coerce
from app.models.activity_log import LOG_SETTINGS
from app.models.setting import Setting
from app.models.user import User
from app.services import activity_service

#: The namespace the Security screen owns. Declared here rather than in the
#: router because `list_settings` needs it too, and two copies of a prefix is how
#: a guard and a filter end up disagreeing about what they are protecting.
SECURITY_PREFIX = "security."

#: Recorded against every write, so a settings change is findable in the audit
#: trail by event rather than only by reading descriptions.
EVENT_SETTING_UPDATED = "setting_updated"


def get(db: Session, key: str, default: Any = None) -> Any:
    """Read one setting, cast to its declared type.

    An unregistered key returns `default` rather than raising: a caller asking
    for a setting that has not been seeded yet is the normal state during a
    deploy, and it should fall back rather than take the request down.
    """
    setting = db.scalar(select(Setting).where(Setting.key == key))
    if setting is None:
        return default
    return setting.typed_value()


def list_settings(db: Session, *, module: str | None = None) -> list[Setting]:
    """Every setting, ordered `module → group → label`.

    Not paged, and that matches LeapDesk. The registry is tens of rows, declared
    in code — it does not grow with usage the way a records table does, so the
    screen filters and pages client-side. Same call this makes for Roles, and for
    the same reason.
    """
    stmt = select(Setting)
    if module:
        stmt = stmt.where(Setting.module == module)
    return list(
        db.scalars(stmt.order_by(Setting.module, Setting.group, Setting.label)).all()
    )


def list_modules(db: Session) -> list[str]:
    """Distinct module names, for the index filter."""
    return list(db.scalars(select(Setting.module).distinct().order_by(Setting.module)).all())


def get_or_404(db: Session, setting_id: int) -> Setting:
    setting = db.get(Setting, setting_id)
    if setting is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That setting does not exist.")
    return setting


def update_value(db: Session, setting: Setting, value: Any, actor: User) -> Setting:
    """Write one setting, validating against its own declared type.

    **The validation comes from the row, not from a rule table.** An `int`
    setting rejects `"abc"`, a `bool` rejects `"maybe"` — and neither needs a
    per-key entry anyone has to remember to add. That is the property that makes
    the registry cheaper than the four hand-rolled settings screens it replaces,
    and it is worth stating because the tempting shortcut — validating everything
    as a string and casting later — throws it away.

    A rejected value is a **422 naming the setting**, not a bare "invalid input":
    this screen edits many rows and the error has to say which one.
    """
    try:
        cast = coerce(setting.type, value)
    except SettingValueError as exc:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"“{setting.label}” — {exc}",
        ) from exc

    was = setting.typed_value()
    setting.value = {"v": cast}
    setting.updated_by = actor.id
    db.commit()
    db.refresh(setting)

    activity_service.record(
        db,
        description=f"{setting.key} changed",
        event=EVENT_SETTING_UPDATED,
        # The `settings` channel, not the default one. It is what the Security
        # screen's audit panel reads alongside `auth`, and a security control
        # being changed is exactly the kind of row that panel exists to show —
        # on `default` it would be buried among ordinary record edits.
        log_name=LOG_SETTINGS,
        subject_type="Setting",
        subject_id=str(setting.id),
        actor=actor,
        # Old and new both recorded. A settings audit that says only "changed" is
        # not evidence of anything — the question asked afterwards is always
        # "what was it before".
        properties={"attributes": {"value": cast}, "old": {"value": was}, "key": setting.key},
    )
    return setting


def register(
    db: Session,
    *,
    key: str,
    setting_type: SettingType,
    group: str,
    label: str,
    default: Any = None,
    module: str = "core",
    description: str | None = None,
) -> Setting:
    """Declare a setting. Idempotent — safe on every deploy.

    **An existing setting keeps its VALUE and only refreshes its metadata.**
    That is LeapDesk's guarantee and it is the whole reason a seeder may run
    unconditionally: re-registering never silently resets what an administrator
    configured. Getting this backwards would mean every deploy quietly reverted
    the security settings someone had tightened.

    The default is applied **only on first creation**, for the same reason.
    """
    setting = db.scalar(select(Setting).where(Setting.key == key))

    if setting is None:
        setting = Setting(key=key, value={"v": coerce(setting_type, default) if default is not None else None})
        db.add(setting)

    setting.type = setting_type
    setting.group = group
    setting.module = module
    setting.label = label
    setting.description = description

    db.commit()
    db.refresh(setting)
    return setting


__all__ = [
    "EVENT_SETTING_UPDATED",
    "get",
    "get_or_404",
    "list_modules",
    "list_settings",
    "register",
    "update_value",
]
