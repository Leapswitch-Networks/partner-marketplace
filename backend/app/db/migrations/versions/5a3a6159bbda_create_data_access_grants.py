"""create data_access_grants

Revision ID: 5a3a6159bbda
Revises: d8c31f60a927
Create Date: 2026-08-07

**Hand-trimmed.** `--autogenerate` produced this table plus 84 `alter_column`,
6 `drop_index` and 4 `drop_constraint` operations against `activity_log`,
`app_settings`, `permissions`, `permission_groups` and `users` — pre-existing
drift between the models and the database, none of it related to this change.

Everything unrelated was removed rather than applied. Shipping it would have
made one migration responsible for two things, and made this one impossible to
revert without also reverting the drift correction. That drift is real and worth
a migration of its own; it is not this one.

DATABASE_MIGRATIONS.md says to read the generated file before applying, and this
is why.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "5a3a6159bbda"
down_revision: str | None = "d8c31f60a927"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "data_access_grants",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column(
            "grantee_id",
            sa.String(length=36),
            nullable=False,
            comment="The user RECEIVING access",
        ),
        sa.Column(
            "subject_id",
            sa.String(length=36),
            nullable=False,
            comment="The user whose records are exposed",
        ),
        sa.Column(
            "scope",
            sa.String(length=64),
            nullable=False,
            server_default="*",
            comment="Module slug, or '*' for every module including future ones",
        ),
        sa.Column(
            "access_level",
            sa.Enum("view", "manage", name="data_access_level"),
            nullable=False,
            server_default="view",
        ),
        sa.Column(
            "granted_by",
            sa.String(length=36),
            nullable=True,
            comment="Who created the grant. Null once that account is deleted",
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        # SET NULL, not CASCADE: a grant outlives whoever handed it out. Deleting
        # an administrator must not silently revoke the access they granted.
        sa.ForeignKeyConstraint(["granted_by"], ["users.id"], ondelete="SET NULL"),
        # CASCADE on both parties: a grant referring to a deleted user is
        # meaningless, and leaving it would let a recycled id inherit access.
        sa.ForeignKeyConstraint(["grantee_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["subject_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        # Makes re-granting idempotent: the same (grantee, subject, scope)
        # updates the level rather than accumulating rows that disagree.
        sa.UniqueConstraint(
            "grantee_id", "subject_id", "scope", name="uq_data_access_grant"
        ),
    )
    op.create_index(
        op.f("ix_data_access_grants_access_level"),
        "data_access_grants",
        ["access_level"],
    )
    op.create_index(
        op.f("ix_data_access_grants_grantee_id"), "data_access_grants", ["grantee_id"]
    )
    op.create_index(
        op.f("ix_data_access_grants_scope"), "data_access_grants", ["scope"]
    )
    op.create_index(
        op.f("ix_data_access_grants_subject_id"), "data_access_grants", ["subject_id"]
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_data_access_grants_subject_id"), table_name="data_access_grants")
    op.drop_index(op.f("ix_data_access_grants_scope"), table_name="data_access_grants")
    op.drop_index(op.f("ix_data_access_grants_grantee_id"), table_name="data_access_grants")
    op.drop_index(
        op.f("ix_data_access_grants_access_level"), table_name="data_access_grants"
    )
    op.drop_table("data_access_grants")
    # The enum is created implicitly by create_table and is not dropped with it
    # on PostgreSQL, so a downgrade-then-upgrade would fail on "type already
    # exists" without this.
    sa.Enum(name="data_access_level").drop(op.get_bind(), checkfirst=True)
