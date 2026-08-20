"""Authentication: registration, login, profile, password management.

Security decisions worth preserving:

  * Passwords are hashed with bcrypt. `verify_password` is the only comparison.
  * Login returns the SAME 401 for an unknown email and a wrong password, so the
    endpoint never confirms which addresses exist.
  * Credentials are checked BEFORE status, so a wrong password on a suspended
    account still returns 401 rather than revealing that the account exists.
  * Failed attempts are counted and the account locks — these columns are
    actually written now (they were dead before: TECH_DEBT PM-6/PM-8).
  * Emails are normalised to lower case on write AND on lookup (PM-17).
"""

import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.permissions import DEFAULT_EXTERNAL_ROLE
from app.core.security import (
    TokenError,
    create_email_verification_token,
    decode_typed_token,
    generate_token,
    hash_password,
    verify_password,
)
from app.models.user import User
from app.schemas.auth import (
    ChangePasswordRequest,
    RegisterRequest,
    UpdateProfileRequest,
)
from app.services import activity_service, mail_service, settings_service
from app.services.rbac_service import get_role_by_name

#: Deliberately identical for "no such user" and "wrong password".
_INVALID_CREDENTIALS = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Invalid email or password",
)


def normalise_email(email: str) -> str:
    return email.strip().lower()


def get_user_by_email(db: Session, email: str) -> User | None:
    # `deleted_at IS NULL` is load-bearing, not tidiness: without it a
    # soft-deleted account keeps its password and keeps signing in, and
    # "delete the user" would silently mean "hide the user from the list".
    return db.scalar(
        select(User).where(
            User.email == normalise_email(email), User.deleted_at.is_(None)
        )
    )


def email_exists(db: Session, email: str, exclude_user_id: str | None = None) -> bool:
    """Is this address taken? **Counts soft-deleted accounts too, deliberately.**

    `users.email` is UNIQUE at the database level, and a soft-deleted row still
    occupies its address. Filtering `deleted_at IS NULL` here would let
    registration accept an email that then fails on the constraint — a 500 where
    a 409 belongs — and, worse, would make restoring that account from the
    recycle bin impossible because the address had been taken in the meantime.

    So a binned account still reserves its email. Freeing it is what **purge** is
    for, and that is the honest trade: recoverable and reserved, or gone and
    released. Not both.
    """
    stmt = select(func.count()).select_from(User).where(User.email == normalise_email(email))
    if exclude_user_id:
        stmt = stmt.where(User.id != exclude_user_id)
    return bool(db.scalar(stmt))


# --- Registration -----------------------------------------------------------


def register_partner(db: Session, data: RegisterRequest) -> User:
    """Self-service partner registration.

    Two refusals matter here:
      * a staff-domain address cannot register this way, or someone could create
        a staff account with a self-chosen password and bypass SSO entirely
      * registration can be switched off wholesale via config
    """
    if not settings.ALLOW_EXTERNAL_SELF_REGISTRATION:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Self-registration is disabled. Please ask an administrator for an invitation.",
        )

    email = normalise_email(data.email)

    if settings.is_staff_email(email):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Staff accounts must sign in with Google. Use 'Continue with Google' instead.",
        )

    if email_exists(db, email):
        raise HTTPException(
            status.HTTP_409_CONFLICT, "An account with this email already exists"
        )

    user = User(
        email=email,
        password=hash_password(data.password),
        first_name=data.first_name.strip(),
        last_name=data.last_name.strip(),
        company_name=(data.company_name or "").strip() or None,
        personal_mobile_number=(data.personal_mobile_number or "").strip() or None,
        account_type="external",
        auth_provider="password",
        status=settings.NEW_USER_DEFAULT_STATUS,
    )

    default_role = get_role_by_name(db, DEFAULT_EXTERNAL_ROLE)
    if default_role:
        user.roles.append(default_role)

    db.add(user)
    db.commit()
    db.refresh(user)

    # Self-registration was the one way an account could enter the system with
    # no trail at all — the admin paths log in `user_service`, invitations log
    # on redemption. The causer is the registrant; there is nobody else.
    activity_service.record(
        db,
        description=f"{user.email} registered a partner account",
        event="registered",
        subject_type="User",
        subject_id=user.id,
        actor=user,
        properties={
            "status": user.status,
            "roles": sorted(r.name for r in user.roles),
        },
    )
    return user


# --- Login ------------------------------------------------------------------


def authenticate(db: Session, email: str, password: str, ip: str) -> User:
    """Verify credentials and return the user, or raise.

    Ordering is deliberate: lockout, then credentials, then status.

    Every outcome is written to the audit trail (PM-32), including the failures.
    A failed-login trail is the half people skip and then wish they had: without
    it there is no way to see a spray in progress, and no way to answer "was my
    account being attacked before it locked?".
    """
    user = get_user_by_email(db, email)

    if user is None:
        # No user to throttle. Same error as a bad password.
        activity_service.record_failed_login(db, email, ip, reason="unknown_email")
        raise _INVALID_CREDENTIALS

    if user.is_locked:
        remaining = int((user.locked_until - datetime.now(timezone.utc)).total_seconds() // 60) + 1
        activity_service.record_failed_login(db, email, ip, reason="account_locked")
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            f"Too many failed attempts. Try again in {remaining} minute(s).",
        )

    if not verify_password(password, user.password):
        _record_failure(db, user)
        activity_service.record_failed_login(db, email, ip, reason="bad_password")
        raise _INVALID_CREDENTIALS

    # Credentials are good. Only now does account state matter.
    if user.status != "ACTIVE":
        # One message, because `status` holds two values and the other one is
        # ACTIVE — see the note on `UserStatusEnum`. Deliberately does not say
        # *why* the account is inactive beyond "awaiting approval": to an
        # unauthenticated caller who has just proved the password, the difference
        # between never-approved and approval-withdrawn is information about an
        # account they may not own.
        detail = "Your account is awaiting administrator approval."
        # Recorded as a failure rather than a login: the credentials were right,
        # but no session was created. Calling it a login would be wrong, and
        # dropping it would hide someone repeatedly probing a disabled account.
        activity_service.record_failed_login(
            db, email, ip, reason=f"status_{user.status.lower()}"
        )
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail)

    _record_success(db, user, ip)
    return user


def _record_failure(db: Session, user: User) -> None:
    """Count the failure and lock the account once the threshold is reached."""
    user.failed_login_attempts += 1
    if user.failed_login_attempts >= settings.MAX_FAILED_LOGIN_ATTEMPTS:
        user.locked_until = datetime.now(timezone.utc) + timedelta(
            minutes=settings.ACCOUNT_LOCKOUT_MINUTES
        )
        user.failed_login_attempts = 0
    db.commit()


def _record_success(db: Session, user: User, ip: str) -> None:
    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login_at = datetime.now(timezone.utc)
    user.last_login_ip = ip
    db.commit()
    db.refresh(user)


def verify_own_password(user: User, password: str) -> bool:
    """Check a password for a re-authentication prompt, not for a login.

    Separate from `authenticate` on purpose: this must not touch the lockout
    counters or the login timestamps. A password-confirmation prompt is not a
    sign-in, and letting it write `last_login_at` would corrupt the audit answer
    to "when did they last sign in?".
    """
    return verify_password(password, user.password)


def record_second_factor_failure(db: Session, user: User) -> None:
    """Count a wrong 2FA code against the same lockout the password uses.

    Sharing the counter is deliberate. A separate one would mean an attacker who
    knows the password gets a fresh, independent budget of guesses at the second
    factor — which is exactly the position 2FA is supposed to make hopeless.
    """
    _record_failure(db, user)


def record_login(db: Session, user: User, ip: str) -> None:
    """Public wrapper used by the Google flow, which verifies no password."""
    _record_success(db, user, ip)


# --- Profile ----------------------------------------------------------------


def update_own_profile(db: Session, user: User, data: UpdateProfileRequest) -> User:
    """Apply only the fields that were actually sent.

    Email is deliberately NOT updatable here — changing it would break the link
    to a Google account and to any invitation, so it is an admin action.
    """
    updates = data.model_dump(exclude_unset=True)

    _PROFILE_FIELDS = (
        "first_name", "last_name", "designation", "employee_id",
        "personal_mobile_number", "personal_email", "company_name",
        "timezone_preference", "theme_preference",
    )
    before = {f: getattr(user, f) for f in _PROFILE_FIELDS}

    for field in ("first_name", "last_name"):
        if field in updates and updates[field] is not None:
            setattr(user, field, updates[field].strip())

    for field in (
        "designation",
        "employee_id",
        "personal_mobile_number",
        "personal_email",
        "company_name",
    ):
        if field in updates:
            value = (updates[field] or "").strip()
            setattr(user, field, value or None)

    if updates.get("timezone_preference"):
        user.timezone_preference = updates["timezone_preference"]

    # `"inherit"` clears the override; a key sets it. Tested with `in updates` rather
    # than truthiness, or the clearing case would be indistinguishable from an
    # absent field — the exact bug that makes a "reset to default" button do nothing.
    if "theme_preference" in updates:
        chosen = updates["theme_preference"]
        user.theme_preference = None if chosen == "inherit" else chosen

    user.updated_by = user.id
    db.commit()
    db.refresh(user)

    # Same diff treatment as the admin edit in `user_service.update_user` — the
    # trail should not depend on *who* changed the record. `record_change`
    # writes nothing when the submit was a no-op.
    activity_service.record_change(
        db,
        subject_type="User",
        subject_id=user.id,
        before=before,
        after={f: getattr(user, f) for f in _PROFILE_FIELDS},
        actor=user,
        label=user.email,
    )
    return user


def send_password_otp(db: Session, user: User) -> None:
    """Email a fresh 6-digit code to the signed-in user's own address.

    The address is taken from the row, never from the request — this endpoint is
    authenticated, so accepting a caller-supplied address would turn it into a way
    to send mail to arbitrary recipients from our domain.
    """
    now = datetime.now(timezone.utc)

    # Cooldown, derived rather than stored: a code sent at T expires at
    # T + TTL, so the send time is expires_at - TTL.
    if user.password_otp_expires_at is not None:
        sent_at = user.password_otp_expires_at - timedelta(
            minutes=settings.PASSWORD_OTP_TTL_MINUTES
        )
        cooldown_ends = sent_at + timedelta(
            seconds=settings.PASSWORD_OTP_RESEND_COOLDOWN_SECONDS
        )
        if now < cooldown_ends:
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                "Please wait a minute before requesting another code.",
            )

    code = f"{secrets.randbelow(1_000_000):06d}"

    user.password_otp = hash_password(code)
    user.password_otp_expires_at = now + timedelta(
        minutes=settings.PASSWORD_OTP_TTL_MINUTES
    )
    # Requesting a new code invalidates any grace already earned, so a stale
    # verification cannot be combined with a fresh code request.
    user.password_otp_verified_at = None
    db.commit()

    delivered = mail_service.send_password_otp(
        user.email,
        code,
        settings.PASSWORD_OTP_TTL_MINUTES,
        app_name=settings_service.get_branding(db).app_name,
    )
    if not delivered:
        # Clear the code rather than leaving one the user never received — a
        # pending code they cannot see would also hold the cooldown against them.
        user.password_otp = None
        user.password_otp_expires_at = None
        db.commit()
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Could not send the code right now. Try again in a minute.",
        )

    activity_service.record(
        db,
        description="Requested a password-change code",
        event="password_otp_sent",
        log_name=activity_service.LOG_AUTH,
        subject_type="User",
        subject_id=user.id,
        actor=user,
    )


def verify_password_otp(db: Session, user: User, code: str) -> None:
    """Check the code and open the grace window.

    Single use: the code is cleared whether or not the caller goes on to change
    their password, so a shoulder-surfed code cannot be replayed.
    """
    now = datetime.now(timezone.utc)

    if user.password_otp is None or user.password_otp_expires_at is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Request a code before entering one.",
        )

    if user.password_otp_expires_at <= now:
        user.password_otp = None
        user.password_otp_expires_at = None
        db.commit()
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "That code has expired. Request a fresh one and try again.",
        )

    if not verify_password(code, user.password_otp):
        # The code is NOT cleared on a wrong guess — doing so would let anyone who
        # can reach this endpoint invalidate the real user's code at will. The
        # ten-minute expiry bounds guessing instead.
        activity_service.record(
            db,
            description="Entered an incorrect password-change code",
            event="password_otp_failed",
            log_name=activity_service.LOG_AUTH,
            subject_type="User",
            subject_id=user.id,
            actor=user,
        )
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Invalid or expired code. Request a fresh one and try again.",
        )

    user.password_otp = None
    user.password_otp_expires_at = None
    user.password_otp_verified_at = now
    db.commit()

    activity_service.record(
        db,
        description="Proved email ownership for a password change",
        event="password_otp_verified",
        log_name=activity_service.LOG_AUTH,
        subject_type="User",
        subject_id=user.id,
        actor=user,
    )


def change_own_password(db: Session, user: User, data: ChangePasswordRequest) -> None:
    """Change a password, requiring the current one — or a verified OTP instead.

    A Google-only account has no password to verify, so it cannot use the
    current-password path — that would be a way to add a credential path to an SSO
    account without proving anything. It *can* use the OTP path, which is one of
    the three cases the OTP flow exists for.
    """
    via_otp = user.password_otp_grace

    if user.password is None and not via_otp:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "This account signs in with Google. Verify your email below to set a password.",
        )

    if not via_otp:
        if not data.current_password:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, "Current password is required"
            )
        if not verify_password(data.current_password, user.password or ""):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, "Current password is incorrect"
            )

    if user.password is not None and verify_password(data.password, user.password):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "New password must be different from the current one",
        )

    user.password = hash_password(data.password)
    user.password_reset_token = None
    user.password_reset_expires_at = None
    # Consume the grace, so one verification authorises exactly one change.
    user.password_otp = None
    user.password_otp_expires_at = None
    user.password_otp_verified_at = None
    user.updated_by = user.id
    db.commit()

    # The admin-set path logs in `user_service.update_user`; until this row the
    # holder changing their *own* password was invisible — the wrong half to
    # skip, since a hijacked session changing the password is exactly the event
    # an investigation reaches for. `via` says which proof was presented.
    activity_service.record(
        db,
        description=f"{user.email} changed their password",
        event="password_changed",
        log_name=activity_service.LOG_AUTH,
        subject_type="User",
        subject_id=user.id,
        actor=user,
        properties={"via": "email_otp" if via_otp else "current_password"},
    )


# --- Email verification (PM-35) ---------------------------------------------


def complete_email_verification(db: Session, token: str) -> User:
    """Mark an address verified from a signed token.

    Four things are checked, and the email match is the one that is easy to omit:
    the token must decode, be of the right `type`, name a real user, and **still
    match that user's current address**. Without the last check a link mailed to a
    typo'd address would verify whatever the address was later corrected to —
    proving control of an inbox nobody read.
    """
    invalid = HTTPException(
        status.HTTP_400_BAD_REQUEST, "This verification link is invalid or has expired."
    )

    try:
        payload = decode_typed_token(
            token, "email_verification", require=("sub", "email")
        )
    except TokenError:
        raise invalid
    user_id: str = payload["sub"]
    claimed_email: str = payload["email"]

    user = db.get(User, user_id)
    if user is None or user.email != normalise_email(claimed_email):
        raise invalid

    # Idempotent: a second click is a no-op rather than an error. The user cannot
    # tell the difference and does not need to.
    if user.email_verified_at is None:
        user.email_verified_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(user)

    return user


def issue_email_verification(user: User) -> str | None:
    """A fresh verification link for a user, or None if there is nothing to verify."""
    if user.email_verified_at is not None:
        return None
    token = create_email_verification_token(user.id, user.email)
    return f"{settings.FRONTEND_URL.rstrip('/')}/verify-email?token={token}"


# --- Password reset ---------------------------------------------------------

#: Named rather than inlined because the reset email quotes it. A literal in two
#: places is how an email ends up promising an hour for a token that lasts two.
PASSWORD_RESET_TTL_HOURS = 1


def begin_password_reset(db: Session, email: str) -> tuple[User, str] | None:
    """Issue a reset token, or return None when there is nothing to reset.

    Returning None rather than raising is what lets the endpoint answer
    identically whether or not the address exists — otherwise the endpoint
    becomes an account-enumeration oracle.
    """
    user = get_user_by_email(db, email)
    if user is None or user.password is None:
        return None

    token = generate_token(48)
    user.password_reset_token = token
    user.password_reset_expires_at = datetime.now(timezone.utc) + timedelta(
        hours=PASSWORD_RESET_TTL_HOURS
    )
    db.commit()

    # No causer: the requester is unauthenticated and has proved nothing yet —
    # naming the account holder as the actor would put words in their mouth.
    # The row still matters, because a burst of these against one address is a
    # takeover attempt in progress.
    activity_service.record(
        db,
        description=f"A password reset was requested for {user.email}",
        event="password_reset_requested",
        log_name=activity_service.LOG_AUTH,
        subject_type="User",
        subject_id=user.id,
    )
    return user, token


def complete_password_reset(db: Session, token: str, new_password: str) -> User:
    user = db.scalar(select(User).where(User.password_reset_token == token))

    invalid = HTTPException(
        status.HTTP_400_BAD_REQUEST, "This reset link is invalid or has expired"
    )
    if user is None or user.password_reset_expires_at is None:
        raise invalid
    if user.password_reset_expires_at <= datetime.now(timezone.utc):
        raise invalid

    user.password = hash_password(new_password)
    user.password_reset_token = None
    user.password_reset_expires_at = None
    # A successful reset also clears a lockout — the legitimate owner has just
    # proved control of the mailbox.
    user.failed_login_attempts = 0
    user.locked_until = None
    db.commit()
    db.refresh(user)

    # The causer here *has* proved control of the mailbox — unlike the request
    # row above. Recorded because a reset both replaces the credential and
    # clears a lockout, and either alone would deserve the row.
    activity_service.record(
        db,
        description=f"{user.email} reset their password via an emailed link",
        event="password_reset_completed",
        log_name=activity_service.LOG_AUTH,
        subject_type="User",
        subject_id=user.id,
        actor=user,
    )
    return user
