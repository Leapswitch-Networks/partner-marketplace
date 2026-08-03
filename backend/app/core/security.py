"""Password hashing and JWT issuing/verification.

Passwords are hashed with bcrypt. This module previously stored and compared
plaintext (TECH_DEBT PM-1) — do not reintroduce that. `verify_password` is
deliberately the ONLY place a supplied password is compared against a stored
value; never write `stored == plain` anywhere else.
"""

import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
from jose import jwt

from app.core.config import settings


# --- Passwords --------------------------------------------------------------


def hash_password(plain: str) -> str:
    """Hash a plaintext password with bcrypt, returning the encoded digest."""
    salt = bcrypt.gensalt(rounds=settings.BCRYPT_ROUNDS)
    digest = bcrypt.hashpw(_prepare(plain), salt)
    return digest.decode("utf-8")


def verify_password(plain: str, stored: str | None) -> bool:
    """Constant-time check of a plaintext password against a stored bcrypt digest.

    Returns False (rather than raising) when the account has no password at all —
    Google-only users have `password = NULL`, and they must not be able to
    authenticate by supplying an empty string.
    """
    if not stored or not plain:
        return False
    try:
        return bcrypt.checkpw(_prepare(plain), stored.encode("utf-8"))
    except (ValueError, TypeError):
        # Malformed/legacy digest — treat as a failed login, never as a pass.
        return False


def is_bcrypt_digest(stored: str | None) -> bool:
    """True when `stored` looks like a bcrypt digest rather than legacy plaintext.

    Diagnostic only. The login path deliberately does NOT accept a non-bcrypt
    value — `verify_password` rejects it — because accepting one would mean
    keeping a plaintext comparison in the codebase. Pre-existing plaintext rows
    were hashed in place by the migration that introduced hashing, so this should
    never be False in practice; if it is, that row cannot authenticate and needs
    a password reset.
    """
    if not stored:
        return False
    return stored.startswith(("$2a$", "$2b$", "$2y$"))


def _prepare(plain: str) -> bytes:
    """Encode a password for bcrypt, respecting its 72-byte input limit.

    bcrypt silently truncates beyond 72 bytes; some builds raise instead. Doing
    it explicitly keeps behaviour identical across versions.
    """
    return plain.encode("utf-8")[:72]


# --- Random tokens ----------------------------------------------------------


def generate_token(length: int = 64) -> str:
    """URL-safe cryptographically random token, used for invitations and resets."""
    return secrets.token_urlsafe(length)[:length]


# --- JWT --------------------------------------------------------------------


def _create_token(
    subject: Any, expire_delta: timedelta, token_type: str, session_id: str
) -> str:
    """Build a signed token.

    Claims, and why each is here:

      ``sub``   the user id.
      ``type``  ``access`` or ``refresh``. Asserted on decode, which is what stops
                a seven-day refresh token being replayed as an hour-long access
                token.
      ``sid``   the `user_sessions` row backing this token. **This is what makes
                revocation possible at all** — a JWT cannot be un-issued, so the
                guard checks the named session is still live. Without it, logout
                could do nothing but clear a cookie.
      ``iat``   issued-at. Not used for a decision today; present because
                debugging "which token is this?" without it means guessing.
    """
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(subject),
        "exp": now + expire_delta,
        "iat": now,
        "type": token_type,
        "sid": session_id,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_access_token(subject: Any, session_id: str) -> str:
    return _create_token(
        subject,
        timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        "access",
        session_id,
    )


def create_refresh_token(subject: Any, session_id: str) -> str:
    return _create_token(
        subject,
        timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        "refresh",
        session_id,
    )


def create_two_factor_challenge_token(subject: Any) -> str:
    """Short-lived token proving the password step passed, 2FA step pending.

    Issued when credentials are correct but the account has 2FA enabled, and
    exchanged at `/two-factor-challenge` for a real session.

    It carries `type: "two_factor"`, which is what stops it being used as an access
    token: `_decode_access_token` asserts `type == "access"`. That assertion is the
    only thing standing between "passed the password" and "authenticated", so it
    must never be relaxed to accept several types.

    No `sid`: there is no session yet, and that is the point — a caller stuck at the
    challenge has nothing that `get_current_user` will accept.
    """
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(subject),
        "exp": now + timedelta(minutes=settings.TWO_FACTOR_CHALLENGE_TTL_MINUTES),
        "iat": now,
        "type": "two_factor",
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict:
    """Raises JWTError if the token is invalid or expired."""
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
