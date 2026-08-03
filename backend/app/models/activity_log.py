"""Audit trail (TECH_DEBT PM-32).

Column names are taken verbatim from LeapDesk's `activity_log`, which is
`spatie/laravel-activitylog`'s table: `log_name`, `description`, `subject_type`,
`subject_id`, `event`, `causer_type`, `causer_id`, `properties`, `batch_uuid`,
plus timestamps. A developer who knows one schema can read the other.

**Why `created_by` / `updated_by` were not enough.** Those columns say who last
touched a row, and overwrite themselves. They cannot answer any of the questions
an audit trail exists for: who granted this user the Admin role, and when? Who
deactivated this account? What did the permission set look like before? Who
deleted the role that is no longer here? Structured logging (PM-10) is not a
substitute either — those lines go to stdout, are not queryable, and disappear
with the container.

Two values diverge from LeapDesk on purpose, while the column names do not:

1. **`subject_id` and `causer_id` are strings, not big integers.** LeapDesk's
   `users.id` is a bigint; ours is a UUID. A single `subject_id` also has to hold
   both a user's UUID and a role's integer id, so `String(36)` covers both and an
   integer id is stored as its decimal string.
2. **`*_type` holds a plain model name — `User`, `Role` — not `App\\Models\\User`.**
   Storing a PHP namespace in a Python codebase would be a lie that someone would
   eventually try to resolve.

`properties` follows Spatie's shape so the *data* is as familiar as the columns:
`{"attributes": {...new values...}, "old": {...previous values...}}` for a change,
plus context keys like `ip` and `user_agent` for auth events.
"""

from datetime import datetime, timezone

from sqlalchemy import DateTime, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

# --- log_name buckets -------------------------------------------------------
#: Auth events: login, logout, failed_login. Matches LeapDesk's 'auth' bucket.
LOG_AUTH = "auth"
#: Everything else — model changes.
LOG_DEFAULT = "default"

# --- event names ------------------------------------------------------------
EVENT_CREATED = "created"
EVENT_UPDATED = "updated"
EVENT_DELETED = "deleted"
#: LeapDesk rewrites `updated` to this when the only change is a status flip,
#: because toggling Active/Inactive is a different intent from editing fields.
EVENT_STATUS_CHANGED = "status_changed"
EVENT_LOGIN = "login"
EVENT_LOGOUT = "logout"
EVENT_FAILED_LOGIN = "failed_login"
#: Not in LeapDesk's set. Role grants are the single most security-relevant
#: change in an RBAC system and deserve their own event rather than hiding inside
#: a generic `updated` diff.
EVENT_ROLES_CHANGED = "roles_changed"


class ActivityLog(Base):
    """One recorded action. Append-only — nothing updates or deletes these rows."""

    __tablename__ = "activity_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    log_name: Mapped[str | None] = mapped_column(
        String(255), nullable=True, comment="Bucket: 'auth' | 'default'"
    )
    description: Mapped[str] = mapped_column(
        Text, nullable=False, comment="Human-readable summary, e.g. 'Ayush Mishra logged in'"
    )

    # --- What was acted on --------------------------------------------------
    subject_type: Mapped[str | None] = mapped_column(
        String(100), nullable=True, comment="Model name: 'User' | 'Role' — not a namespace"
    )
    subject_id: Mapped[str | None] = mapped_column(
        String(36), nullable=True,
        comment="String because ours are UUIDs and role ids are ints; both fit",
    )
    event: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # --- Who did it ---------------------------------------------------------
    causer_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    causer_id: Mapped[str | None] = mapped_column(
        String(36), nullable=True,
        comment="NULL for an unauthenticated actor — a failed login has no causer",
    )

    # --- Detail -------------------------------------------------------------
    # JSONB rather than JSON: it can be indexed and queried, which is the whole
    # point of storing an audit trail in a database instead of a log file.
    properties: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    batch_uuid: Mapped[str | None] = mapped_column(
        String(36), nullable=True,
        comment="Groups rows written by one logical operation, e.g. a bulk update",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    __table_args__ = (
        # Mirrors LeapDesk's indexes: log_name, plus the two morph pairs.
        Index("activity_log_log_name_index", "log_name"),
        Index("subject", "subject_type", "subject_id"),
        Index("causer", "causer_type", "causer_id"),
        # Ours, not LeapDesk's: every read of this table is "most recent first",
        # so an unindexed sort would scan the whole thing as it grows.
        Index("activity_log_created_at_index", "created_at"),
    )

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<ActivityLog {self.event} {self.subject_type}#{self.subject_id}>"
