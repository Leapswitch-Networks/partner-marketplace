"""Recycle Bin — restore or permanently remove soft-deleted records.

Port of `RecycleBinController`. Its docblock states what this fixes and it was
true of us until today: *"Before this existed every delete in the core was
permanent."*

**One permission for all three routes.** Seeing what was deleted is nearly as
sensitive as restoring it — the list says a record existed, what it was called
and when it went — so `recycle-bin-manage` gates the read as well as the writes.
LeapDesk makes the same call.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_permission
from app.core.permissions import RECYCLE_BIN_MANAGE
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.schemas.recycle_bin import (
    BinnedItem,
    RecycleBinActionRequest,
    RecycleBinResponse,
)
from app.services import recycle_bin_service

router = APIRouter(prefix="/recycle-bin", tags=["recycle-bin"])


@router.get("", response_model=RecycleBinResponse)
def list_bin(
    type: str | None = Query(default=None, description="Allowlist key; unknown values are ignored"),
    db: Session = Depends(get_db),
    _actor: User = Depends(require_permission(RECYCLE_BIN_MANAGE)),
) -> RecycleBinResponse:
    """Everything recoverable, newest deletion first."""
    return RecycleBinResponse(
        items=[BinnedItem(**row) for row in recycle_bin_service.items(db, type)],
        counts=recycle_bin_service.counts(db),
        types=recycle_bin_service.type_options(),
    )


@router.post("/restore", response_model=MessageResponse)
def restore(
    payload: RecycleBinActionRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(RECYCLE_BIN_MANAGE)),
) -> MessageResponse:
    """Put one record back."""
    return MessageResponse(
        message=recycle_bin_service.restore(db, payload.type, payload.id, actor)
    )


@router.delete("", response_model=MessageResponse)
def purge(
    payload: RecycleBinActionRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(RECYCLE_BIN_MANAGE)),
) -> MessageResponse:
    """Delete one record permanently.

    **This is the only irreversible delete left in the core**, which is the point:
    everything else is now recoverable, and the one operation that is not is
    behind its own permission, its own screen and a confirmation.
    """
    return MessageResponse(
        message=recycle_bin_service.purge(db, payload.type, payload.id, actor)
    )
