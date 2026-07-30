"""add_role_to_admin_users

Revision ID: c4a2f81d9e10
Revises: b818194d8e23
Create Date: 2026-04-17 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c4a2f81d9e10"
down_revision: Union[str, None] = "b818194d8e23"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

admin_role = sa.Enum("admin", "super_admin", name="admin_role")


def upgrade() -> None:
    admin_role.create(op.get_bind(), checkfirst=True)

    op.add_column(
        "admin_users",
        sa.Column(
            "role",
            admin_role,
            nullable=False,
            server_default="admin",
            comment="admin or super_admin",
        ),
    )

    # Backfill: existing super-admins get role='super_admin'
    op.execute(
        "UPDATE admin_users SET role = 'super_admin' WHERE is_super_admin = TRUE"
    )

    # Remove server default now that backfill is done; app always supplies the value
    op.alter_column("admin_users", "role", server_default=None)


def downgrade() -> None:
    op.drop_column("admin_users", "role")
    admin_role.drop(op.get_bind(), checkfirst=True)
