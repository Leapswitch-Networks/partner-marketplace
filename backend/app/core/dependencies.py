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

from datetime import datetime, timedelta, timezone
from typing import Callable, Generator

from fastapi import Cookie, Depends, HTTPException, Request, status
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.permissions import SUPER_ADMIN_ROLES
from app.core.security import decode_token
from app.db.session import SessionLocal
from app.models.user import User
from app.models.user_session import UserSession
from app.services import session_service


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_client_ip(request: Request) -> str:
    """Caller's IP — from the socket by default, from `X-Forwarded-For` only when
    a proxy is configured to be in front.

    `X-Forwarded-For` is a request header, which means the *client* writes it.
    Honouring it unconditionally, as this function used to, makes the value
    attacker-chosen whenever no proxy is actually stripping and rewriting it —
    and there is no reverse proxy in this deployment today.

    That is not a theoretical problem. It defeated the PM-26 rate limiter
    outright: rotating `X-Forwarded-For: 10.9.9.$i` produced a fresh bucket per
    request, and 14 requests sailed through a limit of 10 (measured, 2026-08-03).
    It would equally let an attacker write any address they liked into
    `users.last_login_ip` and poison the audit trail.

    So the header is trusted only when `TRUST_PROXY_HEADERS` says something
    trustworthy is setting it. Turn it on **together with** deploying a proxy
    that overwrites the header, never before: enabling it without one restores
    exactly the bypass above.

    Only the first hop is read, which is correct for exactly one proxy. Revisit
    for a chain of two.
    """
    if settings.TRUST_PROXY_HEADERS:
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# --- Authentication ---------------------------------------------------------

_CREDENTIALS_EXC = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
)


def _decode_access_token(token: str | None) -> tuple[str, str]:
    """Return `(user_id, session_id)` from a valid ACCESS token, or raise 401.

    The `type` assertion is what stops a refresh token being replayed as an
    access token — refresh tokens live for days, access tokens for an hour.

    `sid` is required, not optional. Treating a missing `sid` as "fine" would let
    any token minted before sessions existed bypass revocation entirely, which is
    exactly the hole this was added to close. Tokens issued before the change
    therefore fail closed and the user signs in again — a one-off inconvenience
    in exchange for the guarantee being real.
    """
    if not token:
        raise _CREDENTIALS_EXC
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise _CREDENTIALS_EXC
        return payload["sub"], payload["sid"]
    except (JWTError, KeyError):
        raise _CREDENTIALS_EXC


#: Distinct from the generic 401 so the client can tell "your session ended" from
#: "your token is malformed" and show something honest.
_SESSION_EXC = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Your session has ended. Please sign in again.",
)


def get_current_user(
    access_token: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
) -> User:
    """The authenticated, ACTIVE user behind the access-token cookie.

    Three checks, none of which trusts the token's own claims about them:

    1. **The user exists.**
    2. **The session is still live** — not revoked, not expired. This is what
       makes logout, and eviction on password change, take effect immediately
       instead of whenever the token happens to expire.
    3. **The account is ACTIVE**, re-read from the database on every request.
       Suspending an account therefore kills its live sessions at once.
    """
    user_id, session_id = _decode_access_token(access_token)

    user = db.get(User, user_id)
    if user is None:
        raise _CREDENTIALS_EXC

    session = session_service.get_active(db, session_id, user_id)
    if session is None:
        raise _SESSION_EXC

    if user.status != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Your account is awaiting administrator approval."
                if user.status == "INACTIVE"
                else "Your account has been suspended. Contact an administrator."
            ),
        )

    session_service.touch(db, session)
    return user


# --- Authorization ----------------------------------------------------------


def get_current_session(
    access_token: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
) -> UserSession:
    """The live session behind the request.

    Separate from `get_current_user` because a few things are properties of the
    *session* rather than the account — password confirmation being the one that
    forced it. Both guards resolve the same token, so a route needing both pays
    for two lookups; that is cheaper than caching state across a request boundary
    and getting the invalidation wrong.
    """
    user_id, session_id = _decode_access_token(access_token)
    session = session_service.get_active(db, session_id, user_id)
    if session is None:
        raise _SESSION_EXC
    return session


def require_password_confirmation(
    session: UserSession = Depends(get_current_session),
) -> UserSession:
    """Caller must have re-entered their password recently.

    Fortify's `password.confirm` middleware, which LeapDesk turns on for 2FA via
    `confirmPassword => true`. It guards the actions where holding a hijacked
    session should not be enough — turning 2FA **off** above all, since without
    this an attacker who stole a session could quietly remove the second factor
    that was protecting the account.

    Answers `403` with a distinguishable code rather than `401`: the caller *is*
    authenticated, and a client that treated this as `401` would sign the user out
    instead of prompting them for their password.
    """
    confirmed_at = session.password_confirmed_at
    if confirmed_at is None:
        raise _PASSWORD_CONFIRMATION_EXC

    age = datetime.now(timezone.utc) - confirmed_at
    if age > timedelta(minutes=settings.PASSWORD_CONFIRMATION_TIMEOUT_MINUTES):
        raise _PASSWORD_CONFIRMATION_EXC

    return session


_PASSWORD_CONFIRMATION_EXC = HTTPException(
    status_code=status.HTTP_403_FORBIDDEN,
    detail="Please confirm your password to continue.",
    headers={"X-Password-Confirmation-Required": "true"},
)


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
    "get_current_session",
    "require_password_confirmation",
    "require_permission",
    "require_any_permission",
    "require_roles",
    "require_super_admin",
    "require_admin_access",
    "SUPER_ADMIN_ROLES",
]
