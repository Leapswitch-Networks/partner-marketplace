"""add per-role sidebar navigation preferences

Ports LeapDesk's `2026_05_01_100000_add_nav_preferences_to_roles_table`. One JSONB
column on `roles` deciding, per role, which sidebar sections start collapsed:

    {"user-management": {"collapsible": true}, "system-settings": {"collapsible": false}}

**NULL means "use the defaults", not "collapse nothing".** Backfilling every
existing row with the default map would have made the defaults immutable in
practice — changing `default_nav_preferences()` later would not affect any role
that had been backfilled. Leaving it NULL keeps the code the source of truth until
an admin deliberately overrides it, and `resolve_nav_preferences` treats a role
with NULL as contributing the default.

**JSONB rather than JSON** because the values are read on every navigation request
and JSONB parses once on write instead of on every read. No index: the column is
never filtered on, only fetched alongside the role.

The stored keys are validated against `COLLAPSIBLE_SECTION_CATALOG` on write, so an
unknown section cannot enter the column even from a stale client.

Revision ID: f5a3c81b7d29
Revises: e2b8d5c31f47
Create Date: 2026-08-04
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "f5a3c81b7d29"
down_revision: Union[str, None] = "e2b8d5c31f47"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "roles",
        sa.Column(
            "nav_preferences",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            comment="Per-section {collapsible: bool}; NULL means use the code defaults",
        ),
    )


def downgrade() -> None:
    op.drop_column("roles", "nav_preferences")
