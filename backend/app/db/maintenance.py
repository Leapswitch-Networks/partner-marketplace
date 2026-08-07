"""Periodic cleanup — the caller for two purge functions that had none.

CORE_HARDENING_PLAN PM-43. `session_service.purge_expired` and
`activity_service.purge_older_than` were both written, both careful, and both dead:
nothing invoked either, so `user_sessions` grew by one row per sign-in forever.

**A module, not a scheduler.** There is no scheduler in this project and adding one
to run two deletes would be infrastructure serving no other need. This is a command,
meant for a cron line or a platform's scheduled-task hook:

    # daily, 03:15
    15 3 * * *  docker compose run --rm backend python -m app.db.maintenance

    # sessions only, leaving the audit trail alone
    python -m app.db.maintenance --sessions-only

    # show what would be deleted, delete nothing
    python -m app.db.maintenance --dry-run

**Sessions and the audit trail are treated differently, deliberately.**

Expired sessions are *expired* — deleting them after a grace period is housekeeping,
not policy, so it runs by default at 30 days.

How long who-did-what is kept **is** policy — legal, contractual, or simply how far
back you want to be able to answer questions. `ACTIVITY_LOG_RETENTION_DAYS` (730) is a
default for whoever runs this, not a decision this file gets to make, so audit
trimming requires `--activity` to be passed explicitly. Deleting evidence should be an
instruction, never something a cron line does because a default said so.
"""

from __future__ import annotations

import argparse
import sys

from app.core.config import settings
from app.db.session import SessionLocal
from app.services import activity_service, session_service

#: Expired sessions kept this long before deletion. Not configurable, because it is
#: not a policy question: the session is already unusable and the only reason to keep
#: the row at all is so "when did that device last sign in" survives a few weeks.
SESSION_RETENTION_DAYS = 30


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="python -m app.db.maintenance",
        description="Delete expired sessions and, optionally, old audit-log rows.",
    )
    parser.add_argument(
        "--session-days",
        type=int,
        default=SESSION_RETENTION_DAYS,
        help=f"Delete sessions expired more than N days ago (default {SESSION_RETENTION_DAYS}).",
    )
    parser.add_argument(
        "--activity",
        action="store_true",
        help=(
            "Also trim the activity log. NOT the default: retention is a policy "
            "decision, and this deletes evidence."
        ),
    )
    parser.add_argument(
        "--activity-days",
        type=int,
        default=settings.ACTIVITY_LOG_RETENTION_DAYS,
        help=(
            "Keep audit rows newer than N days "
            f"(default {settings.ACTIVITY_LOG_RETENTION_DAYS}, from ACTIVITY_LOG_RETENTION_DAYS)."
        ),
    )
    parser.add_argument(
        "--sessions-only",
        action="store_true",
        help="Alias for omitting --activity. Accepted so a cron line can be explicit.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Report what would be deleted and delete nothing.",
    )
    return parser.parse_args(argv)


def run(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    trim_activity = args.activity and not args.sessions_only

    db = SessionLocal()
    try:
        if args.dry_run:
            # Counted rather than deleted. Worth having: the first run of a delete
            # against a production table should be something you can read first.
            sessions = session_service.count_purgeable(db, older_than_days=args.session_days)
            print(f"[maintenance] would delete {sessions} expired session(s)")
            if trim_activity:
                rows = activity_service.count_purgeable(db, days=args.activity_days)
                print(f"[maintenance] would delete {rows} audit row(s)")
            else:
                print("[maintenance] audit log untouched (pass --activity to trim it)")
            print("[maintenance] dry run — nothing deleted")
            return 0

        sessions = session_service.purge_expired(db, older_than_days=args.session_days)
        print(f"[maintenance] deleted {sessions} expired session(s)")

        if trim_activity:
            # `purge_older_than` refuses a non-positive value and records its own
            # purge in the trail it truncated, so the gap is explained rather than
            # looking like data loss.
            rows = activity_service.purge_older_than(db, days=args.activity_days)
            print(f"[maintenance] deleted {rows} audit row(s) older than {args.activity_days} days")
        else:
            print("[maintenance] audit log untouched (pass --activity to trim it)")

        print("[maintenance] done")
        return 0
    except ValueError as exc:
        # The guards inside the purge functions — a non-positive retention, most
        # likely from a mistyped cron line. A clear message beats a traceback.
        print(f"[maintenance] refused: {exc}", file=sys.stderr)
        return 2
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(run())
