"""Restore or permanently remove soft-deleted records (LeapDesk parity).

Port of `RecycleBinService` + `RecycleBinController`. Its own docblock says what
this exists for, and it was true of us until today: *"Before this existed every
delete in the core was permanent."*

## The allowlist is the security control

`TYPES` is a dict literal keyed by a short string, and a request's `type` is
checked against it before anything is resolved. The reference states the rule
outright — *"a raw string from the request is never resolved to a class name"* —
and without it, `type` is an arbitrary-model-load primitive: whatever the caller
sends becomes the thing being deleted.

## Which queries filter `deleted_at`, and which deliberately do not

A blanket "hide deleted rows everywhere" would be wrong here, and the distinction
is worth stating because it looks like an oversight:

* **Filtered** — anywhere a deleted record must not act or be picked: the login
  lookup, the session lookup, every index and detail endpoint, every picker.
* **Not filtered** — anywhere a record is being named *as history*: the activity
  log's causer names, the security audit panel, error occurrences. A deleted
  user's name must still resolve, or "who did this" becomes "unknown" for
  precisely the accounts most likely to be asked about. `causer_id` is retained
  on those tables for this reason; filtering it away here would waste that.

Laravel's `SoftDeletes` global scope has the same problem and solves it with
`withTrashed()` at those call sites. Ours is the inverse default: filter where it
matters, listed above, rather than everywhere and then unpick it.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Callable

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.data_access_grant import DataAccessGrant
from app.models.searchable_entity import SearchableEntity
from app.models.user import User
from app.models.user_invitation import UserInvitation
from app.services import activity_service

EVENT_RESTORED = "restored"
EVENT_PURGED = "purged"


@dataclass(frozen=True)
class BinnedType:
    """One recoverable record type."""

    label: str
    model: type
    #: How a row of this type is described in the list. Kept per type because
    #: "a user" is identified by name and email while "a grant" is identified by
    #: the two people it connects.
    describe: Callable[[Any], str]
    #: Second line — context, not identity.
    subtitle: Callable[[Any], str | None] = lambda _row: None


#: **The allowlist.** A `type` not a key here is rejected before anything is
#: looked up. Adding a recoverable table is an entry here, not a new endpoint.
TYPES: dict[str, BinnedType] = {
    "user": BinnedType(
        label="Users",
        model=User,
        describe=lambda r: r.full_name or r.email,
        subtitle=lambda r: r.email,
    ),
    "invitation": BinnedType(
        label="Invitations",
        model=UserInvitation,
        describe=lambda r: r.email,
        subtitle=lambda r: f"{r.status} invitation",
    ),
    "data-access-grant": BinnedType(
        label="Data access grants",
        model=DataAccessGrant,
        describe=lambda r: f"Grant #{r.id}",
        subtitle=lambda r: f"scope: {r.scope}",
    ),
    "searchable-entity": BinnedType(
        label="Searchable entities",
        model=SearchableEntity,
        describe=lambda r: r.label,
        subtitle=lambda r: r.model_class,
    ),
}


def is_known_type(type_key: str | None) -> bool:
    return bool(type_key) and type_key in TYPES


def _resolve(type_key: str) -> BinnedType:
    """Type key → config, or 404.

    404 rather than 422: an unknown type is not a malformed request, it is a
    request for something that does not exist. It also declines to confirm which
    keys are valid, which a validation error listing the allowlist would.
    """
    config = TYPES.get(type_key)
    if config is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "That record type cannot be restored from the recycle bin.",
        )
    return config


def soft_delete(row: Any) -> Any:
    """Mark one row deleted. The caller commits.

    A helper rather than `row.deleted_at = now()` at four call sites, so the
    timestamp is generated one way and every delete path is greppable.
    """
    row.deleted_at = datetime.now(timezone.utc)
    return row


def counts(db: Session) -> dict[str, int]:
    """`{type: n}` for the filter chips. Types with nothing binned read 0."""
    out: dict[str, int] = {}
    for key, config in TYPES.items():
        out[key] = (
            db.scalar(
                select(func.count()).select_from(config.model).where(
                    config.model.deleted_at.is_not(None)
                )
            )
            or 0
        )
    return out


def items(db: Session, type_key: str | None = None) -> list[dict[str, Any]]:
    """Everything in the bin, newest deletion first.

    Not paged, matching the reference. A recycle bin with enough rows to need
    paging is a retention problem — `operations.recycle_bin.retention_days`
    exists for that — not a pagination one.
    """
    keys = [type_key] if is_known_type(type_key) else list(TYPES)
    rows: list[dict[str, Any]] = []

    for key in keys:
        config = TYPES[key]
        for row in db.scalars(
            select(config.model)
            .where(config.model.deleted_at.is_not(None))
            .order_by(config.model.deleted_at.desc())
        ):
            rows.append(
                {
                    "type": key,
                    "type_label": config.label,
                    "id": str(row.id),
                    "label": config.describe(row),
                    "subtitle": config.subtitle(row),
                    "deleted_at": row.deleted_at,
                }
            )

    rows.sort(key=lambda r: r["deleted_at"], reverse=True)
    return rows


def _get_binned(db: Session, type_key: str, row_id: str) -> Any:
    """Fetch a row that is **actually in the bin**.

    The `deleted_at IS NOT NULL` clause is not decoration: without it, `restore`
    would be a no-op on a live row and `purge` would be an unauthenticated hard
    delete of anything, reachable by anyone holding `recycle-bin-manage`.
    """
    config = _resolve(type_key)
    row = db.scalar(
        select(config.model).where(
            config.model.id == row_id, config.model.deleted_at.is_not(None)
        )
    )
    if row is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "That record is not in the recycle bin."
        )
    return row


def restore(db: Session, type_key: str, row_id: str, actor: Any) -> str:
    """Put one record back. Returns a message for the caller to show."""
    config = _resolve(type_key)
    row = _get_binned(db, type_key, row_id)
    label = config.describe(row)

    row.deleted_at = None
    db.commit()

    activity_service.record(
        db,
        description=f"{label} restored from the recycle bin",
        event=EVENT_RESTORED,
        subject_type=config.model.__name__,
        subject_id=str(row.id),
        actor=actor,
        properties={"type": type_key},
    )
    return f"{label} restored."


def purge(db: Session, type_key: str, row_id: str, actor: Any) -> str:
    """Delete one record permanently.

    **The activity entry is written before the row goes**, not after. Afterwards
    there is nothing left to describe, and a purge that leaves no trace is the
    one deletion in the system that would be genuinely untraceable.
    """
    config = _resolve(type_key)
    row = _get_binned(db, type_key, row_id)
    label = config.describe(row)

    activity_service.record(
        db,
        description=f"{label} permanently deleted from the recycle bin",
        event=EVENT_PURGED,
        subject_type=config.model.__name__,
        subject_id=str(row.id),
        actor=actor,
        properties={"type": type_key, "label": label},
    )

    db.delete(row)
    db.commit()
    return f"{label} permanently deleted."


def type_options() -> list[dict[str, str]]:
    return [{"value": key, "label": config.label} for key, config in TYPES.items()]


__all__ = [
    "EVENT_PURGED",
    "EVENT_RESTORED",
    "TYPES",
    "counts",
    "is_known_type",
    "items",
    "purge",
    "restore",
    "soft_delete",
    "type_options",
]
