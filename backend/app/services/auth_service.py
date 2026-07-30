from fastapi import HTTPException, status
from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from app.models.admin_user import AdminUser
from app.models.user import User
from app.schemas.auth import AdminRegisterRequest, RegisterRequest, UpdateAdminProfileRequest, UpdateAdminUserRequest, UpdateProfileRequest


def _user_email_exists(db: Session, email: str) -> bool:
    return db.scalar(select(exists().where(User.email == email))) or False


def _admin_email_exists(db: Session, email: str) -> bool:
    return db.scalar(select(exists().where(AdminUser.email == email))) or False


def register_user(db: Session, data: RegisterRequest) -> User:
    email = data.email.strip()
    if _user_email_exists(db, email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )
    user = User(
        name=data.name.strip(),
        email=email,
        password=data.password,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def register_admin(db: Session, data: AdminRegisterRequest) -> AdminUser:
    email = data.email.strip()
    if _admin_email_exists(db, email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An admin account with this email already exists",
        )
    admin = AdminUser(
        full_name=data.full_name.strip(),
        email=email,
        password=data.password,
        role=data.role,
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return admin


def list_admin_users(db: Session) -> list[AdminUser]:
    return db.query(AdminUser).order_by(AdminUser.created_at.desc()).all()


def update_admin_user(db: Session, admin_id: str, data: UpdateAdminUserRequest, actor: AdminUser) -> AdminUser:
    target = db.get(AdminUser, admin_id)
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Prevent a non-super-admin from editing anyone else
    if not actor.is_super_admin and actor.id != target.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Super-admin privileges required")

    # Only super-admins may change role or deactivate accounts
    if data.role is not None and not actor.is_super_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Super-admin privileges required")
    if data.is_active is not None and not actor.is_super_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Super-admin privileges required")

    if data.email is not None:
        email = data.email.strip()
        if email != target.email:
            if _admin_email_exists(db, email):
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already in use")
            target.email = email

    if data.full_name is not None:
        target.full_name = data.full_name.strip()
    if data.is_active is not None:
        target.is_active = data.is_active
    if data.role is not None:
        target.role = data.role

    db.commit()
    db.refresh(target)
    return target


def delete_admin_user(db: Session, admin_id: str, actor: AdminUser) -> None:
    if not actor.is_super_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Super-admin privileges required")
    target = db.get(AdminUser, admin_id)
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if target.id == actor.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot delete your own account")
    db.delete(target)
    db.commit()


def authenticate_admin(db: Session, email: str, password: str) -> AdminUser:
    admin = db.query(AdminUser).filter(AdminUser.email == email).first()
    if not admin or admin.password != password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    if not admin.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This admin account has been deactivated",
        )
    return admin


def update_admin_profile(db: Session, admin: AdminUser, data: UpdateAdminProfileRequest) -> AdminUser:
    full_name = data.full_name.strip()
    email = data.email.strip()
    if email != admin.email:
        if _admin_email_exists(db, email):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email already exists",
            )
    admin.full_name = full_name
    admin.email = email
    db.commit()
    db.refresh(admin)
    return admin


def update_user_profile(db: Session, user: User, data: UpdateProfileRequest) -> User:
    name = data.name.strip()
    email = data.email.strip()
    if email != user.email:
        if _user_email_exists(db, email):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email already exists",
            )
    user.name = name
    user.email = email
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, email: str, password: str) -> User:
    user = db.query(User).filter(User.email == email).first()
    if not user or user.password != password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    return user
