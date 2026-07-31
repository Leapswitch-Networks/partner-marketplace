from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_permission
from app.core.permissions import (
    CATEGORY_CREATE,
    CATEGORY_DELETE,
    CATEGORY_UPDATE,
    CATEGORY_VIEW,
)
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.schemas.category import CategoryCreate, CategoryResponse, CategoryUpdate
from app.services.category_service import (
    create_category,
    delete_category,
    get_category,
    list_categories,
    update_category,
)

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryResponse])
def get_categories(
    db: Session = Depends(get_db),
    _: User = Depends(require_permission(CATEGORY_VIEW)),
) -> list[CategoryResponse]:
    return list_categories(db)


@router.get("/{category_id}", response_model=CategoryResponse)
def get_category_endpoint(
    category_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission(CATEGORY_VIEW)),
) -> CategoryResponse:
    return get_category(db, category_id)


@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category_endpoint(
    data: CategoryCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission(CATEGORY_CREATE)),
) -> CategoryResponse:
    return create_category(db, data)


@router.patch("/{category_id}", response_model=CategoryResponse)
def update_category_endpoint(
    category_id: str,
    data: CategoryUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission(CATEGORY_UPDATE)),
) -> CategoryResponse:
    return update_category(db, category_id, data)


@router.delete("/{category_id}", response_model=MessageResponse, status_code=status.HTTP_200_OK)
def delete_category_endpoint(
    category_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission(CATEGORY_DELETE)),
) -> MessageResponse:
    delete_category(db, category_id)
    return MessageResponse(message="Category deleted successfully")
