from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_admin, get_db
from app.models.admin_user import AdminUser
from app.schemas.auth import AdminUserResponse, MessageResponse, UpdateAdminUserRequest
from app.services.auth_service import delete_admin_user, list_admin_users, update_admin_user

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users", response_model=list[AdminUserResponse])
def get_admin_users(
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin),
) -> list[AdminUserResponse]:
    return list_admin_users(db)


@router.patch("/users/{user_id}", response_model=AdminUserResponse)
def update_admin_user_endpoint(
    user_id: str,
    data: UpdateAdminUserRequest,
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin),
) -> AdminUserResponse:
    return update_admin_user(db, user_id, data, actor=current_admin)


@router.delete("/users/{user_id}", response_model=MessageResponse, status_code=status.HTTP_200_OK)
def delete_admin_user_endpoint(
    user_id: str,
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin),
) -> MessageResponse:
    delete_admin_user(db, user_id, actor=current_admin)
    return MessageResponse(message="User deleted successfully")
