"""Google OAuth endpoints.

The browser must perform a full navigation for OAuth, not an XHR — an AJAX
request to Google is blocked by CORS. So `/authorize` returns a URL for the
frontend to navigate to (or redirects directly), and `/callback` is hit by
Google, sets the session cookies, and 302s back into the frontend.

Because the callback redirects rather than returning JSON, failures are
communicated as a query parameter on the frontend URL rather than as an HTTP
error the browser would render as a bare error page.
"""

from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.api.auth import set_auth_cookies
from app.core.config import settings
from app.core.dependencies import get_client_ip, get_db
from app.schemas.auth import GoogleAuthUrlResponse
from app.services import auth_service, google_service, invitation_service, session_service

router = APIRouter(prefix="/auth/google", tags=["auth"])


def _frontend_redirect(path: str, **params: str) -> RedirectResponse:
    base = settings.FRONTEND_URL.rstrip("/")
    query = f"?{urlencode(params)}" if params else ""
    return RedirectResponse(url=f"{base}{path}{query}", status_code=302)


@router.get("/authorize", response_model=GoogleAuthUrlResponse)
def authorize(
    invitation: str | None = Query(default=None, description="Optional invitation token"),
) -> GoogleAuthUrlResponse:
    """Return the Google consent URL for the frontend to navigate to."""
    return GoogleAuthUrlResponse(
        authorization_url=google_service.build_authorization_url(invitation)
    )


@router.get("/redirect")
def redirect_to_google(
    invitation: str | None = Query(default=None),
) -> RedirectResponse:
    """Server-side redirect variant, for a plain `<a href>` link."""
    return RedirectResponse(
        url=google_service.build_authorization_url(invitation), status_code=302
    )


@router.get("/callback")
def callback(
    request: Request,
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> RedirectResponse:
    """Google's redirect target. Always lands the browser back on the frontend."""
    if error:
        return _frontend_redirect("/sign-in", error="Google sign-in was cancelled.")

    if not code or not state:
        return _frontend_redirect("/sign-in", error="Google sign-in did not complete.")

    try:
        invitation_token = google_service.verify_state_and_get_invitation(state)
        profile = google_service.exchange_code(code)
        user = google_service.find_or_create_from_google(db, profile)

        if invitation_token:
            invitation_service.apply_to_google_user(db, invitation_token, user)

        # Approval gate: SSO proves who you are, not that you may enter.
        if user.status != "ACTIVE":
            message = (
                "Your account has been created and is awaiting administrator approval."
                if user.status == "INACTIVE"
                else "Your account has been suspended. Contact an administrator."
            )
            return _frontend_redirect("/sign-in", error=message)

        auth_service.record_login(db, user, get_client_ip(request))

        # An SSO sign-in is a sign-in: it gets a session row like any other, so
        # logout and password-change eviction apply to it identically. Omitting
        # this would leave Google users with unrevocable tokens.
        session = session_service.create(
            db,
            user,
            ip=get_client_ip(request),
            user_agent=request.headers.get("User-Agent"),
        )

        response = _frontend_redirect("/dashboard")
        set_auth_cookies(response, user.id, session.id)
        return response

    except HTTPException as exc:
        # Surface the reason on the sign-in page rather than as a raw error page.
        return _frontend_redirect("/sign-in", error=str(exc.detail))
