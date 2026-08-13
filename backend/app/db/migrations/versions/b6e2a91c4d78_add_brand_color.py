"""add a custom brand colour to app_settings

One nullable `VARCHAR(7)` on the single-row settings table. NULL means "use the
preset in `theme_preset`", which is every installation today; a value is a
`#rrggbb` that `core/theme.validate_brand_colour` accepted at write time (white
label text on it clears WCAG AA, all other shades derive from it in
`theme.derive_shades`).

**The preset column stays populated alongside a custom colour, deliberately.**
Clearing the custom colour must restore the admin's previous *choice*, not the
factory default — so the write path never nulls `theme_preset` when it sets
`brand_color`, and the read path lets `brand_color` win only while it is set.

No backfill and no index: single row, read whole.

Revision ID: b6e2a91c4d78
Revises: f1a94c02d7b3
Create Date: 2026-08-13
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b6e2a91c4d78"
down_revision: Union[str, None] = "f1a94c02d7b3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "app_settings",
        sa.Column(
            "brand_color",
            sa.String(length=7),
            nullable=True,
            comment="Custom brand hex; overrides theme_preset when set",
        ),
    )


def downgrade() -> None:
    op.drop_column("app_settings", "brand_color")
