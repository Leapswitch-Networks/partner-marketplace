"""Feature flags — staged rollout as an auditable admin action, not a code change.

Port of LeapDesk's `FeatureFlagController` + `FeatureFlag::isEnabledFor()`
(Module 13). The CRUD half is ordinary; the resolution rule is the module, and it
is reproduced below line for line.

## Why this is not in `setting_service`

LeapDesk keeps the two together because its `SettingService` owns the cache, so
every flag write has to call `forgetFlag($key)` and the coupling is real. **We
have no cache** — `is_enabled_for` reads the row and answers — so there is
nothing to invalidate and no reason to merge them. The reference's
`$this->settings->forgetFlag(...)` after every write has no counterpart here, and
its absence is the whole difference.

If a cache is ever added, it goes here and the invalidation goes next to it.
"""

from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import Select, select
from sqlalchemy.orm import Session

from app.core.crud import get_or_404
from app.core.query import ListParams, ListSpec, run_list
from app.models.feature_flag import FeatureFlag
from app.models.role import Role
from app.models.user import User
from app.services import activity_service

EVENT_FLAG_CREATED = "feature_flag_created"
EVENT_FLAG_UPDATED = "feature_flag_updated"
EVENT_FLAG_TOGGLED = "feature_flag_toggled"
EVENT_FLAG_DELETED = "feature_flag_deleted"

_SUBJECT = "FeatureFlag"


# --- The resolution rule -----------------------------------------------------


def is_enabled_for(flag: FeatureFlag, user: User | None = None) -> bool:
    """Is `flag` on for `user`?

    Ported from `FeatureFlag::isEnabledFor()`. The order of these checks is the
    contract, and each one fails in a specific direction:

    1. **`enabled` is the master switch and wins over everything.** A disabled
       flag is off for everyone *including its targets* — targeting narrows who a
       live flag reaches, it does not switch the flag on. Getting this backwards
       would make "disabled" mean "disabled except for the people I listed",
       which is the opposite of a kill switch and would make an incident
       unrecoverable by the one control an operator reaches for.

    2. **No targeting means everyone.** Both lists empty is the ordinary "this
       feature is live" state, not "this feature reaches nobody".

    3. **An anonymous caller is not a target.** Once targeting exists, `None`
       cannot match a role or an id, so it is off. Returning True here would leak
       a targeted feature to every logged-out visitor.

    4. **User id beats role.** An explicitly named account is on even if their
       role is not listed — the narrower statement wins.

    `NULL` and `[]` are treated identically for both target columns; the model's
    docstring says why, and a rule distinguishing them is one nobody would
    remember.
    """
    if not flag.enabled:
        return False

    roles = flag.target_roles or []
    users = flag.target_user_ids or []

    if not roles and not users:
        return True

    if user is None:
        return False

    if user.id in users:
        return True

    return bool(roles) and user.has_role(*roles)


def feature_enabled(db: Session, key: str, user: User | None = None) -> bool:
    """Is the flag named `key` on for `user`?

    **An unknown key is False, always.** This is the single most important line
    in the module: a missing flag must never read as enabled, or a typo in a key
    silently ships an unfinished feature to everyone. It is also the case a test
    has to pin, because the failure is invisible — the feature simply appears,
    and nothing in the logs says a flag was consulted and not found.

    The same reasoning rules out a `default=True` parameter. Every call site that
    wanted one would be a place where a deleted flag turns a feature back on.
    """
    flag = db.scalar(select(FeatureFlag).where(FeatureFlag.key == key))
    if flag is None:
        return False
    return is_enabled_for(flag, user)


# --- Reads -------------------------------------------------------------------


_LIST_SPEC = ListSpec(
    sortable={
        "name": FeatureFlag.name,
        "key": FeatureFlag.key,
        "enabled": FeatureFlag.enabled,
        "created_at": FeatureFlag.created_at,
        "updated_at": FeatureFlag.updated_at,
    },
    # `name`, matching the reference's `orderBy('name')`. Its index is unpaged
    # and alphabetical; ours pages, so the default sort is the one place the two
    # screens would otherwise disagree about row order.
    default_sort="name",
    default_order="asc",
    tiebreak=FeatureFlag.id,
    searchable=(FeatureFlag.name, FeatureFlag.key, FeatureFlag.description),
)


def list_flags(
    db: Session,
    *,
    search: str | None = None,
    enabled: bool | None = None,
    sort_by: str = "name",
    sort_order: str = "asc",
    page: int = 1,
    per_page: int = 25,
) -> tuple[list[FeatureFlag], int]:
    """Flags, searchable by name/key/description and filterable by state.

    The reference returns every flag unpaged and unfiltered — its
    `FeatureFlag::query()->orderBy('name')->get()`. That is fine for the handful
    a system starts with and stops being fine later, and our own module contract
    requires the paged index shell anyway, so this goes through the shared list
    pipeline like every other module. No behaviour is lost: a first page of 25
    over a table of six is the same six rows.
    """
    stmt: Select = select(FeatureFlag)
    if enabled is not None:
        stmt = stmt.where(FeatureFlag.enabled.is_(enabled))

    return run_list(
        db,
        stmt,
        _LIST_SPEC,
        ListParams(
            page=page,
            per_page=per_page,
            sort_by=sort_by,
            sort_order=sort_order,
            search=search,
        ),
    )


def get_flag(db: Session, flag_id: int) -> FeatureFlag:
    return get_or_404(db, FeatureFlag, flag_id, "Feature flag")


# --- Writes ------------------------------------------------------------------


def _snapshot(flag: FeatureFlag) -> dict:
    """The fields worth having in an audit entry after the row has changed."""
    return {
        "key": flag.key,
        "name": flag.name,
        "description": flag.description,
        "enabled": flag.enabled,
        "target_roles": list(flag.target_roles or []),
        "target_user_ids": list(flag.target_user_ids or []),
    }


def _normalise_targets(values: list[str] | None) -> list[str] | None:
    """Dedupe while keeping order, and collapse an empty list to NULL.

    Storing `[]` and `NULL` interchangeably is already the model's contract, so
    normalising on write means the column holds one of them rather than both
    depending on which screen wrote the row.
    """
    if values is None:
        return None
    deduped = list(dict.fromkeys(values))
    return deduped or None


def _require_unique_key(db: Session, key: str, exclude_id: int | None = None) -> None:
    """409 rather than letting the unique index raise an IntegrityError.

    The key is the thing code checks, so a duplicate is a real conflict worth a
    readable message — not a 500 with a constraint name in it.
    """
    stmt = select(FeatureFlag).where(FeatureFlag.key == key)
    if exclude_id is not None:
        stmt = stmt.where(FeatureFlag.id != exclude_id)
    if db.scalar(stmt) is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"A feature flag with the key '{key}' already exists.",
        )


def create_flag(
    db: Session,
    *,
    key: str,
    name: str,
    description: str | None,
    enabled: bool,
    target_roles: list[str] | None,
    target_user_ids: list[str] | None,
    actor: User,
) -> FeatureFlag:
    _require_unique_key(db, key)

    flag = FeatureFlag(
        key=key,
        name=name,
        description=description,
        enabled=enabled,
        target_roles=_normalise_targets(target_roles),
        target_user_ids=_normalise_targets(target_user_ids),
        updated_by=actor.id,
    )
    db.add(flag)
    db.commit()
    db.refresh(flag)

    activity_service.record(
        db,
        description=f"Feature flag “{flag.name}” created",
        event=EVENT_FLAG_CREATED,
        subject_type=_SUBJECT,
        subject_id=str(flag.id),
        actor=actor,
        properties={"attributes": _snapshot(flag), "key": flag.key},
    )
    return flag


def update_flag(
    db: Session,
    flag_id: int,
    *,
    key: str,
    name: str,
    description: str | None,
    enabled: bool,
    target_roles: list[str] | None,
    target_user_ids: list[str] | None,
    actor: User,
) -> FeatureFlag:
    """Full replace, matching the reference's `update($request->validated())`.

    A PUT and not a PATCH: the two target lists are *sets*, and a partial update
    of a set has no honest meaning — omitting `target_roles` would be
    indistinguishable from clearing it, and picking either reading silently
    changes who sees a feature.
    """
    flag = get_flag(db, flag_id)
    before = _snapshot(flag)

    if key != flag.key:
        _require_unique_key(db, key, exclude_id=flag.id)

    flag.key = key
    flag.name = name
    flag.description = description
    flag.enabled = enabled
    flag.target_roles = _normalise_targets(target_roles)
    flag.target_user_ids = _normalise_targets(target_user_ids)
    flag.updated_by = actor.id

    db.commit()
    db.refresh(flag)

    after = _snapshot(flag)
    if before != after:
        activity_service.record(
            db,
            description=f"Feature flag “{flag.name}” updated",
            event=EVENT_FLAG_UPDATED,
            subject_type=_SUBJECT,
            subject_id=str(flag.id),
            actor=actor,
            # Old and new both recorded, the house pattern: an audit entry that
            # says only "updated" is not evidence of anything, and the question
            # asked afterwards is always "what was it before".
            properties={"attributes": after, "old": before, "key": flag.key},
        )
    return flag


def toggle_flag(db: Session, flag_id: int, actor: User) -> FeatureFlag:
    """Flip `enabled` and return the record.

    Its own endpoint and its own event, not folded into `update`. This is the
    control an operator reaches for during an incident, and "who turned this off,
    and when" is the question the log has to answer without being read as a
    generic edit.
    """
    flag = get_flag(db, flag_id)
    was = flag.enabled

    flag.enabled = not was
    flag.updated_by = actor.id
    db.commit()
    db.refresh(flag)

    activity_service.record(
        db,
        description=f"“{flag.name}” {'enabled' if flag.enabled else 'disabled'}",
        event=EVENT_FLAG_TOGGLED,
        subject_type=_SUBJECT,
        subject_id=str(flag.id),
        actor=actor,
        properties={
            "attributes": {"enabled": flag.enabled},
            "old": {"enabled": was},
            "key": flag.key,
        },
    )
    return flag


def delete_flag(db: Session, flag_id: int, actor: User) -> None:
    """Remove a flag.

    **Every check of this key silently becomes False afterwards**, because
    `feature_enabled` reports an unknown key as off. That is the correct default
    and it is also a live behaviour change, so the snapshot below is the only
    record of what the flag was targeting — the UI says as much before
    confirming.
    """
    flag = get_flag(db, flag_id)
    snapshot = _snapshot(flag)
    name = flag.name

    db.delete(flag)
    db.commit()

    # After the delete, with a snapshot: once the row is gone an entry saying
    # only "deleted #7" answers nothing later.
    activity_service.record(
        db,
        description=f"Feature flag “{name}” deleted",
        event=EVENT_FLAG_DELETED,
        subject_type=_SUBJECT,
        subject_id=str(flag_id),
        actor=actor,
        properties={"old": snapshot, "key": snapshot["key"]},
    )


# --- Form options ------------------------------------------------------------


def list_target_options(db: Session) -> tuple[list, list]:
    """Roles and ACTIVE users for the two targeting pickers.

    Mirrors the reference's `formData()` — `Role::orderBy('name')` and
    `User::where('status','ACTIVE')->orderBy('first_name')`.

    **Roles are targeted by name, users by id.** That asymmetry is the
    reference's and is worth keeping deliberately rather than tidying: a role
    rename would orphan a target either way, but a name in the column is legible
    in an audit entry, while a bare id is not.
    """
    roles = list(db.scalars(select(Role).order_by(Role.name.asc())).unique())
    users = list(
        db.scalars(
            select(User).where(User.status == "ACTIVE").order_by(User.first_name.asc())
        ).unique()
    )
    return roles, users
