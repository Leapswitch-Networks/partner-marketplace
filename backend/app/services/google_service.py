"""Google OAuth 2.0 sign-in.

Implemented directly against Google's endpoints with httpx rather than via an
SDK — the authorization-code flow is three requests and an SDK would add a
dependency for no gain.

Security properties:
  * `state` is a signed, expiring JWT, so the callback can verify the request
    originated here (CSRF defence on the OAuth handshake). It also carries the
    optional invitation token, which is why it must be signed rather than a
    random nonce in a cookie.
  * Only configured staff domains may sign in with Google. A `hd` hint is sent
    to Google as a convenience, but the domain is re-checked server-side on the
    returned email, because `hd` is a hint and not a guarantee.
  * A first-time Google user is created INACTIVE — SSO proves identity, not
    authorisation. An admin still has to approve.
"""

from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx
from fastapi import HTTPException, status
from jose import jwt
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.permissions import DEFAULT_INTERNAL_ROLE
from app.core.security import TokenError, decode_typed_token
from app.models.user import User
from app.services.rbac_service import get_role_by_name

GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo"

_SCOPES = "openid email profile"
_STATE_TTL_MINUTES = 10


def _require_configured() -> None:
    if not settings.google_oauth_configured:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Google sign-in is not configured on this server.",
        )


# --- state ------------------------------------------------------------------


def _issue_state(invitation_token: str | None) -> str:
    payload = {
        "type": "oauth_state",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=_STATE_TTL_MINUTES),
        "inv": invitation_token or "",
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def _verify_state(state: str) -> str | None:
    """Return the invitation token carried in `state`, or raise if state is bad.

    Uses the shared typed decoder (PM-13), so the `type` assertion that keeps the
    OAuth state token from being interchangeable with an access token lives in one
    place rather than being re-implemented here. `inv` is intentionally NOT in
    `require`: an empty invitation is the normal case for a plain sign-in.
    """
    try:
        payload = decode_typed_token(state, "oauth_state")
    except TokenError:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "The sign-in request expired or was tampered with. Please try again.",
        )
    return payload.get("inv") or None


# --- flow -------------------------------------------------------------------


def build_authorization_url(invitation_token: str | None = None) -> str:
    _require_configured()

    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": _SCOPES,
        "access_type": "online",
        "prompt": "select_account",
        "state": _issue_state(invitation_token),
    }
    # A hint only — the domain is re-verified on the returned email below.
    if len(settings.staff_domains) == 1:
        params["hd"] = settings.staff_domains[0]

    return f"{GOOGLE_AUTH_ENDPOINT}?{urlencode(params)}"


def exchange_code(code: str) -> dict:
    """Swap an authorization code for tokens, then fetch the user's profile."""
    _require_configured()

    with httpx.Client(timeout=10.0) as client:
        token_response = client.post(
            GOOGLE_TOKEN_ENDPOINT,
            data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
            headers={"Accept": "application/json"},
        )
        if token_response.status_code != 200:
            raise HTTPException(
                status.HTTP_401_UNAUTHORIZED,
                "Google rejected the sign-in attempt. Please try again.",
            )

        access_token = token_response.json().get("access_token")
        if not access_token:
            raise HTTPException(
                status.HTTP_401_UNAUTHORIZED, "Google did not return an access token."
            )

        userinfo_response = client.get(
            GOOGLE_USERINFO_ENDPOINT,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if userinfo_response.status_code != 200:
            raise HTTPException(
                status.HTTP_401_UNAUTHORIZED, "Could not read your Google profile."
            )

    return userinfo_response.json()


def verify_state_and_get_invitation(state: str) -> str | None:
    return _verify_state(state)


def _split_name(profile: dict, email: str) -> tuple[str, str]:
    """Best-effort first/last name from a Google profile.

    Google usually supplies `given_name`/`family_name`, but not always (some
    Workspace accounts only carry a display name). Falls back to splitting `name`
    on the first space, then to the email's local part, so `first_name` is never
    empty — the column is NOT NULL.
    """
    given = (profile.get("given_name") or "").strip()
    family = (profile.get("family_name") or "").strip()
    if given or family:
        return given, family

    parts = (profile.get("name") or email.split("@")[0]).strip().split(" ", 1)
    return parts[0], (parts[1] if len(parts) > 1 else "")


def find_or_create_from_google(db: Session, profile: dict) -> User:
    """Resolve a Google profile to a local account, creating one if needed.

    Three-step resolution, matching LeapDesk:
      1. known `google_id`     -> returning user, refresh the avatar
      2. known email           -> existing account, LINK the Google identity
      3. neither               -> create, INACTIVE, pending approval

    Step 2 is what lets an account created by an admin (or by invitation) be
    claimed via SSO without a duplicate being made.
    """
    google_id = profile.get("sub")
    email = (profile.get("email") or "").strip().lower()
    email_verified = bool(profile.get("email_verified"))

    if not google_id or not email:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Google did not return an email address."
        )

    # Google's own verification must hold, or an unverified address could be
    # used to claim someone else's account in step 2.
    if not email_verified:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Your Google email address is not verified.",
        )

    if not settings.is_staff_email(email):
        allowed = ", ".join("@" + d for d in settings.staff_domains)
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            f"Google sign-in is limited to {allowed}. "
            "Partners should sign in with their email and password.",
        )

    avatar = profile.get("picture")

    # 1. Returning Google user.
    user = db.scalar(select(User).where(User.google_id == google_id))
    if user is not None:
        user.google_avatar = avatar
        db.commit()
        db.refresh(user)
        return user

    # 2. Existing local account — link it.
    user = db.scalar(select(User).where(User.email == email))
    if user is not None:
        user.google_id = google_id
        user.google_avatar = avatar
        user.auth_provider = "google"
        user.account_type = "internal"
        if user.email_verified_at is None:
            user.email_verified_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(user)
        return user

    # 3. Brand new staff account, INACTIVE until approved.
    given, family = _split_name(profile, email)

    user = User(
        email=email,
        password=None,
        google_id=google_id,
        google_avatar=avatar,
        auth_provider="google",
        email_verified_at=datetime.now(timezone.utc),
        first_name=given,
        last_name=family,
        account_type="internal",
        status=settings.NEW_USER_DEFAULT_STATUS,
    )

    default_role = get_role_by_name(db, DEFAULT_INTERNAL_ROLE)
    if default_role:
        user.roles.append(default_role)

    db.add(user)
    db.commit()
    db.refresh(user)
    return user
