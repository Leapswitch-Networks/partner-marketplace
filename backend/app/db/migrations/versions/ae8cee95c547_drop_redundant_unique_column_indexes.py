"""drop four redundant indexes on already-unique columns

Closes the dangerous half of the autogenerate drift that
`5098784d1c1c`'s docstring recorded and deliberately excluded.

## What was wrong, and what was not

Four columns are declared `unique=True, index=True` in their models:
`permissions.name`, `roles.name`, `permission_groups.name` and
`user_invitations.token`. In the database each ended up with **both** a unique
constraint (`<table>_<col>_key`, which Postgres backs with a unique index) **and
a separate plain index** (`ix_<table>_<col>`) on the same column.

**Uniqueness was never at risk.** `pg_constraint` shows the UNIQUE constraint
present on all four throughout, so this was redundancy rather than a hole — the
plain index served no query the constraint's own index does not, while costing a
write on every insert and update.

It was also the reason `--autogenerate` proposed **dropping those four unique
constraints** to recreate them as unique indexes: SQLAlchemy renders
`unique=True, index=True` as a single unique index, so the model and the database
disagreed about the shape while agreeing about the rule. A migration that swept
that in would have dropped and recreated the constraints protecting the RBAC
tables as a side effect of an unrelated change.

## The fix, in two halves

`index=True` was removed from those four model columns — `unique=True` already
provides an index, so it was redundant in the model too. That alone took the
drift from 80 items to 75 and the constraint operations from four to **zero**.

This migration drops the four now-orphaned indexes. It has to be explicit:
once the models no longer declare them, autogenerate cannot see them to propose
it.

## What is deliberately still outstanding

The remaining ~124 drift items are **comment-only `alter_column`s** (model
docstrings never applied to the database) plus eight index *renames* on
`user_sessions` and `webhook_deliveries`. Neither is a correctness risk and
neither is touched here — applying 116 comment changes in a migration named after
an index cleanup would repeat the mistake this file exists to correct.

Revision ID: ae8cee95c547
Revises: e9633cd23b54
Create Date: 2026-08-18

"""
from typing import Sequence, Union

from alembic import op

revision: str = "ae8cee95c547"
down_revision: Union[str, None] = "e9633cd23b54"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

#: (index, table). Each column keeps its uniqueness from `<table>_<col>_key`,
#: verified against `pg_indexes` before this was written.
_REDUNDANT = (
    ("ix_permissions_name", "permissions"),
    ("ix_roles_name", "roles"),
    ("ix_permission_groups_name", "permission_groups"),
    ("ix_user_invitations_token", "user_invitations"),
)


def upgrade() -> None:
    for index, table in _REDUNDANT:
        op.drop_index(index, table_name=table)


def downgrade() -> None:
    """Recreates them as plain indexes, which is what was there before.

    Non-unique on purpose: recreating them as unique would change what the
    database enforces rather than restoring it, and the uniqueness already lives
    on the constraint.
    """
    for index, table in _REDUNDANT:
        column = "token" if table == "user_invitations" else "name"
        op.create_index(index, table, [column], unique=False)
