"""create app_settings

Installation-wide project identity — the name, monogram, subtitle and tagline that
were previously written into the code in 34 places. See
`documentation/planning/DYNAMIC_BRANDING_PLAN.md` phase 1.

**No row is inserted.** Every column is nullable and the service falls back to
`settings.APP_*` for each NULL, so an empty table is the correct initial state and
a fresh install renders from the environment alone. Seeding a row here would make
the environment variables dead on arrival for every new deployment — the opposite
of what makes this core reusable.

**Written by hand.** Autogenerate does not emit the CHECK constraint from
`__table_args__` reliably across versions, and the constraint is the whole point of
the `id` column: "there is one row" enforced by convention is how a settings table
ends up with two, and two rows give branding no defined value.

Revision ID: a4f19c72e8d3
Revises: c1e70a5d94b2
Create Date: 2026-08-06
"""

import sqlalchemy as sa
from alembic import op

revision = "a4f19c72e8d3"
down_revision = "c1e70a5d94b2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "app_settings",
        sa.Column("id", sa.SmallInteger(), autoincrement=False, nullable=False),
        sa.Column(
            "app_name", sa.String(length=120), nullable=True,
            comment="NULL falls back to settings.APP_NAME",
        ),
        sa.Column(
            "app_short_name", sa.String(length=40), nullable=True,
            comment="For tight spaces — the collapsed sidebar",
        ),
        sa.Column(
            "monogram", sa.String(length=2), nullable=True,
            comment="1-2 chars for the square badge; longer clips",
        ),
        sa.Column(
            "chrome_subtitle", sa.String(length=60), nullable=True,
            comment="The small uppercase line under the name",
        ),
        sa.Column(
            "tagline", sa.String(length=200), nullable=True,
            comment="Sign-in screen copy. Product description, not branding",
        ),
        sa.Column("updated_by", sa.String(length=36), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        # Named explicitly so a later migration can drop it by name. An unnamed
        # CHECK gets a generated name that differs between environments.
        sa.CheckConstraint("id = 1", name="app_settings_single_row"),
        sa.ForeignKeyConstraint(
            ["updated_by"], ["users.id"], ondelete="SET NULL",
            name="fk_app_settings_updated_by_users",
        ),
    )


def downgrade() -> None:
    """Reversible, unlike most of this chain.

    Dropping the table loses any runtime overrides an administrator set, but it
    loses nothing that cannot be re-entered — the environment variables remain the
    source of truth and the application keeps rendering from them. That is why this
    one gets a real downgrade where `e7b41c9a2d10` and `c1e70a5d94b2` raise.
    """
    op.drop_table("app_settings")
