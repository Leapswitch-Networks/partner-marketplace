"""Per-IP HTTP rate limiting (TECH_DEBT PM-26).

Account lockout already exists — five consecutive failures against one account
locks it for fifteen minutes. That does nothing about the other shape of the
attack: one attempt each against thousands of accounts never trips a lockout,
and `/forgot-password` and `/invitations/preview` answer without a session at
all. This limits by **client IP** instead of by account, which is the axis
lockout cannot cover.

Three tiers, because one number cannot serve both a login form and a dashboard:

  * ``sensitive``  — credential and token endpoints. Tightest.
  * ``auth``       — the rest of ``{API_PREFIX}/auth/*``: session reads, refresh, logout.
                     The frontend calls ``/me`` on navigation, so this cannot be
                     as tight as ``sensitive`` without breaking normal use.
  * ``default``    — everything else.

Deliberately hand-written rather than pulling in ``slowapi``, matching the
choice made for bcrypt: one fewer dependency, and the default ``slowapi``
backend is in-process memory anyway, so it would not have fixed the real
limitation below.

**Known limitation — state is per process.** Counters live in this process's
memory, so running N workers multiplies every limit by N, and a restart clears
them. That is honest for the current single-container deployment and wrong the
moment the API is scaled horizontally; a shared store (Redis) is the fix, and
until then this is a speed bump for spraying, not an authorisation control.
Recorded in TECH_DEBT under PM-26.
"""

from __future__ import annotations

import time
from collections import defaultdict, deque
from threading import Lock

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.config import settings
from app.core.dependencies import get_client_ip

#: Paths where a request is an attempt at a credential, a token, or an
#: enumeration. Matched exactly, so adding a route does not silently inherit the
#: loosest tier — an unlisted path falls to ``auth`` or ``default``, and a new
#: sensitive endpoint must be added here on purpose.
SENSITIVE_PATHS: frozenset[str] = frozenset(
    {
        f"{settings.API_PREFIX}/auth/login",
        f"{settings.API_PREFIX}/auth/register",
        f"{settings.API_PREFIX}/auth/forgot-password",
        f"{settings.API_PREFIX}/auth/reset-password",
        f"{settings.API_PREFIX}/auth/accept-invitation",
        f"{settings.API_PREFIX}/auth/me/change-password",
        f"{settings.API_PREFIX}/invitations/preview",
        # 2FA (PM-34). These MUST stay in this tier. A six-digit code is one in a
        # million per guess, which is only strong while guesses are limited — and
        # `/two-factor-challenge` is unauthenticated by necessity, so this limit
        # plus the shared lockout counter is the entire brute-force defence.
        f"{settings.API_PREFIX}/auth/two-factor-challenge",
        # Re-proving a password is a password check, and belongs under the same
        # limit as one.
        f"{settings.API_PREFIX}/auth/me/confirm-password",
        # Email verification (PM-35). `resend-verification` sends mail to an
        # address the caller names, so without a tight limit it is a free relay for
        # mailbombing someone else. `verify-email` is limited because the token,
        # while signed, is worth guessing at scale.
        f"{settings.API_PREFIX}/auth/verify-email",
        f"{settings.API_PREFIX}/auth/resend-verification",
        # Password OTP recovery. `send` mails a code and must not become a way to
        # bombard the account owner's inbox — the 60-second per-account cooldown
        # bounds one caller, this bounds a distributed one. `verify` is a six-digit
        # guess, so it belongs under the same limit as the 2FA challenge above for
        # exactly the same reason.
        f"{settings.API_PREFIX}/auth/me/password-otp/send",
        f"{settings.API_PREFIX}/auth/me/password-otp/verify",
    }
)

#: Never limited: liveness and readiness probes. An orchestrator polling health
#: must not be able to exhaust its own quota and take the service out of a load
#: balancer.
EXEMPT_PREFIXES: tuple[str, ...] = ("/health",)


class SlidingWindowCounter:
    """Per-key sliding window over request timestamps.

    A sliding log rather than a fixed window: a fixed window lets a caller send
    the full allowance at 0:59 and again at 1:01, which is twice the intended
    rate at exactly the boundary an attacker would find. Memory is bounded by
    ``limit`` entries per active key, which at these limits is trivial.
    """

    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()
        self._checks_since_sweep = 0

    def hit(self, key: str, limit: int, window_seconds: int) -> tuple[bool, int, int]:
        """Record a request against ``key``.

        Returns ``(allowed, remaining, retry_after_seconds)``. When the caller is
        over the limit nothing is recorded, so being throttled does not extend
        the throttle — otherwise a client retrying in a loop could never recover.
        """
        now = time.monotonic()
        cutoff = now - window_seconds

        with self._lock:
            self._maybe_sweep(cutoff)
            hits = self._hits[key]
            while hits and hits[0] <= cutoff:
                hits.popleft()

            if len(hits) >= limit:
                retry_after = max(1, int(hits[0] + window_seconds - now) + 1)
                return False, 0, retry_after

            hits.append(now)
            return True, limit - len(hits), 0

    def _maybe_sweep(self, cutoff: float) -> None:
        """Drop keys whose windows have fully expired.

        Without this, one request per address leaves an empty deque behind for
        every address ever seen — a slow memory leak that a scan of the IP space
        would accelerate. Caller holds the lock.
        """
        self._checks_since_sweep += 1
        if self._checks_since_sweep < _SWEEP_EVERY:
            return
        self._checks_since_sweep = 0
        stale = [key for key, hits in self._hits.items() if not hits or hits[-1] <= cutoff]
        for key in stale:
            del self._hits[key]

    def reset(self) -> None:
        """Forget all counters. For tests and for administrative use."""
        with self._lock:
            self._hits.clear()
            self._checks_since_sweep = 0


#: Sensitive endpoints whose path carries a record id, so they cannot appear in
#: `SENSITIVE_PATHS` above — an exact set cannot match `/users/{id}/email`.
#:
#: Kept as explicit (prefix, suffix) pairs rather than a general regex so the
#: same property holds: a new endpoint does not silently inherit this tier, it
#: has to be added here on purpose.
#: Each entry is ``(prefix, suffix, bucket)``.
#:
#: ⚠️ The third element is load-bearing. Buckets are keyed ``f"{tier}:{ip}"``, so
#: everything sharing a tier name shares ONE counter per client. Putting these
#: outbound-mail routes on the plain ``sensitive`` tier would make ten resends
#: consume the same 10-per-minute budget as ``/auth/login`` — and the admin doing
#: the resending would then be unable to sign in for a minute. They get their own
#: bucket at the same limit instead, which is what "throttle this route" means
#: everywhere else; Laravel's ``throttle:10,1`` is per-route by default, so the
#: shared-bucket version was not parity either.
SENSITIVE_PATH_SHAPES: tuple[tuple[str, str, str], ...] = (
    # POST /users/{id}/email — sends mail to an address we hold, from the
    # platform's own sender. Unthrottled, one admin account is a spam relay.
    # The reference throttles the same route at 5/min.
    (f"{settings.API_PREFIX}/users/", "/email", "mail-user"),
    # POST /invitations/{id}/resend — the reference throttles this at 10/min.
    # Complements the per-invitation 60s cooldown in invitation_service: that
    # stops one invitee being mailed repeatedly, this stops one caller working
    # through the whole list.
    (f"{settings.API_PREFIX}/invitations/", "/resend", "mail-invite"),
)


def _sensitive_shape_bucket(path: str) -> str | None:
    """The dedicated bucket name for a shape-matched path, or None."""
    for prefix, suffix, bucket in SENSITIVE_PATH_SHAPES:
        if path.startswith(prefix) and path.endswith(suffix):
            return bucket
    return None


#: How many checks pass between memory sweeps. Sweeping on every request would
#: walk the whole key set each time; 1000 keeps it amortised to nothing.
_SWEEP_EVERY = 1000

counter = SlidingWindowCounter()


def _tier_for(path: str) -> tuple[str, int, int] | None:
    """Return ``(tier, limit, window)`` for a path, or ``None`` if exempt."""
    if path.startswith(EXEMPT_PREFIXES):
        return None
    shape_bucket = _sensitive_shape_bucket(path)
    if shape_bucket is not None:
        # Sensitive LIMITS, its own counter — see SENSITIVE_PATH_SHAPES.
        return (
            shape_bucket,
            settings.RATE_LIMIT_SENSITIVE_MAX_REQUESTS,
            settings.RATE_LIMIT_SENSITIVE_WINDOW_SECONDS,
        )
    if path in SENSITIVE_PATHS:
        return (
            "sensitive",
            settings.RATE_LIMIT_SENSITIVE_MAX_REQUESTS,
            settings.RATE_LIMIT_SENSITIVE_WINDOW_SECONDS,
        )
    if path.startswith(f"{settings.API_PREFIX}/auth"):
        return (
            "auth",
            settings.RATE_LIMIT_AUTH_MAX_REQUESTS,
            settings.RATE_LIMIT_AUTH_WINDOW_SECONDS,
        )
    return (
        "default",
        settings.RATE_LIMIT_DEFAULT_MAX_REQUESTS,
        settings.RATE_LIMIT_DEFAULT_WINDOW_SECONDS,
    )


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Reject a client that exceeds its tier's allowance with ``429``.

    Must be registered **before** ``CORSMiddleware`` in ``main.py``. Starlette
    runs the most recently added middleware outermost, so registering this first
    leaves CORS outside it — which matters because a ``429`` without
    ``Access-Control-Allow-Origin`` is unreadable to the browser, and the user
    would see an opaque network error instead of "too many attempts".
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        if not settings.RATE_LIMIT_ENABLED:
            return await call_next(request)

        # CORS preflights carry no credentials and are issued by the browser, not
        # the caller. Charging them would let a single real request cost two.
        if request.method == "OPTIONS":
            return await call_next(request)

        tier = _tier_for(request.url.path)
        if tier is None:
            return await call_next(request)

        name, limit, window = tier
        allowed, remaining, retry_after = counter.hit(
            f"{name}:{get_client_ip(request)}", limit, window
        )

        if not allowed:
            return JSONResponse(
                status_code=429,
                content={
                    "detail": (
                        "Too many requests. Please wait "
                        f"{retry_after} second{'s' if retry_after != 1 else ''} and try again."
                    )
                },
                headers={
                    "Retry-After": str(retry_after),
                    "X-RateLimit-Limit": str(limit),
                    "X-RateLimit-Remaining": "0",
                },
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        return response
