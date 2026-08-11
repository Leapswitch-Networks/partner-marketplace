"""add deleted_at to the recoverable core tables

Revision ID: b6d41e807f92
Revises: a2f80c3d5e19
Create Date: 2026-08-11

LeapDesk parity — the Recycle Bin. Its own docblock states what this fixes:
*"Before this existed every delete in the core was permanent."* That is true of
us today.

**Four tables, not every table.** A table gets `deleted_at` when losing a row is
recoverable-worthy, not by default. LeapDesk soft-deletes five —
`users`, `user_invitations`, `api_consumers`, `searchable_entities`,
`data_access_grants` — and we have four of them; `api_consumers` arrives with
Module 10.

Deliberately **excluded**, and each for a reason:

* `roles`, `permissions` — deletion is already blocked while anything holds them,
  which is a better protection than undo.
* `activity_log`, `error_occurrences` — append-only evidence. Nothing deletes a
  row, so there is nothing to recover.
* `settings`, `feature_flags` — declared in code and reconciled by a seeder; a
  deleted row comes back on the next deploy.
* `partners` — has its own lifecycle (`PENDING`/`ACTIVE`/`SUSPENDED`) and
  suspension is the reversible operation. Adding a second reversible-delete
  concept alongside it would give two ways to make a partner disappear.

**Indexed, and that matters.** Every listing query gains
`WHERE deleted_at IS NULL`, so an unindexed column would turn each one into a
sequential scan as the table grows. Partial indexes would be tighter still; a
plain one is used because the recycle bin queries the *complement*
(`IS NOT NULL`) and would not be served by a `WHERE deleted_at IS NULL` partial.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "b6d41e807f92"
down_revision: str | None = "a2f80c3d5e19"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLES = ("users", "user_invitations", "data_access_grants", "searchable_entities")


def upgrade() -> None:
    for table in TABLES:
        op.add_column(
            table,
            sa.Column(
                "deleted_at", sa.DateTime(timezone=True), nullable=True,
                comment="Soft delete. NULL means live; set means in the recycle bin",
            ),
        )
        op.create_index(f"ix_{table}_deleted_at", table, ["deleted_at"])


def downgrade() -> None:
    # Rows soft-deleted while this was applied become live again on downgrade,
    # because the only thing marking them deleted is the column being dropped.
    # Stated rather than silently true: a downgrade is a data change here, not
    # just a schema one.
    for table in TABLES:
        op.drop_index(f"ix_{table}_deleted_at", table_name=table)
        op.drop_column(table, "deleted_at")
