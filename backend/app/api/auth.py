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
from app.services import (
    auth_service,
    invitation_service,
    mail_service,
    rbac_service,
    session_service,
)

router = APIRouter(prefix="/auth", tags=["auth"])

_ACCESS_MAX_AGE = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
_REFRESH_MAX_AGE = settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60

#: The refresh cookie is scoped to this exact path, so it is never transmitted
#: on ordinary requests. Anything that reads or clears it must use the same path
#: or the browser will not match the cookie.
_REFRESH_PATH = "/api/auth/refresh"


def set_auth_cookies(response: Response, user_id: str, session_id: str) -> None:
    """Issue both cookies for a session.

    `session_id` is not optional. Both tokens carry it as `sid`, and the guard
    refuses a token whose session is revoked or expired — that is the whole
    mechanism by which logout means anything.
    """
    response.set_cookie(
        key="access_token",
        value=create_access_token(user_id, session_id),
        httponly=True,
        samesite=settings.COOKIE_SAMESITE,
        secure=settings.COOKIE_SECURE,
        max_age=_ACCESS_MAX_AGE,
        path="/",
    )
    response.set_cookie(
        key="refresh_token",
        value=create_refresh_token(user_id, session_id),
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
    session = session_service.create(
        db,
        user,
        ip=get_client_ip(request),
        user_agent=request.headers.get("User-Agent"),
    )
    set_auth_cookies(response, user.id, session.id)
    return LoginResponse(
        message="Login successful",
        user=CurrentUserResponse(**rbac_service.current_user_payload(db, user)),
    )


@router.post("/logout", response_model=MessageResponse)
def logout(
    response: Response,
    access_token: str | None = Cookie(default=None),
    refresh_token: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
) -> MessageResponse:
    """End the session server-side, then clear the cookies.

    **Unauthenticated on purpose**, and it does not use `get_current_user`.
    Logging out has to work when the access token has already expired, when the
    account has since been suspended, and when the session is already gone —
    a logout that can fail is a logout that leaves credentials alive.

    So it identifies the session on a best-effort basis: the access cookie first,
    the refresh cookie as a fallback, since the access token expires an hour in
    and the refresh one lasts days. Either way the cookies are cleared and the
    caller is told it worked. Nothing here reports whether a session was found —
    that would turn logout into an oracle for whether a captured token is still
    live.
    """
    session_id, user_id = _identify_session(access_token, refresh_token)

    if session_id and user_id:
        session = session_service.get_active(db, session_id, user_id)
        if session is not None:
            session_service.revoke(db, session, reason="logout")

    clear_auth_cookies(response)
    return MessageResponse(message="Logged out")


def _identify_session(
    access_token: str | None, refresh_token: str | None
) -> tuple[str | None, str | None]:
    """Best-effort `(session_id, user_id)` from either cookie, or `(None, None)`.

    Never raises. Used only by logout, where failing to identify the session must
    not prevent the cookies being cleared.
    """
    for token in (access_token, refresh_token):
        if not token:
            continue
        try:
            payload = decode_token(token)
        except JWTError:
            continue
        session_id, user_id = payload.get("sid"), payload.get("sub")
        if session_id and user_id:
            return session_id, user_id
    return None, None


@router.post("/refresh", response_model=MessageResponse)
def refresh(
    response: Response,
    refresh_token: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
) -> MessageResponse:
    """Reissue both cookies against a still-live session.

    Three things are re-checked, and none of them is taken from the token:

    * **The session is live.** Previously a refresh token that merely *decoded*
      bought a new hour of access, so a stolen one was a renewable seven-day
      credential and logout could not stop it. Now a revoked session refuses to
      refresh, which is what makes logging out on one device final.
    * **The account is still ACTIVE**, so a suspension cannot be outrun by
      refreshing.
    * **The token is a refresh token**, not an access token replayed here.

    The session id is carried over rather than replaced: this is the same sign-in
    continuing, and issuing a new `sid` would orphan the row holding its
    provenance. Note this therefore reissues rather than *rotates* — the previous
    refresh token stays decodable until its own expiry, and remains usable while
    the session lives. Making a superseded token individually dead needs per-token
    state and reuse detection; the session check already bounds the damage, and
    the gap is recorded in AUTHENTICATION.md rather than papered over.
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
        session_id: str = payload["sid"]
    except (JWTError, KeyError):
        raise credentials_exc

    user = db.get(User, user_id)
    session = session_service.get_active(db, session_id, user_id)
    if user is None or session is None or user.status != "ACTIVE":
        # Clear the cookies so the client stops retrying a dead session.
        clear_auth_cookies(response)
        raise credentials_exc

    session_service.touch(db, session)
    set_auth_cookies(response, user.id, session.id)
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
    access_token: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
) -> MessageResponse:
    """Change the password, then sign out every **other** session.

    This is the point of changing a password after a suspected compromise, and
    until sessions existed it did not happen: the password changed and whoever
    held a stolen token carried on for up to seven days. Now they are evicted the
    moment the new password is saved.

    The current session survives deliberately — the person doing this is already
    authenticated in this tab, and logging them out of the action they just took
    would be punishing the wrong party. `password_reset` below is the opposite,
    for reasons given there.
    """
    auth_service.change_own_password(db, current_user, data)

    session_id, _ = _identify_session(access_token, None)
    if session_id:
        evicted = session_service.revoke_all_except(
            db, current_user.id, keep_session_id=session_id, reason="password_change"
        )
    else:
        # No identifiable current session should be impossible here — the guard
        # above just validated one. Fail safe rather than silently skipping:
        # ending everything is the secure outcome, at the cost of one re-login.
        evicted = session_service.revoke_all(
            db, current_user.id, reason="password_change"
        )

    if evicted:
        return MessageResponse(
            message=(
                f"Password updated. {evicted} other "
                f"session{'s' if evicted != 1 else ''} signed out."
            )
        )
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
    """Complete a reset, then sign out **every** session including any current one.

    Stricter than change-password, on purpose. Someone changing their password in
    their own settings is demonstrably in control of a live session; someone
    completing a reset link usually is not — they are locked out, or recovering
    from a compromise, and may be on a borrowed device. So nothing is spared: any
    session an attacker holds dies here, and the user signs in fresh with the new
    password. There is no session to preserve anyway, since this endpoint is
    unauthenticated.
    """
    user = auth_service.complete_password_reset(db, data.token, data.password)
    session_service.revoke_all(db, user.id, reason="password_reset")
    return MessageResponse(message="Password reset. You can now sign in.")
