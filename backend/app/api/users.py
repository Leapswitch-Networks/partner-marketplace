"""User administration endpoints.

Every route declares its permission explicitly. An endpoint with no
`require_permission` dependency is a bug — there is no implicit gating.
Replaces the previous `admin.py`, which authenticated but did not authorize.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_permission
from app.core.permissions import (
    USER_APPROVE,
    USER_CREATE,
    USER_DELETE,
    USER_UPDATE,
    USER_VIEW,
)
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.schemas.rbac import (
    BulkActionResult,
    BulkStatusRequest,
    BulkUserIdsRequest,
    CreateUserRequest,
    PaginatedUsers,
    UpdateUserRequest,
    UserDetailResponse,
    UserListItem,
)
from app.services import user_service

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=PaginatedUsers)
def list_users(
    search: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    account_type: str | None = Query(default=None),
    role_id: int | None = Query(default=None),
    sort_by: str = Query(default="created_at"),
    sort_order: str = Query(default="desc", pattern="^(asc|desc)$"),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=15, ge=1, le=100),
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(USER_VIEW)),
) -> PaginatedUsers:
    users, total = user_service.list_users(
        db,
        actor,
        search=search,
        status_filter=status_filter,
        account_type=account_type,
        role_id=role_id,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        per_page=per_page,
    )
    items = [
        UserListItem.model_validate(user_service.decorate(user, actor)) for user in users
    ]
    pages = (total + per_page - 1) // per_page if total else 0
    return PaginatedUsers(
        items=items, total=total, page=page, per_page=per_page, pages=pages
    )


@router.get("/{user_id}", response_model=UserDetailResponse)
def get_user(
    user_id: str,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(USER_VIEW)),
) -> UserDetailResponse:
    target = user_service.get_user_or_404(db, user_id)

    # Visibility: without admin access you may only read your own record.
    # 404 rather than 403, so the response does not confirm the account exists.
    if not actor.has_admin_access and target.id != actor.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

    return UserDetailResponse.model_validate(user_service.decorate(target, actor))


@router.post("", response_model=UserDetailResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    data: CreateUserRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(USER_CREATE)),
) -> UserDetailResponse:
    user = user_service.create_user(db, data, actor)
    return UserDetailResponse.model_validate(user_service.decorate(user, actor))


@router.patch("/{user_id}", response_model=UserDetailResponse)
def update_user(
    user_id: str,
    data: UpdateUserRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(USER_UPDATE)),
) -> UserDetailResponse:
    user = user_service.update_user(db, user_id, data, actor)
    return UserDetailResponse.model_validate(user_service.decorate(user, actor))


@router.delete("/{user_id}", response_model=MessageResponse)
def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(USER_DELETE)),
) -> MessageResponse:
    name = user_service.delete_user(db, user_id, actor)
    return MessageResponse(message=f"'{name}' deleted")


@router.post("/{user_id}/approve", response_model=UserDetailResponse)
def approve_user(
    user_id: str,
    force_unverified: bool = Query(
        default=False,
        description=(
            "Approve even though the email address has not been confirmed. Use only "
            "when identity was verified another way — it is recorded as an override."
        ),
    ),
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(USER_APPROVE)),
) -> UserDetailResponse:
    """Activate a pending account — the gate that Google SSO does not open.

    Answers `409` when the address is unconfirmed, rather than approving quietly:
    activating an unverified account hands a live password-reset path to an address
    its owner may not control. `force_unverified=true` overrides that for an
    administrator who has confirmed identity out-of-band, and the override is
    recorded distinctly in the audit trail.
    """
    user = user_service.approve_user(
        db, user_id, actor, force_unverified=force_unverified
    )
    return UserDetailResponse.model_validate(user_service.decorate(user, actor))


@router.post("/{user_id}/toggle-status", response_model=UserDetailResponse)
def toggle_status(
    user_id: str,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(USER_UPDATE)),
) -> UserDetailResponse:
    user = user_service.toggle_status(db, user_id, actor)
    return UserDetailResponse.model_validate(user_service.decorate(user, actor))


@router.post("/{user_id}/unlock", response_model=UserDetailResponse)
def unlock_user(
    user_id: str,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(USER_UPDATE)),
) -> UserDetailResponse:
    """Clear a failed-login lockout without waiting for it to lapse."""
    user = user_service.unlock_user(db, user_id, actor)
    return UserDetailResponse.model_validate(user_service.decorate(user, actor))


@router.post("/{user_id}/reset-two-factor", response_model=UserDetailResponse)
def reset_two_factor(
    user_id: str,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(USER_UPDATE)),
) -> UserDetailResponse:
    """Clear a user's 2FA so they can sign in and re-enrol.

    The support path for the case recovery codes exist to cover and sometimes do
    not: a lost phone with every code already spent. Without this the only route
    back into an account would be someone editing the database by hand.

    **This removes a security control from another person's account**, so it is
    gated on `user-update` *and* on the same protection rules as an edit — which
    means a non-super-admin cannot strip 2FA from a super-admin. It is recorded in
    the audit trail with the actor, because "who turned off my second factor" must
    be answerable.

    Deliberately not self-service: a user who still holds a session can disable
    their own 2FA at `/api/auth/me/two-factor`, which requires their password. This
    route exists for the case where they cannot get in at all.
    """
    user = user_service.reset_two_factor(db, user_id, actor)
    return UserDetailResponse.model_validate(user_service.decorate(user, actor))


@router.post("/bulk-delete", response_model=BulkActionResult)
def bulk_delete(
    data: BulkUserIdsRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(USER_DELETE)),
) -> BulkActionResult:
    affected, skipped, reasons = user_service.bulk_delete(db, data.user_ids, actor)
    return BulkActionResult(
        requested=len(data.user_ids),
        affected=affected,
        skipped=skipped,
        skipped_reasons=reasons,
        message=f"{affected} deleted, {skipped} skipped",
    )


@router.post("/bulk-status", response_model=BulkActionResult)
def bulk_status(
    data: BulkStatusRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(USER_UPDATE)),
) -> BulkActionResult:
    affected, skipped, reasons = user_service.bulk_set_status(
        db, data.user_ids, data.status, actor
    )
    return BulkActionResult(
        requested=len(data.user_ids),
        affected=affected,
        skipped=skipped,
        skipped_reasons=reasons,
        message=f"{affected} set to {data.status}, {skipped} skipped",
    )
