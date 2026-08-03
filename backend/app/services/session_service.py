"""Session lifecycle: create, validate, touch, revoke.

Every rule about when a credential stops working lives here, so no router has to
remember to revoke anything. The guard calls `validate`; the auth endpoints call
`create` / `revoke` / `revoke_all_except`.

**Revocation reasons and who triggers them:**

| Reason              | Trigger                          | Scope                     |
|---------------------|----------------------------------|---------------------------|
| `logout`            | the user signs out               | that session only         |
| `password_change`   | the user changes their password  | every OTHER session       |
| `password_reset`    | a reset link is completed        | **every** session         |
| `revoked_by_admin`  | an admin suspends/deletes        | every session             |

`password_change` spares the current session and `password_reset` does not, and
the difference is deliberate. Someone changing their password in their own
account settings is already authenticated here and should not be thrown out of
the tab they are using; the point is to evict everyone *else*. Someone completing
a reset link is usually locked out or recovering from a compromise, and may not
be on a device they trust — so everything dies, including whatever the attacker
holds, and they sign in fresh.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.user import User
from app.models.user_session import UserSession

logger = logging.getLogger("app.session")

#: How stale `last_seen_at` may get before a request writes it. Without this the
#: guard would turn every authenticated read into a write.
SESSION_TOUCH_INTERVAL = timedelta(minutes=5)

#: A User-Agent is attacker-controlled text of unbounded length. Stored for
#: display only, and truncated so a multi-kilobyte header cannot bloat the row.
_MAX_USER_AGENT = 512


def create(db: Session, user: User, ip: str | None, user_agent: str | None) -> UserSession:
    """Open a session. Its id becomes the `sid` claim in both tokens."""
    now = datetime.now(timezone.utc)
    session = UserSession(
        user_id=user.id,
        ip_address=ip,
        user_agent=(user_agent or "")[:_MAX_USER_AGENT] or None,
        created_at=now,
        last_seen_at=now,
        # Matched to the refresh token, which is the longest-lived credential the
        # session backs. An access token outliving its session would be a hole.
        expires_at=now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def get_active(db: Session, session_id: str, user_id: str) -> UserSession | None:
    """Fetch a live session, or None.

    `user_id` is matched as well as `session_id` deliberately. Both come from the
    same signed token so they cannot be mixed by an attacker without the secret,
    but checking the pair means a token that somehow names another user's session
    is refused rather than honoured — the check costs nothing and removes a whole
    category of mistake from ever being exploitable.
    """
    session = db.get(UserSession, session_id)
    if session is None or session.user_id != user_id:
        return None
    if not session.is_active:
        return None
    return session


def touch(db: Session, session: UserSession) -> None:
    """Record activity, at most once per `SESSION_TOUCH_INTERVAL`."""
    now = datetime.now(timezone.utc)
    if now - session.last_seen_at < SESSION_TOUCH_INTERVAL:
        return
    session.last_seen_at = now
    db.commit()


def mark_password_confirmed(db: Session, session: UserSession) -> None:
    """Stamp this session as having re-proved the account password just now."""
    session.password_confirmed_at = datetime.now(timezone.utc)
    db.commit()


def revoke(db: Session, session: UserSession, reason: str) -> None:
    """End one session. Idempotent — re-revoking keeps the original reason."""
    if session.revoked_at is not None:
        return
    session.revoked_at = datetime.now(timezone.utc)
    session.revoked_reason = reason
    db.commit()
    logger.info(
        "session revoked",
        extra={"session_id": session.id, "user_id": session.user_id, "reason": reason},
    )


def revoke_all(db: Session, user_id: str, reason: str) -> int:
    """End every live session for a user. Returns how many were ended."""
    return _revoke_where(db, user_id, reason, keep_session_id=None)


def revoke_all_except(db: Session, user_id: str, keep_session_id: str, reason: str) -> int:
    """End every live session for a user except one. Returns how many were ended."""
    return _revoke_where(db, user_id, reason, keep_session_id=keep_session_id)


def _revoke_where(
    db: Session, user_id: str, reason: str, keep_session_id: str | None
) -> int:
    """Bulk revoke in one statement.

    Deliberately a single UPDATE rather than a loop over ORM objects: this runs on
    password change and on admin suspension, where a user could have many
    sessions, and the count is not worth N round trips.
    """
    now = datetime.now(timezone.utc)
    statement = (
        update(UserSession)
        .where(UserSession.user_id == user_id)
        .where(UserSession.revoked_at.is_(None))
        .where(UserSession.expires_at > now)
    )
    if keep_session_id is not None:
        statement = statement.where(UserSession.id != keep_session_id)

    result = db.execute(statement.values(revoked_at=now, revoked_reason=reason))
    db.commit()

    count = result.rowcount or 0
    if count:
        logger.info(
            "sessions revoked in bulk",
            extra={"user_id": user_id, "reason": reason, "count": count},
        )
    # Objects already loaded in this Session still hold the pre-UPDATE state, so
    # a caller that re-reads one would see it as active. Expire them so the next
    # access refetches.
    db.expire_all()
    return count


def list_active(db: Session, user_id: str) -> list[UserSession]:
    """Live sessions for a user, newest first. For an 'active sessions' screen."""
    now = datetime.now(timezone.utc)
    return list(
        db.scalars(
            select(UserSession)
            .where(UserSession.user_id == user_id)
            .where(UserSession.revoked_at.is_(None))
            .where(UserSession.expires_at > now)
            .order_by(UserSession.last_seen_at.desc())
        )
    )


def purge_expired(db: Session, older_than_days: int = 30) -> int:
    """Delete session rows long past use. Returns how many were removed.

    Not wired to a schedule — there is no scheduler. Exposed so it can be run by
    hand or from a cron later. Without it the table grows forever: one row per
    sign-in, kept indefinitely.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=older_than_days)
    result = db.execute(
        UserSession.__table__.delete().where(UserSession.expires_at < cutoff)
    )
    db.commit()
    return result.rowcount or 0
