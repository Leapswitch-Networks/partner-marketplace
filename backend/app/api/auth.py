from datetime import timedelta

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.dependencies import get_current_admin, get_current_user, get_db
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.models.admin_user import AdminUser
from app.models.user import User
from app.schemas.auth import (
    AdminRegisterRequest,
    AdminTokenResponse,
    AdminUserResponse,
    LoginRequest,
    MessageResponse,
    RegisterRequest,
    TokenResponse,
    UpdateAdminProfileRequest,
    UpdateProfileRequest,
    UserResponse,
    WhoAmIResponse,
)
from app.services.auth_service import authenticate_admin, authenticate_user, register_admin, register_user, update_admin_profile, update_user_profile

router = APIRouter(prefix="/auth", tags=["auth"])

_ACCESS_MAX_AGE = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
_REFRESH_MAX_AGE = settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60


def _set_auth_cookies(response: Response, user_id: str) -> None:
    response.set_cookie(
        key="access_token",
        value=create_access_token(user_id),
        httponly=True,
        samesite="lax",
        secure=False,          # set True behind HTTPS in production
        max_age=_ACCESS_MAX_AGE,
        path="/",
    )
    response.set_cookie(
        key="refresh_token",
        value=create_refresh_token(user_id),
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=_REFRESH_MAX_AGE,
        path="/api/auth/refresh",
    )


@router.post("/register", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
def register(data: RegisterRequest, db: Session = Depends(get_db)) -> MessageResponse:
    register_user(db, data)
    return MessageResponse(message="Account created. Please sign in.")


@router.post(
    "/admin/register",
    response_model=AdminUserResponse,
    status_code=status.HTTP_201_CREATED,
)
def admin_register(
    data: AdminRegisterRequest,
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin),
) -> AdminUserResponse:
    return register_admin(db, data)


@router.post("/admin/login", response_model=AdminTokenResponse)
def admin_login(
    data: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
) -> AdminTokenResponse:
    admin = authenticate_admin(db, data.email, data.password)
    _set_auth_cookies(response, admin.id)
    return AdminTokenResponse(message="Login successful", user=admin)


@router.post("/login", response_model=TokenResponse)
def login(
    data: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
) -> TokenResponse:
    user = authenticate_user(db, data.email, data.password)
    _set_auth_cookies(response, user.id)
    return TokenResponse(message="Login successful", user=user)


@router.post("/logout", response_model=MessageResponse)
def logout(response: Response) -> MessageResponse:
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/api/auth/refresh")
    return MessageResponse(message="Logged out")


@router.post("/refresh", response_model=MessageResponse)
def refresh(
    response: Response,
    refresh_token: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
) -> MessageResponse:
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token"
    )
    if not refresh_token:
        raise credentials_exc
    try:
        payload = decode_token(refresh_token)
        if payload.get("type") != "refresh":
            raise credentials_exc
        user_id: str = payload["sub"]
    except (JWTError, KeyError):
        raise credentials_exc

    # Token may belong to either a regular user or an admin user
    user = db.get(User, user_id)
    admin = db.get(AdminUser, user_id)
    if user is None and admin is None:
        raise credentials_exc
    if admin is not None and not admin.is_active:
        raise credentials_exc

    _set_auth_cookies(response, user_id)
    return MessageResponse(message="Token refreshed")


@router.get("/whoami", response_model=WhoAmIResponse)
def whoami(
    access_token: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
) -> WhoAmIResponse:
    """Single endpoint to identify the current user regardless of type."""
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
    )
    if not access_token:
        raise credentials_exc
    try:
        payload = decode_token(access_token)
        if payload.get("type") != "access":
            raise credentials_exc
        user_id: str = payload["sub"]
    except Exception:
        raise credentials_exc

    admin = db.get(AdminUser, user_id)
    if admin is not None and admin.is_active:
        return WhoAmIResponse(user_type="admin", user=admin)

    user = db.get(User, user_id)
    if user is not None:
        return WhoAmIResponse(user_type="user", user=user)

    raise credentials_exc


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return current_user


@router.get("/admin/me", response_model=AdminUserResponse)
def admin_me(current_admin: AdminUser = Depends(get_current_admin)) -> AdminUserResponse:
    return current_admin


@router.patch("/me", response_model=UserResponse)
def update_me(
    data: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserResponse:
    return update_user_profile(db, current_user, data)


@router.patch("/admin/me", response_model=AdminUserResponse)
def update_admin_me(
    data: UpdateAdminProfileRequest,
    current_admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> AdminUserResponse:
    return update_admin_profile(db, current_admin, data)
