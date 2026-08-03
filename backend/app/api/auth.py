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
from app.core.dependencies import (
    get_client_ip,
    get_current_session,
    get_current_user,
    get_db,
    require_password_confirmation,
)
from app.core.security import (
    create_access_token,
    create_refresh_token,
    create_two_factor_challenge_token,
    decode_token,
)
from app.models.user import User
from app.models.user_session import UserSession
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
    ConfirmPasswordRequest,
    RecoveryCodesResponse,
    TwoFactorChallengeRequest,
    TwoFactorConfirmRequest,
    TwoFactorEnrolmentResponse,
    TwoFactorRequiredResponse,
    TwoFactorStatusResponse,
    VerifyEmailRequest,
)
from app.services import (
    activity_service,
    auth_service,
    invitation_service,
    mail_service,
    rbac_service,
    session_service,
    two_factor_service,
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
    user = auth_service.register_partner(db, data)
    _send_verification(db, user)
    return MessageResponse(
        message=(
            "Account created. Check your email to confirm your address — "
            "an administrator will then review and activate the account."
        )
    )


def _send_verification(db: Session, user: User) -> None:
    """Email a verification link, if there is anything to verify.

    Failures are swallowed by `mail_service` and logged, so a mail outage cannot
    turn registration into a 500 for an account that was in fact created.
    """
    url = auth_service.issue_email_verification(user)
    if url is None:
        return
    mail_service.send_email_verification(
        to=user.email, verify_url=url, expires_hours=settings.EMAIL_VERIFICATION_TTL_HOURS
    )
    activity_service.record(
        db,
        log_name="auth",
        description=f"Verification email sent to {user.email}",
        event="email_verification_sent",
        subject_type="User",
        subject_id=user.id,
    )


# --- Email verification (PM-35) ---------------------------------------------


@router.post("/verify-email", response_model=MessageResponse)
def verify_email(data: VerifyEmailRequest, db: Session = Depends(get_db)) -> MessageResponse:
    """Confirm an address from a signed link. Unauthenticated — the holder of the
    link has no session yet, and requiring one would make the link useless to the
    person it was sent to."""
    user = auth_service.complete_email_verification(db, data.token)
    activity_service.record(
        db,
        log_name="auth",
        description=f"{user.email} confirmed their email address",
        event="email_verified",
        subject_type="User",
        subject_id=user.id,
        causer_id=user.id,
    )
    return MessageResponse(
        message=(
            "Email confirmed. An administrator will review your account."
            if user.status != "ACTIVE"
            else "Email confirmed. You can sign in."
        )
    )


@router.post("/resend-verification", response_model=MessageResponse)
def resend_verification(
    data: ForgotPasswordRequest, db: Session = Depends(get_db)
) -> MessageResponse:
    """Send a fresh verification link.

    Answers identically whether or not the address exists, whether or not it is
    already verified, and whether or not the send succeeded — same reasoning as
    `/forgot-password`. A response that distinguished those cases would be an
    account-enumeration oracle, and it would also reveal which addresses are
    pending, which is a hint worth withholding.

    Reuses `ForgotPasswordRequest` because the shape is identical: one email field.
    """
    user = auth_service.get_user_by_email(db, data.email)
    if user is not None:
        _send_verification(db, user)
    return MessageResponse(
        message="If that address needs confirming, a new link has been sent."
    )


@router.post(
    "/accept-invitation",
    response_model=LoginResponse,
    status_code=status.HTTP_201_CREATED,
)
def accept_invitation(
    data: AcceptInvitationRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> LoginResponse:
    """Complete a partner invitation and sign in immediately.

    Signing in here is safe where `/register` is not: an administrator already
    vouched for this address by inviting it.
    """
    user = invitation_service.accept_with_credentials(db, data)
    ip = get_client_ip(request)
    user_agent = request.headers.get("User-Agent")
    # A session, like any other sign-in — this path was missed when sessions were
    # introduced and called `set_auth_cookies` with the old two-argument signature,
    # which would have raised on the first invitation accepted. Caught while wiring
    # 2FA, not by a test, which is PM-11 earning its severity.
    session = session_service.create(db, user, ip=ip, user_agent=user_agent)
    activity_service.record_login(db, user, ip, user_agent)
    set_auth_cookies(response, user.id, session.id)
    return LoginResponse(
        message="Welcome aboard",
        user=CurrentUserResponse(**rbac_service.current_user_payload(db, user)),
    )


# --- Login / logout ---------------------------------------------------------


@router.post("/login", response_model=LoginResponse | TwoFactorRequiredResponse)
def login(
    data: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> LoginResponse | TwoFactorRequiredResponse:
    ip = get_client_ip(request)
    user_agent = request.headers.get("User-Agent")

    user = auth_service.authenticate(db, data.email, data.password, ip)

    # 2FA gate. The password was correct, but correct-password is not
    # authenticated when a second factor is enabled — so no session is created and
    # no cookie is set. The caller gets a short-lived challenge token that
    # `get_current_user` will not accept, and must exchange it below.
    if user.has_two_factor_enabled:
        activity_service.record(
            db,
            log_name="auth",
            description=f"{user.full_name} passed the password step; awaiting 2FA",
            event="two_factor_challenged",
            subject_type="User",
            subject_id=user.id,
            causer_id=user.id,
            properties={"ip": ip},
        )
        return TwoFactorRequiredResponse(
            challenge_token=create_two_factor_challenge_token(user.id),
            recovery_codes_remaining=two_factor_service.remaining_recovery_codes(user),
        )

    session = session_service.create(db, user, ip=ip, user_agent=user_agent)
    # Recorded here rather than in `authenticate`, because the audit entry should
    # mean "a session now exists", and only this point knows that it does.
    activity_service.record_login(db, user, ip, user_agent)
    set_auth_cookies(response, user.id, session.id)
    return LoginResponse(
        message="Login successful",
        user=CurrentUserResponse(**rbac_service.current_user_payload(db, user)),
    )


@router.post("/logout", response_model=MessageResponse)
def logout(
    request: Request,
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
            # Only recorded when a session was actually ended. Logging every call
            # would fill the trail with rows for repeat clicks and for clients
            # clearing cookies they no longer have a session for.
            activity_service.record_logout(db, user_id, get_client_ip(request))

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


# --- Two-factor authentication (PM-34) --------------------------------------
#
# Port of Fortify's `twoFactorAuthentication(['confirm' => true,
# 'confirmPassword' => true])`, which is what LeapDesk enables.
#
# `/two-factor-challenge` is unauthenticated by necessity — the caller has passed
# the password step and holds nothing a guard would accept. It IS covered by the
# per-IP sensitive-tier rate limit, which is what bounds guessing a six-digit code;
# see the assertion in core/rate_limit.py SENSITIVE_PATHS.


@router.post("/two-factor-challenge", response_model=LoginResponse)
def two_factor_challenge(
    data: TwoFactorChallengeRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> LoginResponse:
    """Exchange a challenge token plus a code for a real session."""
    invalid = HTTPException(
        status.HTTP_401_UNAUTHORIZED, "That code is not valid. Please try again."
    )

    try:
        payload = decode_token(data.challenge_token)
        if payload.get("type") != "two_factor":
            raise invalid
        user_id: str = payload["sub"]
    except (JWTError, KeyError):
        raise invalid

    user = db.get(User, user_id)
    # Re-checked here, not trusted from the token: an account can be suspended in
    # the minutes between the password step and the code being entered.
    if user is None or user.status != "ACTIVE" or not user.has_two_factor_enabled:
        raise invalid

    ip = get_client_ip(request)
    used_recovery_code = False

    if data.code:
        ok = two_factor_service.verify_totp(user, data.code)
    elif data.recovery_code:
        ok = two_factor_service.consume_recovery_code(db, user, data.recovery_code)
        used_recovery_code = ok
    else:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Provide either an authenticator code or a recovery code.",
        )

    if not ok:
        # Counted against the lockout, so a wrong second factor cannot be brute
        # forced indefinitely even within the rate limit.
        auth_service.record_second_factor_failure(db, user)
        activity_service.record_failed_login(
            db, user.email, ip, reason="bad_two_factor_code"
        )
        raise invalid

    user_agent = request.headers.get("User-Agent")
    session = session_service.create(db, user, ip=ip, user_agent=user_agent)
    auth_service.record_login(db, user, ip)
    activity_service.record_login(db, user, ip, user_agent)

    if used_recovery_code:
        remaining = two_factor_service.remaining_recovery_codes(user)
        activity_service.record(
            db,
            log_name="auth",
            description=f"{user.full_name} signed in with a recovery code",
            event="recovery_code_used",
            subject_type="User",
            subject_id=user.id,
            causer_id=user.id,
            properties={"ip": ip, "remaining": remaining},
        )

    set_auth_cookies(response, user.id, session.id)
    return LoginResponse(
        message="Login successful",
        user=CurrentUserResponse(**rbac_service.current_user_payload(db, user)),
    )


@router.post("/me/confirm-password", response_model=MessageResponse)
def confirm_password(
    data: ConfirmPasswordRequest,
    session: UserSession = Depends(get_current_session),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    """Re-prove the password, marking this session confirmed for a while.

    Fortify's `/user/confirm-password`. Stamped on the **session**, so confirming
    on a laptop does not authorise a sensitive action from a phone.
    """
    if not auth_service.verify_own_password(current_user, data.password):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "That password is incorrect.")

    session_service.mark_password_confirmed(db, session)
    return MessageResponse(
        message=f"Password confirmed for {settings.PASSWORD_CONFIRMATION_TIMEOUT_MINUTES} minutes."
    )


@router.get("/me/two-factor", response_model=TwoFactorStatusResponse)
def two_factor_status(
    current_user: User = Depends(get_current_user),
) -> TwoFactorStatusResponse:
    return TwoFactorStatusResponse(
        enabled=current_user.has_two_factor_enabled,
        pending_confirmation=(
            current_user.two_factor_secret is not None
            and current_user.two_factor_confirmed_at is None
        ),
        confirmed_at=current_user.two_factor_confirmed_at,
        recovery_codes_remaining=two_factor_service.remaining_recovery_codes(current_user),
    )


@router.post("/me/two-factor", response_model=TwoFactorEnrolmentResponse)
def enable_two_factor(
    current_user: User = Depends(get_current_user),
    _confirmed: UserSession = Depends(require_password_confirmation),
    db: Session = Depends(get_db),
) -> TwoFactorEnrolmentResponse:
    """Start enrolment. Does NOT enable 2FA until `/confirm` succeeds."""
    if current_user.password is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "This account signs in with Google. Two-factor authentication is managed there.",
        )
    try:
        secret, uri, codes = two_factor_service.begin_enrolment(db, current_user)
    except ValueError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc))

    activity_service.record(
        db,
        log_name="auth",
        description=f"{current_user.full_name} started two-factor enrolment",
        event="two_factor_enrolment_started",
        subject_type="User",
        subject_id=current_user.id,
        actor=current_user,
    )
    return TwoFactorEnrolmentResponse(secret=secret, otpauth_uri=uri, recovery_codes=codes)


@router.post("/me/two-factor/confirm", response_model=MessageResponse)
def confirm_two_factor(
    data: TwoFactorConfirmRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    """Prove a code works, which is what actually turns 2FA on."""
    if not two_factor_service.confirm_enrolment(db, current_user, data.code):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "That code is not valid. Check your authenticator app and try again.",
        )

    activity_service.record(
        db,
        log_name="auth",
        description=f"{current_user.full_name} enabled two-factor authentication",
        event="two_factor_enabled",
        subject_type="User",
        subject_id=current_user.id,
        actor=current_user,
    )
    return MessageResponse(message="Two-factor authentication is now enabled.")


@router.delete("/me/two-factor", response_model=MessageResponse)
def disable_two_factor(
    current_user: User = Depends(get_current_user),
    _confirmed: UserSession = Depends(require_password_confirmation),
    db: Session = Depends(get_db),
) -> MessageResponse:
    """Turn 2FA off. **Password confirmation required** — this is the reason that
    gate exists: without it, someone holding a stolen session could quietly remove
    the factor protecting the account."""
    two_factor_service.disable(db, current_user)
    activity_service.record(
        db,
        log_name="auth",
        description=f"{current_user.full_name} disabled two-factor authentication",
        event="two_factor_disabled",
        subject_type="User",
        subject_id=current_user.id,
        actor=current_user,
    )
    return MessageResponse(message="Two-factor authentication is now disabled.")


@router.post("/me/two-factor/recovery-codes", response_model=RecoveryCodesResponse)
def regenerate_recovery_codes(
    current_user: User = Depends(get_current_user),
    _confirmed: UserSession = Depends(require_password_confirmation),
    db: Session = Depends(get_db),
) -> RecoveryCodesResponse:
    """Issue a fresh set. Gated too — regenerating invalidates the codes the real
    owner may be relying on to get back in."""
    if not current_user.has_two_factor_enabled:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Two-factor authentication is not enabled."
        )
    codes = two_factor_service.regenerate_recovery_codes(db, current_user)
    activity_service.record(
        db,
        log_name="auth",
        description=f"{current_user.full_name} regenerated recovery codes",
        event="recovery_codes_regenerated",
        subject_type="User",
        subject_id=current_user.id,
        actor=current_user,
    )
    return RecoveryCodesResponse(recovery_codes=codes)


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
