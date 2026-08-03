from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from sqlalchemy import text

from app.api import auth, candidate, category, google, invitations, permissions, roles, users
from app.core.config import settings
from app.core.rate_limit import RateLimitMiddleware
from app.db.session import engine

app = FastAPI(title="Partner Marketplace API", version="1.0.0")

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

app.include_router(auth.router, prefix="/api")
app.include_router(google.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(roles.router, prefix="/api")
app.include_router(permissions.router, prefix="/api")
app.include_router(invitations.router, prefix="/api")
# Inherited test-platform domain — gated but scheduled for removal.
app.include_router(candidate.router, prefix="/api")
app.include_router(category.router, prefix="/api")


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
