"""A connection the AI assistant physically cannot write through.

The reference gives `DatabaseQuery` a dedicated `mysql_readonly` connection — a
SELECT-only database user — and calls it *"the only control that holds if the
query builder is ever wrong"*. It is right, and it is the reason this module
exists rather than the tool simply reusing `SessionLocal`.

**What this actually gives you, stated precisely so nobody assumes more.**

Every connection opened here sets `default_transaction_read_only = on` for the
session. That is enforced by **Postgres**, not by our code: an `INSERT`, `UPDATE`,
`DELETE`, `CREATE` or `DROP` on this connection fails with
`ERROR: cannot execute ... in a read-only transaction`, whatever SQL reaches it
and however it got built. A bug in the query builder, a filter value that turns
out to be SQL, a future tool that forgets its own checks — all of them hit this.

**What it does not give you:** it is the *same database role* as the application,
so it has the same `SELECT` reach, and a session could in principle turn it off
by issuing `SET default_transaction_read_only = off`. Nothing does — the tool
sends no `SET` and no raw SQL — but that is a property of our code rather than of
the grant, and the difference matters.

**The stronger control, and why it is not here.** A dedicated Postgres role with
`SELECT`-only grants cannot be talked out of being read-only by any statement at
all. It needs a second `DATABASE_URL`-shaped secret, which means a new
environment variable in `docker-compose.yml` and `.env` — both **protected files**
that require the owner's sign-off (root `AGENTS.md` § 1). So this module is
written to make that a one-line change when they say yes: set
`AI_READONLY_DATABASE_URL` and it is used instead, with the read-only session
guard still applied on top. Until then the guard is the control, and it is a real
one.
"""

from __future__ import annotations

import logging
from collections.abc import Iterator
from contextlib import contextmanager
from functools import lru_cache

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings

logger = logging.getLogger("app.ai.readonly")

#: Optional. A DSN for a `SELECT`-only Postgres role; falls back to the
#: application's own when unset. Read with `getattr` because it is not a field on
#: `Settings` — adding one would be an edit to the config surface for a value
#: that does not exist in any environment yet.
READONLY_URL_SETTING = "AI_READONLY_DATABASE_URL"


def _url() -> str:
    return getattr(settings, READONLY_URL_SETTING, None) or settings.DATABASE_URL


def using_dedicated_role() -> bool:
    """True when a separate SELECT-only DSN is configured.

    Surfaced so the settings screen can say which control is in force rather than
    implying the stronger one.
    """
    return bool(getattr(settings, READONLY_URL_SETTING, None))


@lru_cache(maxsize=1)
def get_engine() -> Engine:
    """The read-only engine. Built once, on first use.

    Lazy rather than at import: the assistant is off by default, and an install
    that never enables it should not hold a second connection pool open for it.
    A small pool for the same reason — this serves one tool, not the app.
    """
    engine = create_engine(
        _url(),
        pool_pre_ping=True,
        pool_size=2,
        max_overflow=3,
        pool_timeout=10,
        pool_recycle=1800,
        # ⚠️ A **startup parameter**, not a `SET` statement, and the difference is
        # the whole control. The first version of this issued
        # `SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY` from a `connect`
        # event — and it did nothing, because `SET` is transactional in Postgres
        # and the rollback that follows connection setup discarded it. The probe
        # below is what caught that; `show default_transaction_read_only`
        # returned `off` on a connection this module claimed was read-only.
        #
        # Passed via libpq's `options`, the setting is applied by the server as
        # the session starts, outside any transaction, and nothing can roll it
        # back.
        connect_args={"options": "-c default_transaction_read_only=on"},
    )

    logger.info(
        "ai read-only engine created (dedicated role: %s)", using_dedicated_role()
    )
    return engine


@contextmanager
def readonly_session() -> Iterator[Session]:
    """A session that cannot write. Always rolls back.

    `rollback()` rather than `commit()` at the end, and not as a formality: there
    is nothing to commit, and calling `commit` would be the one line a later edit
    could build on.
    """
    factory = sessionmaker(autocommit=False, autoflush=False, bind=get_engine())
    session = factory()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


def assert_read_only() -> bool:
    """Prove the guard is live by trying to write through it.

    Called by the settings endpoint so an administrator can see the control
    holding rather than take this docstring's word for it. Returns True when the
    write was refused — which is the passing case.
    """
    try:
        with readonly_session() as session:
            session.execute(text("CREATE TEMP TABLE ai_readonly_probe (x int)"))
    except Exception:  # noqa: BLE001 - the refusal is the result we want
        return True
    logger.error("ai read-only guard did NOT refuse a write — the connection is writable")
    return False
