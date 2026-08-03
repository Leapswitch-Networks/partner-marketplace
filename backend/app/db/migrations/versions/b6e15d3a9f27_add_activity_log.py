"""add activity_log for the audit trail

Column names are LeapDesk's `activity_log` verbatim — it is
`spatie/laravel-activitylog`'s table, and matching it means a developer who knows
one schema can read the other.

`created_by` / `updated_by` were not an audit trail: they record who last touched
a row and overwrite themselves, so nothing can answer "who granted this Admin
role", "who deactivated this account", or "what did this role's permissions look
like before". Structured logging (PM-10) is not a substitute — stdout is not
queryable and does not survive `docker compose down`.

Two column TYPES differ from LeapDesk while the names do not, and the reasons are
worth recording:

  * ``subject_id`` / ``causer_id`` are ``String(36)``, not ``bigint``. LeapDesk's
    ``users.id`` is a bigint; ours is a UUID. One ``subject_id`` also has to hold
    both a user's UUID and a role's integer id.
  * ``properties`` is ``JSONB`` rather than ``json``, so it can be indexed and
    queried. Storing an audit trail in a database rather than a log file is
    pointless if it cannot be searched.

Indexes mirror LeapDesk's (``log_name`` and the two morph pairs, using its index
names ``subject`` and ``causer``) plus one of our own on ``created_at``, because
every read of this table is newest-first and an unindexed sort would scan it all.

Revision ID: b6e15d3a9f27
Revises: a7d92c4f1b83
Create Date: 2026-08-03
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "b6e15d3a9f27"
down_revision: Union[str, None] = "a7d92c4f1b83"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "activity_log",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "log_name",
            sa.String(length=255),
            nullable=True,
            comment="Bucket: 'auth' | 'default'",
        ),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column(
            "subject_type",
            sa.String(length=100),
            nullable=True,
            comment="Model name: 'User' | 'Role'. Not a PHP namespace",
        ),
        sa.Column(
            "subject_id",
            sa.String(length=36),
            nullable=True,
            comment="String: ours are UUIDs, and role ids are integers",
        ),
        sa.Column("event", sa.String(length=50), nullable=True),
        sa.Column("causer_type", sa.String(length=100), nullable=True),
        sa.Column(
            "causer_id",
            sa.String(length=36),
            nullable=True,
            comment="NULL when unauthenticated — a failed login has no causer",
        ),
        sa.Column("properties", postgresql.JSONB(), nullable=True),
        sa.Column(
            "batch_uuid",
            sa.String(length=36),
            nullable=True,
            comment="Groups the rows written by one bulk operation",
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_index("activity_log_log_name_index", "activity_log", ["log_name"])
    # LeapDesk's nullableMorphs('subject', 'subject') produces an index named
    # exactly 'subject'; same for 'causer'. Kept, so the names match too.
    op.create_index("subject", "activity_log", ["subject_type", "subject_id"])
    op.create_index("causer", "activity_log", ["causer_type", "causer_id"])
    op.create_index("activity_log_created_at_index", "activity_log", ["created_at"])


def downgrade() -> None:
    # Dropping this destroys the audit trail permanently — it is append-only and
    # nothing else holds the history. Reversible in schema, not in content.
    op.drop_index("activity_log_created_at_index", table_name="activity_log")
    op.drop_index("causer", table_name="activity_log")
    op.drop_index("subject", table_name="activity_log")
    op.drop_index("activity_log_log_name_index", table_name="activity_log")
    op.drop_table("activity_log")
