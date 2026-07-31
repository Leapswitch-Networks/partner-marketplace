"""Request-scoped dependencies: the database session and every auth guard.

This is the ONLY place authentication and authorization are resolved. Routers
declare what they need; they never decode a token or check a role themselves.

Guard ladder, cheapest first:

    get_db                  session, closed in a finally
    get_current_user        valid access token + row exists + status ACTIVE
    require_permission(p)   ...plus holds permission `p` (super admins bypass)
    require_any_permission  ...plus holds at least one of several
    require_roles(*names)   ...plus holds one of the named roles
    require_super_admin     ...plus is RootUser/SuperAdmin

Every guard raises; none returns None. That means a router can treat the value
as non-optional.
"""

from typing import Callable, Generator

from fastapi import Cookie, Depends, HTTPException, Request, status
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.permissions import SUPER_ADMIN_ROLES
from app.core.security import decode_token
from app.db.session import SessionLocal
from app.models.user import User


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_client_ip(request: Request) -> str:
    """Caller's IP, honouring X-Forwarded-For when behind a proxy.

    Only the first hop is trusted, which is correct when exactly one reverse
    proxy sits in front. Revisit if a second proxy is ever added.
    """
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# --- Authentication ---------------------------------------------------------

_CREDENTIALS_EXC = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
)


def _decode_access_token(token: str | None) -> str:
    """Return the subject of a valid ACCESS token, or raise 401.

    The `type` assertion is what stops a refresh token being replayed as an
    access token — refresh tokens live for days, access tokens for an hour.
    """
    if not token:
        raise _CREDENTIALS_EXC
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise _CREDENTIALS_EXC
        return payload["sub"]
    except (JWTError, KeyError):
        raise _CREDENTIALS_EXC


def get_current_user(
    access_token: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
) -> User:
    """The authenticated, ACTIVE user behind the access-token cookie.

    Status is re-read from the database on **every request**, not trusted from
    the token. Suspending or deactivating an account therefore takes effect
    immediately, without waiting for the access token to expire.
    """
    user_id = _decode_access_token(access_token)

    user = db.get(User, user_id)
    if user is None:
        raise _CREDENTIALS_EXC

    if user.status != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Your account is awaiting administrator approval."
                if user.status == "INACTIVE"
                else "Your account has been suspended. Contact an administrator."
            ),
        )

    return user


# --- Authorization ----------------------------------------------------------


def require_permission(permission: str) -> Callable[..., User]:
    """Dependency factory: caller must hold `permission`.

    Usage — the permission is visible in the signature and in OpenAPI:

        @router.get("/users", dependencies=[Depends(require_permission(USER_VIEW))])

    Or, when the handler needs the actor:

        def list_users(actor: User = Depends(require_permission(USER_VIEW))):
    """

    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if not current_user.has_permission(permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This action requires the '{permission}' permission.",
            )
        return current_user

    return dependency


def require_any_permission(*permissions: str) -> Callable[..., User]:
    """Dependency factory: caller must hold at least ONE of `permissions`."""

    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if not current_user.has_any_permission(*permissions):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action.",
            )
        return current_user

    return dependency


def require_roles(*role_names: str) -> Callable[..., User]:
    """Dependency factory: caller must hold one of `role_names`.

    Prefer `require_permission` — a role check hardcodes org structure into a
    route. Use this only where the rule genuinely is about the role itself.
    """

    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if not current_user.has_role(*role_names):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your role does not permit this action.",
            )
        return current_user

    return dependency


def require_super_admin(current_user: User = Depends(get_current_user)) -> User:
    """Caller must be RootUser or SuperAdmin."""
    if not current_user.is_super_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super-admin privileges required.",
        )
    return current_user


def require_admin_access(current_user: User = Depends(get_current_user)) -> User:
    """Caller sees all records rather than only their own."""
    if not current_user.has_admin_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator access required.",
        )
    return current_user


__all__ = [
    "get_db",
    "get_client_ip",
    "get_current_user",
    "require_permission",
    "require_any_permission",
    "require_roles",
    "require_super_admin",
    "require_admin_access",
    "SUPER_ADMIN_ROLES",
]
