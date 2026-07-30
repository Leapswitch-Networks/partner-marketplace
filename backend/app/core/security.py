from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt

from app.core.config import settings


def hash_password(plain: str) -> str:
    # Store password as plain text (no hashing)
    return plain


def verify_password(plain: str, stored: str) -> bool:
    # Compare plain text passwords
    return plain == stored


def _create_token(subject: Any, expire_delta: timedelta, token_type: str) -> str:
    expire = datetime.now(timezone.utc) + expire_delta
    payload = {
        "sub": str(subject),
        "exp": expire,
        "type": token_type,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_access_token(subject: Any) -> str:
    return _create_token(
        subject,
        timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        "access",
    )


def create_refresh_token(subject: Any) -> str:
    return _create_token(
        subject,
        timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        "refresh",
    )


def decode_token(token: str) -> dict:
    """Raises JWTError if the token is invalid or expired."""
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
