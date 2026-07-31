"""Permission catalog — read-only.

Permissions are reference data created by the seeder from
`app.core.permissions.PERMISSION_CATALOG`. There is deliberately no write
endpoint: a permission that no route checks grants nothing, and one the code
references must exist, so the catalog belongs in code and the database follows it.
Compose *roles* instead.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_permission
from app.core.permissions import PERMISSION_VIEW
from app.models.user import User
from app.schemas.rbac import PermissionGroupResponse
from app.services import rbac_service

router = APIRouter(prefix="/permissions", tags=["permissions"])


@router.get("", response_model=list[PermissionGroupResponse])
def list_permissions(
    db: Session = Depends(get_db),
    _: User = Depends(require_permission(PERMISSION_VIEW)),
) -> list[PermissionGroupResponse]:
    """Grouped and ordered, ready to render as checkbox sections in the role editor."""
    return [
        PermissionGroupResponse.model_validate(group)
        for group in rbac_service.list_permission_groups(db)
    ]
