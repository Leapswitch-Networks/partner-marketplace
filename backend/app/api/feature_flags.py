"""Feature flag endpoints — full CRUD plus a dedicated toggle.

## Route ordering

`/options` is declared **before** `/{flag_id}`. FastAPI matches in declaration
order, so the literal would otherwise be swallowed by the path parameter and
`GET /options` would 422 trying to parse "options" as an int. The reference's own
plan flags the same trap for `roles/data-access`; it applies to any literal
segment sharing a prefix with a parameter.

## Why `toggle` is a POST to its own path and not a PATCH of `enabled`

It is the control an operator reaches for during an incident. Its own route means
its own permission check, its own audit event and its own success copy — and a
client cannot flip a flag by accident while submitting an unrelated edit.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_permission
from app.core.permissions import FEATURE_FLAG_MANAGE, FEATURE_FLAG_VIEW
from app.core.query import page_meta
from app.models.feature_flag import FeatureFlag
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.schemas.feature_flag import (
    FeatureFlagOptionsResponse,
    FeatureFlagPage,
    FeatureFlagResponse,
    FeatureFlagWriteRequest,
)
from app.services import feature_flag_service

router = APIRouter(prefix="/settings/feature-flags", tags=["feature-flags"])


def _to_response(flag: FeatureFlag) -> FeatureFlagResponse:
    roles = flag.target_roles or []
    users = flag.target_user_ids or []
    return FeatureFlagResponse(
        id=flag.id,
        key=flag.key,
        name=flag.name,
        description=flag.description,
        enabled=flag.enabled,
        target_roles=flag.target_roles,
        target_user_ids=flag.target_user_ids,
        updated_by=flag.updated_by,
        created_at=flag.created_at,
        updated_at=flag.updated_at,
        # Computed once here so every client renders "Everyone" on the same rule,
        # and so a NULL/[] mismatch cannot make two screens disagree.
        targets_everyone=not roles and not users,
    )


@router.get("", response_model=FeatureFlagPage)
def list_feature_flags(
    search: str | None = Query(
        default=None, description="Matches name, key or description"
    ),
    enabled: bool | None = Query(default=None),
    sort_by: str = Query(default="name"),
    sort_order: str = Query(default="asc", pattern="^(asc|desc)$"),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=25, ge=1, le=100),
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(FEATURE_FLAG_VIEW)),
) -> FeatureFlagPage:
    """Flags, alphabetical by name — the reference's own ordering."""
    flags, total = feature_flag_service.list_flags(
        db,
        search=search,
        enabled=enabled,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        per_page=per_page,
    )
    return FeatureFlagPage(
        items=[_to_response(f) for f in flags],
        **page_meta(page, per_page, total),
        can_manage=actor.has_permission(FEATURE_FLAG_MANAGE),
    )


@router.get("/options", response_model=FeatureFlagOptionsResponse)
def feature_flag_options(
    db: Session = Depends(get_db),
    _actor: User = Depends(require_permission(FEATURE_FLAG_VIEW)),
) -> FeatureFlagOptionsResponse:
    """Roles and ACTIVE users for the two targeting pickers.

    Declared before `/{flag_id}` — see the module docstring.
    """
    roles, users = feature_flag_service.list_target_options(db)
    return FeatureFlagOptionsResponse(
        roles=[
            {"id": r.id, "name": r.name, "display_name": r.display_name} for r in roles
        ],
        users=[{"id": u.id, "name": u.full_name, "email": u.email} for u in users],
    )


@router.post("", response_model=FeatureFlagResponse, status_code=status.HTTP_201_CREATED)
def create_feature_flag(
    payload: FeatureFlagWriteRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(FEATURE_FLAG_MANAGE)),
) -> FeatureFlagResponse:
    flag = feature_flag_service.create_flag(
        db,
        key=payload.key,
        name=payload.name,
        description=payload.description,
        enabled=payload.enabled,
        target_roles=payload.target_roles,
        target_user_ids=payload.target_user_ids,
        actor=actor,
    )
    return _to_response(flag)


@router.get("/{flag_id}", response_model=FeatureFlagResponse)
def get_feature_flag(
    flag_id: int,
    db: Session = Depends(get_db),
    _actor: User = Depends(require_permission(FEATURE_FLAG_VIEW)),
) -> FeatureFlagResponse:
    return _to_response(feature_flag_service.get_flag(db, flag_id))


@router.put("/{flag_id}", response_model=FeatureFlagResponse)
def update_feature_flag(
    flag_id: int,
    payload: FeatureFlagWriteRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(FEATURE_FLAG_MANAGE)),
) -> FeatureFlagResponse:
    """Full replace. A PUT and not a PATCH — see `update_flag`'s docstring."""
    flag = feature_flag_service.update_flag(
        db,
        flag_id,
        key=payload.key,
        name=payload.name,
        description=payload.description,
        enabled=payload.enabled,
        target_roles=payload.target_roles,
        target_user_ids=payload.target_user_ids,
        actor=actor,
    )
    return _to_response(flag)


@router.post("/{flag_id}/toggle", response_model=FeatureFlagResponse)
def toggle_feature_flag(
    flag_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(FEATURE_FLAG_MANAGE)),
) -> FeatureFlagResponse:
    """Flip `enabled` and return the updated record.

    Returns the record rather than a message so the client can patch the row in
    place — a refetch would only re-fetch what the response already holds.
    """
    return _to_response(feature_flag_service.toggle_flag(db, flag_id, actor))


@router.delete("/{flag_id}", response_model=MessageResponse)
def delete_feature_flag(
    flag_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(FEATURE_FLAG_MANAGE)),
) -> MessageResponse:
    feature_flag_service.delete_flag(db, flag_id, actor)
    return MessageResponse(message="Feature flag deleted.")
