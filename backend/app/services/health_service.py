"""System Health — what the running system can say about itself (Module 18).

Port of `SystemHealthService` + `SystemHealthController`. Its own docblock states
the discipline, and it is the one worth keeping:

    Deliberately small: queue and error detail live in their own modules, and
    this page links across rather than restating them.

So this returns **summaries and a link**, never a second copy of another module's
screen. The moment this file starts listing individual errors, it has become a
worse Error Tracking.

## Three panels differ from the reference, and none of them is a shortcut

**Storage is the database, not a disk.** LeapDesk measures a filesystem because
Laravel writes uploads to `storage/app`. We have no upload directory: branding
assets are `LargeBinary` columns on `app_settings`. Reporting free disk space
would measure the container's ephemeral layer, which tells nobody anything about
whether *our* data is growing. Database size is the equivalent measurement.

**There is no log file to size.** Logging goes to stdout
(`logging.StreamHandler(sys.stdout)`) and is the container runtime's to rotate.
The seeded `operations.health.log_warn_mb` therefore has **nothing to read it**,
which makes it the one setting in the registry that is currently decorative —
recorded here rather than quietly ignored, because the seeder's own rule is that
a setting nothing reads is worse than no setting.

**Provider reachability is pending Module 7.** `api_service_providers` exists (the
tables are migrated) but the service that resolves a credential and calls out does
not, so there is nothing to probe *with*. The panel reports the provider count and
says so, rather than showing a green tick nobody checked.
"""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.models.api_credential import ApiServiceProvider
from app.models.error_group import ErrorGroup
from app.services import error_service

logger = logging.getLogger("app")

#: Tables worth reporting sizes for. An allowlist rather than "every table",
#: because the interesting question is "is our data growing where we expect", and
#: a list of forty rows including every association table answers it worse.
WATCHED_TABLES = (
    "users",
    "activity_log",
    "error_occurrences",
    "error_groups",
    "search_logs",
    "settings",
    "user_sessions",
)


def database(db: Session) -> dict[str, Any]:
    """Connectivity, size, and the tables most likely to grow without bound.

    Every value is fetched inside one try/except: this is a **health** endpoint,
    and one that returns a 500 when the thing it monitors is unwell is useless
    exactly when it is needed. A failure is reported as a degraded panel.
    """
    try:
        size = db.execute(
            text("SELECT pg_size_pretty(pg_database_size(current_database()))")
        ).scalar()
        version = db.execute(text("SHOW server_version")).scalar()

        rows = db.execute(
            text(
                """
                -- Every column qualified. `relname` exists on BOTH `pg_class`
                -- and `pg_stat_user_tables`, so the unqualified form is an
                -- AmbiguousColumn error rather than a silent wrong answer.
                SELECT c.relname AS table_name,
                       pg_size_pretty(pg_total_relation_size(c.oid)) AS size,
                       s.n_live_tup AS row_estimate
                FROM pg_class c
                JOIN pg_stat_user_tables s ON s.relid = c.oid
                WHERE c.relname = ANY(:names)
                ORDER BY pg_total_relation_size(c.oid) DESC
                """
            ),
            {"names": list(WATCHED_TABLES)},
        ).all()

        return {
            "reachable": True,
            "version": version,
            "size": size,
            "tables": [
                {"name": r.table_name, "size": r.size, "rows": r.row_estimate} for r in rows
            ],
        }
    except Exception as exc:  # noqa: BLE001 - see the docstring
        logger.warning("health: database probe failed", exc_info=True)
        return {"reachable": False, "error": str(exc), "tables": []}


def storage(db: Session) -> dict[str, Any]:
    """What our binary data costs — which for us lives in the database.

    See the module docstring for why this is not a disk measurement.
    """
    try:
        row = db.execute(
            text(
                """
                SELECT
                    COALESCE(octet_length(logo_bytes), 0)    AS logo,
                    COALESCE(octet_length(favicon_bytes), 0) AS favicon
                FROM app_settings LIMIT 1
                """
            )
        ).first()
        logo = row.logo if row else 0
        favicon = row.favicon if row else 0
        return {
            "kind": "database",
            "assets_bytes": logo + favicon,
            "detail": [
                {"name": "Logo", "bytes": logo},
                {"name": "Favicon", "bytes": favicon},
            ],
        }
    except Exception:  # noqa: BLE001
        logger.warning("health: storage probe failed", exc_info=True)
        return {"kind": "database", "assets_bytes": 0, "detail": []}


def errors(db: Session) -> dict[str, Any]:
    """A summary and a pointer — never the errors themselves.

    `open` is called out separately because it is the number that means "act now";
    the rest are states someone has already decided about.
    """
    try:
        counts = error_service.status_counts(db)
        latest = db.scalar(
            select(ErrorGroup)
            .where(ErrorGroup.status == "open")
            .order_by(ErrorGroup.last_seen_at.desc())
        )
        return {
            "available": True,
            "counts": counts,
            "open": counts.get("open", 0),
            "latest": (
                {
                    "id": latest.id,
                    "exception_class": latest.exception_class,
                    "last_seen_at": latest.last_seen_at.isoformat() if latest.last_seen_at else None,
                }
                if latest
                else None
            ),
        }
    except Exception:  # noqa: BLE001
        logger.warning("health: error summary failed", exc_info=True)
        return {"available": False, "counts": {}, "open": 0, "latest": None}


def queue(db: Session) -> dict[str, Any]:
    """There is no queue, and this says so rather than reporting zero.

    A "0 pending / 0 failed" panel is indistinguishable from a healthy queue and
    would be read as one. **We run no worker** — no Celery, no RQ, nothing — and
    every write is synchronous inside the request. Module 16 (Queue Monitor) is
    blocked on that, not merely unstarted.

    Returned as a panel rather than omitted because "we do not do background work"
    is itself a fact an operator should be able to read off this page.
    """
    return {
        "configured": False,
        "reason": (
            "No queue or worker is configured — every write runs synchronously "
            "inside the request. Queue Monitor (Module 16) is blocked on this."
        ),
    }


def providers(db: Session) -> dict[str, Any]:
    """Provider count, and an honest note that nothing has been probed.

    Reachability needs the credential resolution chain from Module 7, which does
    not exist yet. Reporting an unchecked green tick would be worse than
    reporting nothing.
    """
    try:
        total = db.scalar(select(func.count(ApiServiceProvider.id))) or 0
        active = (
            db.scalar(
                select(func.count(ApiServiceProvider.id)).where(
                    ApiServiceProvider.is_active.is_(True)
                )
            )
            or 0
        )
        return {
            "probing_available": False,
            "reason": "Reachability probing arrives with API Credentials (Module 7).",
            "total": total,
            "active": active,
        }
    except Exception:  # noqa: BLE001
        logger.warning("health: provider count failed", exc_info=True)
        return {"probing_available": False, "reason": "Unavailable.", "total": 0, "active": 0}


def overview(db: Session) -> dict[str, Any]:
    """Every panel, in one request.

    One call rather than five: the page is a dashboard, and five requests would
    let it render four healthy panels while the fifth — the one that is unwell —
    is still in flight.
    """
    return {
        "database": database(db),
        "storage": storage(db),
        "errors": errors(db),
        "queue": queue(db),
        "providers": providers(db),
    }


__all__ = ["database", "errors", "overview", "providers", "queue", "storage"]
