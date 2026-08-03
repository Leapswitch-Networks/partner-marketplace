"""TOTP two-factor authentication (PM-34).

Behavioural port of Laravel Fortify's `twoFactorAuthentication` feature, which
LeapDesk enables with `confirm: true` and `confirmPassword: true`. There is no
Fortify for FastAPI — `fastapi-users` is the nearest analogue and has no 2FA at
all, and adopting it would mean replacing an auth layer that is already audited.
So this is built directly, on `pyotp` plus the Fernet helper in `core/encryption`.

**The three-state model, which is the part worth understanding.**

    no secret                      → 2FA off
    secret, confirmed_at NULL      → enrolled but UNPROVEN. 2FA is NOT enforced.
    secret + confirmed_at          → 2FA on

The middle state is Fortify's `confirm => true` and it exists to prevent a
self-inflicted lockout. If storing a secret were enough to enforce 2FA, anyone who
mis-scanned the QR — or scanned it into an app on a phone they then wiped — would
be required to produce codes nothing can generate, with no way back in. So
enrolment hands over a secret and changes nothing until the user proves, once, that
they can read a code from it.

**Recovery codes are the other half of not being locked out.** A phone is lost far
more often than a password. Eight single-use codes are issued at enrolment; each is
deleted the moment it is used, so a code read over someone's shoulder is worth one
login at most. They are stored encrypted as a JSON array, and shown to the user
exactly once — regenerating is possible, retrieving is not.

**What is deliberately NOT done here: rate limiting the code check.** A six-digit
code is one in a million per attempt, so unlimited guesses are a real attack. It is
not re-implemented in this module because the per-IP limiter (PM-26) already covers
`/api/auth/*` and the account lockout counts failures — but the challenge endpoint
must be in `SENSITIVE_PATHS`, and that is asserted in the router rather than left to
chance.
"""

from __future__ import annotations

import json
import logging
import secrets
from datetime import datetime, timezone

import pyotp
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.encryption import decrypt, encrypt
from app.models.user import User

logger = logging.getLogger("app.two_factor")

#: Recovery codes are shown to a human who may retype them. Excludes the
#: characters people confuse — 0/O, 1/I/l — so a mistyped code means "wrong code"
#: rather than "this code never existed".
_RECOVERY_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
_RECOVERY_GROUP = 5


def _new_recovery_code() -> str:
    """A code shaped `XXXXX-XXXXX`, from a CSPRNG."""
    halves = [
        "".join(secrets.choice(_RECOVERY_ALPHABET) for _ in range(_RECOVERY_GROUP))
        for _ in range(2)
    ]
    return "-".join(halves)


def _read_recovery_codes(user: User) -> list[str]:
    """Decrypt the stored codes. Returns [] when unreadable rather than raising.

    Unreadable means a rotated `SECRET_KEY`, and the safe interpretation is "no
    recovery codes exist" — never "accept anything".
    """
    raw = decrypt(user.two_factor_recovery_codes)
    if not raw:
        return []
    try:
        codes = json.loads(raw)
    except (ValueError, TypeError):
        logger.error("recovery codes were unreadable", extra={"user_id": user.id})
        return []
    return [str(code) for code in codes] if isinstance(codes, list) else []


def _write_recovery_codes(user: User, codes: list[str]) -> None:
    user.two_factor_recovery_codes = encrypt(json.dumps(codes))


# --- Enrolment --------------------------------------------------------------


def begin_enrolment(db: Session, user: User) -> tuple[str, str, list[str]]:
    """Generate a secret and recovery codes. Returns `(secret, otpauth_uri, codes)`.

    Does **not** enable 2FA — `two_factor_confirmed_at` stays NULL until
    `confirm_enrolment` succeeds. Calling this again before confirming replaces the
    pending secret, which is what a user who mis-scanned the first QR needs.

    Refuses when 2FA is already confirmed: silently replacing a working secret
    would be a way to knock out someone's second factor with one request.
    """
    if user.has_two_factor_enabled:
        raise ValueError("Two-factor authentication is already enabled.")

    secret = pyotp.random_base32()
    codes = [_new_recovery_code() for _ in range(settings.TWO_FACTOR_RECOVERY_CODE_COUNT)]

    user.two_factor_secret = encrypt(secret)
    _write_recovery_codes(user, codes)
    user.two_factor_confirmed_at = None
    db.commit()

    uri = pyotp.TOTP(secret).provisioning_uri(
        name=user.email, issuer_name=settings.TWO_FACTOR_ISSUER
    )
    # The plaintext secret and the codes are returned once, here, and are not
    # retrievable afterwards — the columns hold ciphertext and nothing decrypts
    # them for display.
    return secret, uri, codes


def confirm_enrolment(db: Session, user: User, code: str) -> bool:
    """Activate 2FA once the user proves they can generate a code."""
    if user.two_factor_secret is None:
        return False
    if not verify_totp(user, code):
        return False

    user.two_factor_confirmed_at = datetime.now(timezone.utc)
    db.commit()
    return True


def disable(db: Session, user: User) -> None:
    """Turn 2FA off and destroy the secret and codes.

    Cleared rather than merely unconfirmed: leaving a secret behind means
    re-enabling would silently resurrect a factor the user believed they had
    removed, possibly one held by an authenticator they no longer control.
    """
    user.two_factor_secret = None
    user.two_factor_recovery_codes = None
    user.two_factor_confirmed_at = None
    db.commit()


def regenerate_recovery_codes(db: Session, user: User) -> list[str]:
    """Issue a fresh set, invalidating every previous code."""
    codes = [_new_recovery_code() for _ in range(settings.TWO_FACTOR_RECOVERY_CODE_COUNT)]
    _write_recovery_codes(user, codes)
    db.commit()
    return codes


# --- Verification -----------------------------------------------------------


def verify_totp(user: User, code: str) -> bool:
    """Check a six-digit code against the stored secret."""
    secret = decrypt(user.two_factor_secret)
    if not secret:
        return False

    cleaned = (code or "").strip().replace(" ", "")
    if not cleaned.isdigit():
        return False

    # valid_window accepts ±N 30-second steps, tolerating a phone clock that is
    # slightly out. pyotp compares in constant time internally.
    return pyotp.TOTP(secret).verify(cleaned, valid_window=settings.TWO_FACTOR_WINDOW)


def consume_recovery_code(db: Session, user: User, code: str) -> bool:
    """Verify and **spend** a recovery code. Single use, by deletion.

    Matching is case-insensitive and ignores surrounding whitespace, because these
    are retyped by hand. Comparison uses `secrets.compare_digest` per candidate so
    a timing difference cannot reveal how much of a code was correct.
    """
    supplied = (code or "").strip().upper().replace(" ", "")
    if not supplied:
        return False

    codes = _read_recovery_codes(user)
    for stored in codes:
        if secrets.compare_digest(stored.upper(), supplied):
            remaining = [c for c in codes if c != stored]
            _write_recovery_codes(user, remaining)
            db.commit()
            logger.info(
                "recovery code used",
                extra={"user_id": user.id, "remaining": len(remaining)},
            )
            return True
    return False


def remaining_recovery_codes(user: User) -> int:
    """How many codes are left. Safe to expose — a count reveals no code."""
    return len(_read_recovery_codes(user))
