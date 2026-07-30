"""create_candidates_table

Revision ID: d9e3f1a2b4c5
Revises: c4a2f81d9e10
Create Date: 2026-04-17 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d9e3f1a2b4c5"
down_revision: Union[str, None] = "c4a2f81d9e10"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "candidates",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("position", sa.String(255), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_candidates_email", "candidates", ["email"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_candidates_email", table_name="candidates")
    op.drop_table("candidates")
