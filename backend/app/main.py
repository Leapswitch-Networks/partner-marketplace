import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

# `settings` is aliased because `app.api.settings` (the router module) and
# `app.core.config.settings` (the config object) would otherwise collide here.
from app.api import (
    activity,
    api_credentials,
    auth,
    configuration,
    data_access,
    google,
    invitations,
    navigation,
    partners,
    permissions,
    errors,
    recycle_bin,
    feature_flags,
    health_status,
    roles,
    search,
    security_settings,
    settings as settings_api,
    users,
)
from app.core.config import settings
from app.core.dependencies import get_client_ip
from app.core.headers import SecurityHeadersMiddleware
from app.core.logging import RequestContextMiddleware, configure_logging, request_id_ctx
from app.core.rate_limit import RateLimitMiddleware
from app.db.session import engine

# Before anything else, so import-time warnings land in the configured format.
configure_logging()

logger = logging.getLogger("app")

# Title comes from configuration so a project built on this core renames its own
# API docs by setting APP_NAME, rather than editing this line. Not read from the
# database: the app object is built at import time, before a session exists.
app = FastAPI(title=f"{settings.APP_NAME} API", version="1.0.0")

app.add_middleware(GZipMiddleware, minimum_size=1000)

# Per-IP rate limiting (TECH_DEBT PM-26).
#
# ORDER MATTERS. Starlette runs the most recently added middleware outermost, so
# this must be registered BEFORE CORSMiddleware to end up inside it. A 429 that
# escapes without Access-Control-Allow-Origin is unreadable to the browser, and
# the user sees an opaque network error rather than "too many attempts".
app.add_middleware(RateLimitMiddleware)

# Origins come from config so deploying never needs a code edit (TECH_DEBT PM-9).
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security response headers (TECH_DEBT PM-33). Added after CORS so it sits
# outside it, which means the headers land on CORS's own preflight replies as well
# as on ordinary responses.
app.add_middleware(SecurityHeadersMiddleware)

# Outermost, so its timing covers gzip and rate limiting too and every log line
# from any handler carries a request id (TECH_DEBT PM-10).
app.add_middleware(RequestContextMiddleware)


# --- Exception handling (TECH_DEBT PM-10) ------------------------------------
#
# The contract for every handler below: log everything the server needs, return
# only what the client needs. A traceback or a database error string in a
# response body tells an attacker about table names, driver versions and file
# paths, so responses carry a correlation id and nothing else. The id is what
# ties a user's "it broke" to the traceback in the logs.


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """A 422 is the caller's mistake, so it is logged at INFO, not ERROR.

    `exc.errors()` can echo submitted values, which on `/api/auth/login` means
    the password. Only the field locations and messages are logged, and only those
    are returned; the input is dropped from both.

    ⚠️ **`exc.errors()` must not be handed to `JSONResponse` directly.** When a
    custom `field_validator` raises `ValueError`, Pydantic v2 puts the exception
    *object* in the entry's `ctx`, and `json.dumps` cannot serialise it:

        TypeError: Object of type ValueError is not JSON serializable

    The handler then blows up inside the error path, so the caller gets a **500
    with a generic message instead of the 422 explaining what they got wrong** —
    and the actual validation message never reaches them. Every schema with a
    custom validator was affected, which is most of them; it surfaced on
    `PUT /api/settings/branding`, whose `theme_preset` validator rejects unknown
    presets by design. Rebuilding each entry from the three primitive fields keeps
    the response serialisable whatever a validator raises.
    """
    fields = [
        {
            "loc": list(err.get("loc", ())),
            "msg": str(err.get("msg", "")),
            "type": str(err.get("type", "")),
        }
        for err in exc.errors()
    ]
    logger.info(
        "request validation failed",
        extra={
            "path": request.url.path,
            "fields": [
                {"loc": ".".join(str(part) for part in f["loc"]), "msg": f["msg"]} for f in fields
            ],
        },
    )
    return JSONResponse(status_code=422, content={"detail": fields})


@app.exception_handler(SQLAlchemyError)
async def database_exception_handler(request: Request, exc: SQLAlchemyError) -> JSONResponse:
    """Database failures get their own handler so they are identifiable in logs.

    Deliberately ahead of the catch-all: "the database refused this" and "the
    code has a bug" need different responses from whoever is on call, and a
    generic 500 makes them indistinguishable.
    """
    logger.exception(
        "database error", extra={"path": request.url.path, "method": request.method}
    )
    return JSONResponse(
        status_code=500,
        content={
            "detail": "A database error occurred. Please try again.",
            "request_id": request_id_ctx.get(),
        },
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Last resort. Logs the traceback, records it, returns a correlation id.

    Without this, FastAPI returns a bare 500 and the traceback goes to stdout
    unattributed — the state PM-10 described.
    """
    logger.exception(
        "unhandled exception", extra={"path": request.url.path, "method": request.method}
    )
    _record_error(request, exc)
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error.",
            "request_id": request_id_ctx.get(),
        },
    )


def _record_error(request: Request, exc: BaseException) -> None:
    """Persist an unhandled exception to the error tracker (Module 17).

    **Its own session, not the request's.** The request's session is in an
    unknown state — that is often *why* we are here — and reusing it would mean
    the recording fails for the same reason the request did. This one is opened,
    used and closed inside the handler.

    **Never raises.** `error_service.record` catches everything internally, and
    this wrapper catches whatever is left, because a failure here would turn a 500
    into a crash inside the handler that exists to prevent crashes. It is the one
    place in the application where a second failure has nowhere to go.

    Gated on `operations.errors.record_outside_production`, which is a real row in
    the Module 11 registry — the first consumer of a setting that replaces a
    constant, and the proof the registry does what it was built for.
    """
    try:
        from app.core.config import settings as app_settings
        from app.db.session import SessionLocal
        from app.services import error_service, setting_service

        with SessionLocal() as db:
            # `is_production` is a real property on the config object; do not
            # re-derive it from APP_ENV here, or the two spellings drift.
            if not app_settings.is_production and not setting_service.get(
                db, "operations.errors.record_outside_production", True
            ):
                return

            user = getattr(request.state, "user", None)
            error_service.record(
                db,
                exc,
                request=request,
                user_id=getattr(user, "id", None),
                # `get_client_ip` and not `request.client.host` directly: it is
                # the one function that knows whether X-Forwarded-For may be
                # trusted, and reading the header here would reintroduce the
                # spoofing hole PM-26 closed.
                ip=get_client_ip(request),
            )
    except Exception:  # noqa: BLE001 - see the docstring
        logger.warning("could not record error to the tracker", exc_info=True)


# All routers mount under settings.API_PREFIX — `/api/v1` (PM-40). The health
# endpoints below deliberately do NOT: an orchestrator's liveness probe should not
# have to know the API's contract version, and /health is not part of that contract.
app.include_router(auth.router, prefix=settings.API_PREFIX)
app.include_router(google.router, prefix=settings.API_PREFIX)
app.include_router(users.router, prefix=settings.API_PREFIX)
app.include_router(roles.router, prefix=settings.API_PREFIX)
app.include_router(navigation.router, prefix=settings.API_PREFIX)
app.include_router(permissions.router, prefix=settings.API_PREFIX)
app.include_router(invitations.router, prefix=settings.API_PREFIX)
app.include_router(activity.router, prefix=settings.API_PREFIX)
app.include_router(settings_api.router, prefix=settings.API_PREFIX)
# After `settings_api`, and it matters: that router owns `/settings/branding/*`
# while this one owns `/settings/configuration`. Neither declares a wildcard
# segment today, so the order is not load-bearing yet — but a future
# `/settings/{key}` on either would swallow the other, and first-match-wins means
# whichever is registered first would win silently.
app.include_router(configuration.router, prefix=settings.API_PREFIX)
# Same `/settings/*` namespace, its own sub-path. Reads the same table as
# `configuration` but only the `security.` namespace of it — see its docstring.
app.include_router(security_settings.router, prefix=settings.API_PREFIX)
app.include_router(errors.router, prefix=settings.API_PREFIX)
app.include_router(health_status.router, prefix=settings.API_PREFIX)

# Merged from four parallel agents, 2026-08-11. Each was reviewed before
# mounting rather than on trust — the two with security-critical contracts
# (search's model allowlist, credentials' encryption at rest) were probed,
# not just read. See DAILY_CHANGES.
app.include_router(data_access.router, prefix=settings.API_PREFIX)
app.include_router(feature_flags.router, prefix=settings.API_PREFIX)
app.include_router(search.router, prefix=settings.API_PREFIX)
app.include_router(api_credentials.router, prefix=settings.API_PREFIX)
app.include_router(recycle_bin.router, prefix=settings.API_PREFIX)
app.include_router(partners.router, prefix=settings.API_PREFIX)


@app.get("/health", tags=["health"])
def health() -> dict:
    """Shallow liveness check — does NOT touch the database.

    Kept shallow deliberately so it stays cheap; use /health/ready for a probe
    that fails when the database is unreachable (TECH_DEBT PM-18).
    """
    return {"status": "ok"}


@app.get("/health/ready", tags=["health"])
def readiness() -> dict:
    """Deep check: verifies the database actually answers."""
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception as exc:  # noqa: BLE001 - report any failure as not-ready
        return {"status": "unavailable", "database": "unreachable", "detail": str(exc)}
    return {"status": "ok", "database": "reachable"}
