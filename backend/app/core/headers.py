"""Security response headers (TECH_DEBT PM-33).

Ported from LeapDesk's `SecurityHeaders` middleware, which it registers globally.
We sent none of these.

**Which of these actually matter here, and which are inherited habit.** LeapDesk
serves HTML, so framing and sniffing protections apply directly to its pages.
This service returns JSON to a separate Next.js app, so the honest ranking is:

  * ``Strict-Transport-Security`` — **the one that matters most.** It is what stops
    a downgrade to plain HTTP from ever exposing the auth cookie. Gated on
    `HSTS_ENABLED` rather than on `COOKIE_SECURE`, because the two answer
    different questions: whether cookies require TLS, versus whether this host
    should be pinned to HTTPS for a year by every browser that has seen it. Get
    HSTS wrong on a host without a valid certificate and it is not a warning, it
    is an outage you cannot clear from the server side.
  * ``X-Content-Type-Options: nosniff`` — cheap and genuinely useful: it stops a
    browser deciding a JSON error body is HTML and executing it.
  * ``Referrer-Policy`` — real value. Password-reset and invitation links carry a
    token in the query string, and without this the full URL can travel in a
    `Referer` header to any host the page later talks to.
  * ``X-Frame-Options`` / ``Content-Security-Policy: frame-ancestors`` — near
    useless on a JSON API, which nobody frames, but free and correct.
  * ``X-XSS-Protection`` — **deliberately not set.** It controlled an auditor that
    every current browser has removed, Chrome dropped it in 2019, and it could
    itself be abused to selectively block scripts. LeapDesk sets it; copying a
    dead header for symmetry would be cargo-culting, so this is one place the port
    diverges on purpose.
  * ``Permissions-Policy`` — applies to a document's feature access, so it does
    nothing on an API response. Set anyway, at no cost, because a browser that
    ever renders one of these bodies directly should get it.

**The frontend needs its own.** These headers protect responses *this* service
sends. The Next.js app is a separate origin serving the actual HTML, and a header
here does nothing for a page it did not serve — that belongs in
`next.config.mjs`, and is done in the same change.
"""

from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.config import settings

#: Applied to every response. Static, so it is built once at import.
_HEADERS: dict[str, str] = {
    # A browser must respect the declared Content-Type rather than guessing.
    "X-Content-Type-Options": "nosniff",
    # Send only the origin cross-site, so a reset token in a query string cannot
    # leak through a Referer header.
    "Referrer-Policy": "strict-origin-when-cross-origin",
    # Legacy framing control, plus its modern replacement. Cheap, and correct for
    # an API that should never be embedded.
    "X-Frame-Options": "SAMEORIGIN",
    "Content-Security-Policy": "frame-ancestors 'self'",
    # Meaningless on a JSON response, harmless to state.
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
}


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Attach hardening headers to every response, including error responses.

    Registered so that it wraps the error handlers too: a 500 or a 429 is exactly
    the response an attacker is probing with, and it should not be the one that
    arrives unprotected.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)

        for name, value in _HEADERS.items():
            # setdefault semantics: never clobber a header a handler set
            # deliberately, so a route that needs a different CSP can say so.
            if name not in response.headers:
                response.headers[name] = value

        if settings.HSTS_ENABLED:
            directive = f"max-age={settings.HSTS_MAX_AGE_SECONDS}"
            if settings.HSTS_INCLUDE_SUBDOMAINS:
                directive += "; includeSubDomains"
            if settings.HSTS_PRELOAD:
                directive += "; preload"
            response.headers["Strict-Transport-Security"] = directive

        return response
