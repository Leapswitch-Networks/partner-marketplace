"""add theme_preset to app_settings

Runtime brand theming — DYNAMIC_BRANDING_PLAN phase 3.

Stores a preset **key**, not a colour. The colour space is closed on purpose: a
free-form hex would let an administrator pick a shade that fails contrast against
either the white surface (white button labels) or the dark card (`brand-on-dark`),
and the second one already shipped as a real bug once. `core/theme.py` holds the
catalog and `tests/test_theme_presets.py` enforces AA on every entry.

Nullable, and NULL means the default preset — same rule as every other column on
this table, so a deployment that never opens the settings page keeps Viho's teal.

Revision ID: b7e42d19f0c5
Revises: a4f19c72e8d3
Create Date: 2026-08-06
"""

import sqlalchemy as sa
from alembic import op

revision = "b7e42d19f0c5"
down_revision = "a4f19c72e8d3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "app_settings",
        sa.Column(
            "theme_preset", sa.String(length=40), nullable=True,
            comment="Key into core.theme.THEME_PRESETS; NULL means the default",
        ),
    )
    # Deliberately no CHECK constraint on the value. The valid set lives in Python
    # and changes when a preset is added or retired; a database constraint would
    # have to be migrated in lockstep, and a row naming a retired preset must
    # degrade to the default rather than become unreadable. `theme.resolve` handles
    # that, and the write path validates against the live catalog.


def downgrade() -> None:
    op.drop_column("app_settings", "theme_preset")
