"""Role management endpoints."""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_permission
from app.core.permissions import ROLE_CREATE, ROLE_DELETE, ROLE_UPDATE, ROLE_VIEW
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.schemas.rbac import CreateRoleRequest, RoleResponse, UpdateRoleRequest
from app.services import rbac_service

router = APIRouter(prefix="/roles", tags=["roles"])


def _to_response(role, user_counts: dict[int, int]) -> RoleResponse:
    return RoleResponse(
        id=role.id,
        name=role.name,
        display_name=role.display_name,
        description=role.description,
        is_system=role.is_system,
        is_protected=role.is_protected,
        created_at=role.created_at,
        permissions=role.permissions,
        user_count=user_counts.get(role.id, 0),
    )


@router.get("", response_model=list[RoleResponse])
def list_roles(
    db: Session = Depends(get_db),
    _: User = Depends(require_permission(ROLE_VIEW)),
) -> list[RoleResponse]:
    counts = rbac_service.role_user_counts(db)
    return [_to_response(role, counts) for role in rbac_service.list_roles(db)]


@router.get("/{role_id}", response_model=RoleResponse)
def get_role(
    role_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission(ROLE_VIEW)),
) -> RoleResponse:
    role = rbac_service.get_role_or_404(db, role_id)
    return _to_response(role, rbac_service.role_user_counts(db))


@router.post("", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
def create_role(
    data: CreateRoleRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(ROLE_CREATE)),
) -> RoleResponse:
    role = rbac_service.create_role(db, data, actor)
    return _to_response(role, {})


@router.patch("/{role_id}", response_model=RoleResponse)
def update_role(
    role_id: int,
    data: UpdateRoleRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(ROLE_UPDATE)),
) -> RoleResponse:
    role = rbac_service.update_role(db, role_id, data, actor)
    return _to_response(role, rbac_service.role_user_counts(db))


@router.delete("/{role_id}", response_model=MessageResponse)
def delete_role(
    role_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission(ROLE_DELETE)),
) -> MessageResponse:
    rbac_service.delete_role(db, role_id)
    return MessageResponse(message="Role deleted")
