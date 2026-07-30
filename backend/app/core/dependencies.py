from typing import Generator

from fastapi import Cookie, Depends, HTTPException, Request, status
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.db.session import SessionLocal
from app.models.admin_user import AdminUser
from app.models.user import User


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    access_token: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
) -> User:
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
    )
    if not access_token:
        raise credentials_exc
    try:
        payload = decode_token(access_token)
        if payload.get("type") != "access":
            raise credentials_exc
        user_id: str = payload["sub"]
    except (JWTError, KeyError):
        raise credentials_exc

    user = db.get(User, user_id)
    if user is None:
        raise credentials_exc
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admins only")
    return current_user


def get_current_admin(
    access_token: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
) -> AdminUser:
    """Resolve the authenticated AdminUser from the access-token cookie."""
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Admin authentication required",
    )
    if not access_token:
        raise credentials_exc
    try:
        payload = decode_token(access_token)
        if payload.get("type") != "access":
            raise credentials_exc
        admin_id: str = payload["sub"]
    except (JWTError, KeyError):
        raise credentials_exc

    admin = db.get(AdminUser, admin_id)
    if admin is None or not admin.is_active:
        raise credentials_exc
    return admin


def require_super_admin(
    current_admin: AdminUser = Depends(get_current_admin),
) -> AdminUser:
    """Only super-admins may proceed."""
    if not current_admin.is_super_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super-admin privileges required",
        )
    return current_admin


def get_client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "unknown"
