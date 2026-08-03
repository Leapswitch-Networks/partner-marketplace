"""Authentication endpoints.

Cookies are set ONLY here and in `google.py` — no service ever receives a
Response object. `_set_auth_cookies` is the single place cookie flags are
decided, so `COOKIE_SECURE` cannot be honoured in one place and forgotten in
another.
"""

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.dependencies import get_client_ip, get_current_user, get_db
from app.core.security import create_access_token, create_refresh_token, decode_token
from app.models.user import User
from app.schemas.auth import (
    AcceptInvitationRequest,
    ChangePasswordRequest,
    CurrentUserResponse,
    ForgotPasswordRequest,
    LoginRequest,
    LoginResponse,
    MessageResponse,
    RegisterRequest,
    ResetPasswordRequest,
    UpdateProfileRequest,
)
from app.services import auth_service, invitation_service, mail_service, rbac_service

router = APIRouter(prefix="/auth", tags=["auth"])

_ACCESS_MAX_AGE = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
_REFRESH_MAX_AGE = settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60

#: The refresh cookie is scoped to this exact path, so it is never transmitted
#: on ordinary requests. Anything that reads or clears it must use the same path
#: or the browser will not match the cookie.
_REFRESH_PATH = "/api/auth/refresh"


def set_auth_cookies(response: Response, user_id: str) -> None:
    response.set_cookie(
        key="access_token",
        value=create_access_token(user_id),
        httponly=True,
        samesite=settings.COOKIE_SAMESITE,
        secure=settings.COOKIE_SECURE,
        max_age=_ACCESS_MAX_AGE,
        path="/",
    )
    response.set_cookie(
        key="refresh_token",
        value=create_refresh_token(user_id),
        httponly=True,
        samesite=settings.COOKIE_SAMESITE,
        secure=settings.COOKIE_SECURE,
        max_age=_REFRESH_MAX_AGE,
        path=_REFRESH_PATH,
    )


def clear_auth_cookies(response: Response) -> None:
    """Expire both auth cookies.

    The `secure`/`samesite`/`httponly` flags are repeated here deliberately.
    Starlette's `delete_cookie` does not inherit them — it defaults to
    `samesite="lax"`, `secure=False` — so without this the expiring
    `Set-Cookie` would carry different attributes from the one that created it.
    Browsers match on name/domain/path, so deletion works either way today, but
    it breaks the moment `COOKIE_SAMESITE` is `none`: a `SameSite=None` cookie
    without `Secure` is rejected outright, and logout would silently leave the
    session cookie in place.
    """
    response.delete_cookie(
        "access_token",
        path="/",
        httponly=True,
        samesite=settings.COOKIE_SAMESITE,
        secure=settings.COOKIE_SECURE,
    )
    response.delete_cookie(
        "refresh_token",
        path=_REFRESH_PATH,
        httponly=True,
        samesite=settings.COOKIE_SAMESITE,
        secure=settings.COOKIE_SECURE,
    )


# --- Registration -----------------------------------------------------------


@router.post("/register", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
def register(data: RegisterRequest, db: Session = Depends(get_db)) -> MessageResponse:
    """Partner self-registration. Deliberately does NOT sign the user in —
    the account starts INACTIVE and needs approval first."""
    auth_service.register_partner(db, data)
    return MessageResponse(
        message=(
            "Account created. An administrator will review and activate it, "
            "and you'll be able to sign in once approved."
        )
    )


@router.post(
    "/accept-invitation",
    response_model=LoginResponse,
    status_code=status.HTTP_201_CREATED,
)
def accept_invitation(
    data: AcceptInvitationRequest,
    response: Response,
    db: Session = Depends(get_db),
) -> LoginResponse:
    """Complete a partner invitation and sign in immediately.

    Signing in here is safe where `/register` is not: an administrator already
    vouched for this address by inviting it.
    """
    user = invitation_service.accept_with_credentials(db, data)
    set_auth_cookies(response, user.id)
    return LoginResponse(
        message="Welcome aboard",
        user=CurrentUserResponse(**rbac_service.current_user_payload(db, user)),
    )


# --- Login / logout ---------------------------------------------------------


@router.post("/login", response_model=LoginResponse)
def login(
    data: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> LoginResponse:
    user = auth_service.authenticate(db, data.email, data.password, get_client_ip(request))
    set_auth_cookies(response, user.id)
    return LoginResponse(
        message="Login successful",
        user=CurrentUserResponse(**rbac_service.current_user_payload(db, user)),
    )


@router.post("/logout", response_model=MessageResponse)
def logout(response: Response) -> MessageResponse:
    """Unauthenticated on purpose — logging out must work with an expired token."""
    clear_auth_cookies(response)
    return MessageResponse(message="Logged out")


@router.post("/refresh", response_model=MessageResponse)
def refresh(
    response: Response,
    refresh_token: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
) -> MessageResponse:
    """Rotate both cookies.

    Status is re-checked here too, so a session cannot be extended after the
    account was suspended.
    """
    credentials_exc = HTTPException(
        status.HTTP_401_UNAUTHORIZED, "Invalid or expired refresh token"
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

    user = db.get(User, user_id)
    if user is None or user.status != "ACTIVE":
        # Clear the cookies so the client stops retrying a dead session.
        clear_auth_cookies(response)
        raise credentials_exc

    set_auth_cookies(response, user.id)
    return MessageResponse(message="Token refreshed")


# --- Current user -----------------------------------------------------------


@router.get("/me", response_model=CurrentUserResponse)
def me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CurrentUserResponse:
    """Identity plus resolved roles and permissions.

    Replaces the old `whoami`/`me`/`admin/me` trio — there is one account table
    now, so there is one endpoint.
    """
    return CurrentUserResponse(**rbac_service.current_user_payload(db, current_user))


@router.patch("/me", response_model=CurrentUserResponse)
def update_me(
    data: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CurrentUserResponse:
    user = auth_service.update_own_profile(db, current_user, data)
    return CurrentUserResponse(**rbac_service.current_user_payload(db, user))


@router.post("/me/change-password", response_model=MessageResponse)
def change_password(
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    auth_service.change_own_password(db, current_user, data)
    return MessageResponse(message="Password updated")


# --- Password reset ---------------------------------------------------------


@router.post("/forgot-password", response_model=MessageResponse)
def forgot_password(
    data: ForgotPasswordRequest, db: Session = Depends(get_db)
) -> MessageResponse:
    """Always answers identically, whether or not the address exists.

    Anything else turns this endpoint into an account-enumeration oracle — which
    is also why the send result is deliberately not reflected in the response. A
    caller who could tell "sent" from "not sent" could enumerate accounts just as
    easily as one who could read a 404. A failed send is logged, not surfaced.
    """
    result = auth_service.begin_password_reset(db, data.email)
    if result is not None:
        user, token = result
        mail_service.send_password_reset(
            to=user.email,
            reset_url=f"{settings.FRONTEND_URL.rstrip('/')}/reset-password?token={token}",
            expires_hours=auth_service.PASSWORD_RESET_TTL_HOURS,
        )
    return MessageResponse(
        message="If an account exists for that address, a reset link has been sent."
    )


@router.post("/reset-password", response_model=MessageResponse)
def reset_password(
    data: ResetPasswordRequest, db: Session = Depends(get_db)
) -> MessageResponse:
    auth_service.complete_password_reset(db, data.token, data.password)
    return MessageResponse(message="Password reset. You can now sign in.")
