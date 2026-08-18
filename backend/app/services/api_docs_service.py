"""A catalogue of what the API exposes, and what gates each part of it.

LeapDesk parity Module 15. The reference renders its docs from `api_resources`
plus a constant operator list, so the page cannot go stale relative to what the
API actually exposes. **We start ahead**: `backend/openapi.json` is generated from
the running application and CI-checked for staleness (PM-42), so a second
catalogue would be a second thing to keep true.

So this is a *reader* over the live application rather than a registry. Two
consequences worth stating:

**It is built from `app.routes`, not from the committed file.** The committed
document can be regenerated and out of date between a code change and the next
`export_openapi` run; the route table cannot — it is the thing serving the
requests.

**It answers the question OpenAPI does not.** Our authorization is a FastAPI
dependency, not an OpenAPI security scheme, so the generated document says
nothing about which permission a route requires. That is the single most useful
fact about an endpoint here, and `VERSION_SUMMARY.md` already leans on it:
gating is declarative per route *"so an ungated route is obvious in review"*.
This makes that literal — every route is listed with its permission, and the ones
with none are counted and shown first.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from fastapi import FastAPI
from fastapi.routing import APIRoute

#: Dependency function names that mean "a signed-in user is required". Matched by
#: name rather than by identity because the dependency graph holds the inner
#: closure, not the factory that produced it.
AUTH_MARKERS = frozenset({"get_current_user", "dependency", "get_current_active_user"})

#: Public by design. **Every entry is here for a reason, and the list is
#: deliberately explicit rather than a wildcard on `/auth`** — `/auth/me/*` is
#: authenticated, and a prefix rule would have quietly excused it too.
#:
#: The point of the list is the number it produces: `unexpected_public` should be
#: **zero**, so any growth is a review item rather than a statistic somebody
#: stopped reading.
EXPECTED_PUBLIC_PREFIXES: tuple[str, ...] = (
    # Liveness and readiness. An orchestrator cannot authenticate.
    "/health",
    # FastAPI's own documentation surfaces.
    "/docs",
    "/redoc",
    "/openapi.json",
)

#: Exact paths that are public because the caller has no account *yet*, or has
#: lost access to one. Each is unauthenticated by necessity, not by omission.
EXPECTED_PUBLIC_PATHS: frozenset[str] = frozenset(
    {
        # Signing in, and everything on the way to it.
        "/api/v1/auth/login",
        "/api/v1/auth/register",
        "/api/v1/auth/refresh",
        # Deliberately public: a session that has already expired must still be
        # able to clear its cookie, and requiring auth to log out means a stuck
        # user cannot get unstuck.
        "/api/v1/auth/logout",
        # Password recovery — by definition reached without a password.
        "/api/v1/auth/forgot-password",
        "/api/v1/auth/reset-password",
        # Email verification and the second factor: the caller holds a token or a
        # code, which is the credential being checked.
        "/api/v1/auth/verify-email",
        "/api/v1/auth/resend-verification",
        "/api/v1/auth/two-factor-challenge",
        # Accepting an invitation creates the account, so there is none to
        # authenticate as. `preview` renders that page before acceptance.
        "/api/v1/auth/accept-invitation",
        "/api/v1/invitations/preview",
        # Google SSO's three legs, all pre-account.
        "/api/v1/auth/google/authorize",
        "/api/v1/auth/google/callback",
        "/api/v1/auth/google/redirect",
        # Branding renders the sign-in screen, which is by definition seen before
        # signing in. Read-only; the write route is gated.
        "/api/v1/settings/branding",
        "/api/v1/settings/branding/themes",
        "/api/v1/settings/branding/{asset}",
        # ── The public directory — DIRECTORY_BUILD_PUNCHLIST Phase 2 ─────────
        #
        # The anonymous surface. Public by design: a directory nobody can read
        # without an account is not a directory.
        #
        # What keeps it safe is not a guard but the response models — every
        # route here returns a `Public*` type from `schemas/directory.py`, and
        # those types have no `notes`, `gst_number`, `pan_number` or `status`
        # field to leak. See the SECURITY notes in `tests/test_route_enforcement.py`.
        "/api/v1/public/categories",
        "/api/v1/public/partners",
        "/api/v1/public/partners/{slug}",
        "/api/v1/public/listings",
        "/api/v1/public/listings/{slug}",
        # A listed partner's logo or banner. Served under a restrictive CSP —
        # see the SECURITY note in tests/test_route_enforcement.py.
        "/api/v1/public/partners/{slug}/brand/{asset}",
        # The only unauthenticated write in the application. Rate limited.
        "/api/v1/public/enquiries",
        # A capability URL — the unguessable reference is the credential.
        "/api/v1/public/enquiries/{reference}",
    }
)


def is_expected_public(path: str) -> bool:
    return path.startswith(EXPECTED_PUBLIC_PREFIXES) or path in EXPECTED_PUBLIC_PATHS


@dataclass
class Operation:
    """One route, as a person reviewing access would want to read it."""

    method: str
    path: str
    name: str
    summary: str
    tag: str
    #: Permissions the route declares. More than one means "any of these".
    permissions: list[str] = field(default_factory=list)
    #: True when *some* authentication dependency is present, even if no specific
    #: permission is required — "you must be signed in" is a real gate.
    requires_auth: bool = False

    @property
    def is_public(self) -> bool:
        return not self.requires_auth and not self.permissions


def _permissions_of(dependant: Any, seen: set[int] | None = None) -> tuple[list[str], bool]:
    """Walk a route's dependency graph for permission names and any auth marker.

    `require_permission("user-view")` returns a closure over the string, so the
    name is recoverable from `__closure__` — the same trick a debugger uses, and
    the reason this needs no decorator or registry to be kept in step. A route
    that starts declaring a new permission appears here on the next request.

    Recursive and cycle-guarded: dependencies nest, and a shared one appears
    under several parents.
    """
    seen = seen if seen is not None else set()
    permissions: list[str] = []
    requires_auth = False

    for dependency in getattr(dependant, "dependencies", []) or []:
        if id(dependency) in seen:
            continue
        seen.add(id(dependency))

        call = getattr(dependency, "call", None)
        if call is not None:
            if getattr(call, "__name__", "") in AUTH_MARKERS:
                requires_auth = True
            for cell in getattr(call, "__closure__", None) or []:
                try:
                    value = cell.cell_contents
                except ValueError:  # pragma: no cover - empty cell
                    continue
                # A permission name, by shape: our convention is kebab-case with
                # a hyphen, which no other closed-over string in these factories
                # matches.
                if isinstance(value, str) and "-" in value and " " not in value:
                    permissions.append(value)
                elif isinstance(value, tuple | list):
                    permissions.extend(
                        v for v in value if isinstance(v, str) and "-" in v and " " not in v
                    )

        nested, nested_auth = _permissions_of(dependency, seen)
        permissions.extend(nested)
        requires_auth = requires_auth or nested_auth

    return permissions, requires_auth


def build_catalogue(app: FastAPI) -> list[Operation]:
    """Every route the application serves, with its gate."""
    operations: list[Operation] = []

    for route in app.routes:
        if not isinstance(route, APIRoute):
            continue

        permissions, requires_auth = _permissions_of(route.dependant)
        tags = route.tags or ["untagged"]

        for method in sorted(route.methods or set()):
            if method in ("HEAD", "OPTIONS"):
                continue
            operations.append(
                Operation(
                    method=method,
                    path=route.path,
                    name=route.name,
                    # The first line of the docstring, which is what FastAPI puts
                    # in the OpenAPI summary too — one source, so the page and
                    # the document cannot disagree.
                    summary=(route.summary or (route.description or "").split("\n")[0] or ""),
                    tag=str(tags[0]),
                    permissions=sorted(set(permissions)),
                    requires_auth=requires_auth,
                )
            )

    operations.sort(key=lambda op: (op.tag, op.path, op.method))
    return operations


def summarise(operations: list[Operation]) -> dict[str, Any]:
    """Counts for the top of the page.

    `public` is the number worth watching: it should be a handful of routes that
    are public on purpose, and any growth in it is a review item rather than a
    statistic.
    """
    unexpected_public = [op for op in operations if op.is_public and not is_expected_public(op.path)]
    return {
        "operations": len(operations),
        "paths": len({op.path for op in operations}),
        "tags": len({op.tag for op in operations}),
        "permission_gated": len([op for op in operations if op.permissions]),
        "auth_only": len([op for op in operations if op.requires_auth and not op.permissions]),
        "public": len([op for op in operations if op.is_public]),
        "unexpected_public": [f"{op.method} {op.path}" for op in unexpected_public],
    }


#: Permissions that are real and enforced, but **not at the route layer** — so
#: their absence from the route catalogue is a fact about where they are checked,
#: not evidence that they do nothing.
#:
#: The value is where to look. `permissions_enforced_elsewhere()` proves each
#: claim rather than trusting this table, because an excuse nobody verifies is
#: how a genuinely dead permission hides among three live ones.
ENFORCED_ELSEWHERE: dict[str, tuple[str, str]] = {
    # Gates *tools*, not routes: `registry.specs_for` decides which tools the
    # assistant is even told about, and a tool the user may not have is never
    # described to the model.
    "ai-assistant-query-database": ("app/ai/registry.py", "gate="),
    # Gates a nav entry. There is no `GET /dashboard` on the API — the dashboard
    # is a frontend page assembled from other endpoints.
    "dashboard-view": ("app/services/navigation_service.py", "DASHBOARD_VIEW"),
    # Deliberate, and documented in `permissions.py` itself: the branding write
    # routes are gated on `require_super_admin`, which is the actual control,
    # because ROLE_ADMIN is `"*"` and would otherwise inherit this. The
    # permission exists so the capability is visible in the catalogue and on the
    # role permissions page.
    "settings-manage": ("app/services/navigation_service.py", "SETTINGS_MANAGE"),
}


def permissions_enforced_elsewhere(root: str = "app") -> dict[str, bool]:
    """Check each `ENFORCED_ELSEWHERE` claim against the file it names.

    Returns permission → whether the marker was found. A False means the
    permission is now enforced nowhere at all: a checkbox on the Roles screen
    that grants nothing, which is the mirror image of an ungated route and just
    as invisible.
    """
    from pathlib import Path

    results: dict[str, bool] = {}
    for permission, (path, marker) in ENFORCED_ELSEWHERE.items():
        candidate = Path(root).parent / path if not Path(path).exists() else Path(path)
        try:
            source = candidate.read_text()
        except OSError:
            results[permission] = False
            continue
        results[permission] = marker in source
    return results


def permissions_in_use(operations: list[Operation]) -> dict[str, list[str]]:
    """Permission name → the routes that require it.

    The reverse index, and the one that answers the question an administrator
    actually asks: *what does granting this permission let someone do?* Reading
    it off the routes rather than off a description means the answer cannot drift
    from the code.
    """
    index: dict[str, list[str]] = {}
    for op in operations:
        for permission in op.permissions:
            index.setdefault(permission, []).append(f"{op.method} {op.path}")
    return dict(sorted(index.items()))
