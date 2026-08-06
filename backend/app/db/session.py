from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    pool_timeout=30,
    pool_recycle=1800,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@contextmanager
def unit_of_work(db: Session) -> Iterator[Session]:
    """One commit for one unit of work: commit on success, roll back on anything.

    For a flow that writes more than one table. Without it, a route calling two
    services gets two commits, and a failure between them leaves the first one
    durable — a user row with no roles, an invitation accepted but the account not
    activated. `Session.close()` does discard an uncommitted transaction, so this
    is not about corruption; it is about a request being able to change nothing
    when it fails, which is a property that has to be declared to exist.

        with unit_of_work(db):
            user = user_service.create_user(db, data, actor)   # no commit inside
            rbac_service.assign_roles(db, user, data.role_ids) # no commit inside
        # one commit here, or nothing at all

    **Two rules for anything called inside this block.**

    1. **It must not commit.** A nested commit ends the outer transaction early
       and this becomes decoration. The 49 existing `db.commit()` calls across
       `app/services/` are single-write and correct as they are — they are not
       being rewritten (see PM-38). Do not wrap a call to one of them in this and
       assume it became atomic; move the commit out first.
    2. **Audit writes stay outside.** `activity_service` swallows its own
       exceptions on purpose, because failing a login because an audit write
       failed turns observability into an outage. Rolling one back with the
       operation it records would be the same mistake in the other direction:
       the trail would lose exactly the failed operations worth investigating.

    Nesting is not supported and is not needed — one boundary per request. Two
    nested blocks would give the inner one's commit the outer one's scope.
    """
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
