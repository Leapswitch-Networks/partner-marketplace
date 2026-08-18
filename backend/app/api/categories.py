"""Service taxonomy endpoints — staff-facing.

Thin (`FASTAPI_STANDARDS.md` § 2): every rule lives in `category_service`.

**There is no partner-facing write route here and there must not be.** § 6.2: the
taxonomy is Leapswitch's, and a directory whose listers can extend its vocabulary
stops being joinable. Partners read it — through `CATEGORY_VIEW`, which they
hold — to pick a category for a listing.
"""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_permission
from app.domain.partners.permissions import CATEGORY_MANAGE, CATEGORY_VIEW
from app.schemas.directory import (
    CategoryResponse,
    CreateCategoryRequest,
    ReorderCategoriesRequest,
    UpdateCategoryRequest,
)
from app.services import category_service

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryResponse])
def list_categories(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    _=Depends(require_permission(CATEGORY_VIEW)),
) -> list[CategoryResponse]:
    return [
        CategoryResponse.model_validate(c)
        for c in category_service.list_categories(db, include_inactive=include_inactive)
    ]


@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(
    payload: CreateCategoryRequest,
    db: Session = Depends(get_db),
    _=Depends(require_permission(CATEGORY_MANAGE)),
) -> CategoryResponse:
    category = category_service.create_category(
        db,
        name=payload.name,
        parent_id=payload.parent_id,
        description=payload.description,
        icon=payload.icon,
        sort_order=payload.sort_order,
    )
    db.commit()
    return CategoryResponse.model_validate(category)


# Declared BEFORE /{category_id} so "reorder" is not captured as an id.
@router.post("/reorder", status_code=status.HTTP_204_NO_CONTENT)
def reorder_categories(
    payload: ReorderCategoriesRequest,
    db: Session = Depends(get_db),
    _=Depends(require_permission(CATEGORY_MANAGE)),
) -> None:
    category_service.reorder(db, payload.ordered_ids)
    db.commit()


@router.get("/{category_id}", response_model=CategoryResponse)
def get_category(
    category_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_permission(CATEGORY_VIEW)),
) -> CategoryResponse:
    return CategoryResponse.model_validate(category_service.get_or_404(db, category_id))


@router.patch("/{category_id}", response_model=CategoryResponse)
def update_category(
    category_id: int,
    payload: UpdateCategoryRequest,
    db: Session = Depends(get_db),
    _=Depends(require_permission(CATEGORY_MANAGE)),
) -> CategoryResponse:
    category = category_service.get_or_404(db, category_id)
    category_service.update_category(
        db,
        category,
        name=payload.name,
        description=payload.description,
        icon=payload.icon,
        sort_order=payload.sort_order,
        is_active=payload.is_active,
    )
    db.commit()
    return CategoryResponse.model_validate(category)


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_permission(CATEGORY_MANAGE)),
) -> None:
    category = category_service.get_or_404(db, category_id)
    category_service.delete_category(db, category)
    db.commit()
