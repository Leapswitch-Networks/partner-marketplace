from fastapi import HTTPException, status
from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from app.models.category import Category
from app.schemas.category import CategoryCreate, CategoryUpdate


def list_categories(db: Session) -> list[Category]:
    return db.query(Category).order_by(Category.created_at.desc()).all()


def get_category(db: Session, category_id: str) -> Category:
    category = db.get(Category, category_id)
    if category is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    return category


def create_category(db: Session, data: CategoryCreate) -> Category:
    if db.scalar(select(exists().where(Category.id == data.id))):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A category with ID '{data.id}' already exists",
        )
    category = Category(
        id=data.id,
        name=data.name.strip(),
        description=data.description.strip(),
        status=data.status,
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


def update_category(db: Session, category_id: str, data: CategoryUpdate) -> Category:
    category = get_category(db, category_id)
    if data.name is not None:
        category.name = data.name.strip()
    if data.description is not None:
        category.description = data.description.strip()
    if data.status is not None:
        category.status = data.status
    db.commit()
    db.refresh(category)
    return category


def delete_category(db: Session, category_id: str) -> None:
    category = get_category(db, category_id)
    db.delete(category)
    db.commit()
