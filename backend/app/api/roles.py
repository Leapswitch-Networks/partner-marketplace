"""Role management endpoints."""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_permission
from app.core.permissions import ROLE_CREATE, ROLE_DELETE, ROLE_UPDATE, ROLE_VIEW
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.schemas.navigation import (
    NavPreferencesResponse,
    UpdateNavPreferencesRequest,
)
from app.schemas.rbac import (
    CloneRoleRequest,
    CreateRoleRequest,
    MatrixCellRequest,
    MatrixRow,
    PermissionGroupResponse,
    RoleMatrixResponse,
    RoleResponse,
    RoleUserItem,
    UpdateRoleRequest,
)
from app.services import navigation_service, rbac_service

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


@router.get("/matrix", response_model=RoleMatrixResponse)
def role_matrix(
    db: Session = Depends(get_db),
    _actor: User = Depends(require_permission(ROLE_VIEW)),
) -> RoleMatrixResponse:
    """Roles down, permission groups across, granted/total per cell.

    Declared BEFORE `/{role_id}` — FastAPI matches in declaration order, and
    `/matrix` would otherwise be captured by the wildcard and 422 on int parsing.
    The reference has the same hazard and solves it the same way, by declaring
    `roles-matrix` as a separate path entirely.
    """
    groups, rows = rbac_service.permission_matrix(db)
    return RoleMatrixResponse(
        groups=[PermissionGroupResponse.model_validate(g) for g in groups],
        rows=[MatrixRow(**row) for row in rows],
    )


@router.post("/matrix/cell", response_model=RoleResponse)
def update_matrix_cell(
    data: MatrixCellRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(ROLE_UPDATE)),
) -> RoleResponse:
    """Grant or revoke a whole permission group for one role."""
    role = rbac_service.set_matrix_cell(
        db, data.role_id, data.group_id, data.granted, actor
    )
    return _to_response(role, rbac_service.role_user_counts(db))


@router.get("/{role_id}/users", response_model=list[RoleUserItem])
def role_users(
    role_id: int,
    db: Session = Depends(get_db),
    _actor: User = Depends(require_permission(ROLE_VIEW)),
) -> list[RoleUserItem]:
    """Users holding this role."""
    return [RoleUserItem.model_validate(u) for u in rbac_service.role_users(db, role_id)]


@router.post("/{role_id}/clone", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
def clone_role(
    role_id: int,
    data: CloneRoleRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(ROLE_CREATE)),
) -> RoleResponse:
    """Copy a role's permissions onto a new role.

    Requires `role-create`, not `role-update`: the result is a new role. The
    privilege ceiling in the service means you cannot obtain a permission you do
    not hold by cloning a role that has it.
    """
    role = rbac_service.clone_role(db, role_id, data, actor)
    return _to_response(role, rbac_service.role_user_counts(db))


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


# --- Navigation preferences --------------------------------------------------
#
# Which sidebar sections start collapsed, per role. Gated on role-view/role-update
# rather than a permission of its own: this is an attribute of the role, and
# anyone who may edit the role may set it.


@router.get("/{role_id}/nav-preferences", response_model=NavPreferencesResponse)
def get_role_nav_preferences(
    role_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission(ROLE_VIEW)),
) -> NavPreferencesResponse:
    """Every catalog section with this role's effective value.

    Returns the full catalog, not just stored overrides, so the UI can render a
    complete toggle list without duplicating the defaults.
    """
    role = rbac_service.get_role_or_404(db, role_id)
    return NavPreferencesResponse(
        sections=navigation_service.role_nav_preferences(role)
    )


@router.post("/{role_id}/nav-preferences", response_model=NavPreferencesResponse)
def update_role_nav_preferences(
    role_id: int,
    data: UpdateNavPreferencesRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission(ROLE_UPDATE)),
) -> NavPreferencesResponse:
    """Replace this role's preferences. Unknown sections are rejected."""
    role = rbac_service.get_role_or_404(db, role_id)
    return NavPreferencesResponse(
        sections=navigation_service.set_role_nav_preferences(
            db, role, data.preferences
        )
    )
