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

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.permissions import DEFAULT_PARTNER_ROLE
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
from app.services import activity_service
from app.services.rbac_service import get_role_by_name

#: Deliberately identical for "no such user" and "wrong password".
_INVALID_CREDENTIALS = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Invalid email or password",
)


def normalise_email(email: str) -> str:
    return email.strip().lower()


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == normalise_email(email)))


def email_exists(db: Session, email: str, exclude_user_id: str | None = None) -> bool:
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
    if not settings.ALLOW_PARTNER_SELF_REGISTRATION:
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
        account_type="partner",
        auth_provider="password",
        status=settings.NEW_USER_DEFAULT_STATUS,
    )

    default_role = get_role_by_name(db, DEFAULT_PARTNER_ROLE)
    if default_role:
        user.roles.append(default_role)

    db.add(user)
    db.commit()
    db.refresh(user)
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
        detail = (
            "Your account is awaiting administrator approval."
            if user.status == "INACTIVE"
            else "Your account has been suspended. Contact an administrator."
        )
        # Recorded as a failure rather than a login: the credentials were right,
        # but no session was created. Calling it a login would be wrong, and
        # dropping it would hide someone repeatedly probing a suspended account.
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

    for field in ("first_name", "last_name"):
        if field in updates and updates[field] is not None:
            setattr(user, field, updates[field].strip())

    for field in ("designation", "personal_mobile_number", "personal_email", "company_name"):
        if field in updates:
            value = (updates[field] or "").strip()
            setattr(user, field, value or None)

    if updates.get("timezone_preference"):
        user.timezone_preference = updates["timezone_preference"]

    user.updated_by = user.id
    db.commit()
    db.refresh(user)
    return user


def change_own_password(db: Session, user: User, data: ChangePasswordRequest) -> None:
    """Change a password, requiring the current one.

    A Google-only account has no password to verify, so it cannot use this — it
    would be a way to add a credential path to an SSO account without proving
    anything.
    """
    if user.password is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "This account signs in with Google and has no password to change.",
        )

    if not verify_password(data.current_password, user.password):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is incorrect")

    if verify_password(data.password, user.password):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "New password must be different from the current one",
        )

    user.password = hash_password(data.password)
    user.password_reset_token = None
    user.password_reset_expires_at = None
    user.updated_by = user.id
    db.commit()


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
    return user
