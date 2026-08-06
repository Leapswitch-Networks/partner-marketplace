"""add brand assets to app_settings

Logo and favicon upload — DYNAMIC_BRANDING_PLAN phase 4.

**Bytes in Postgres, deliberately.** The usual objection to storing files in a
database is about user-generated volume; this is **two rows that change once a
project**, each capped at 512 KB, read once per page and cached with an ETag. Against
that, `bytea` costs no new infrastructure, survives a redeploy, is included in the
database backup automatically, and behaves identically in development and production
— none of which was true of the alternatives, because the production topology is
still undecided (DEPLOYMENT.md § 1). A filesystem volume would have had to be
designed before it could be chosen.

`*_updated_at` is not decoration: it is the cache key. Asset URLs carry `?v=<epoch>`
and the serve route builds its `ETag` from it, so a replaced logo invalidates
immediately instead of persisting in every browser for the max-age.

Revision ID: d8c31f60a927
Revises: b7e42d19f0c5
Create Date: 2026-08-06
"""

import sqlalchemy as sa
from alembic import op

revision = "d8c31f60a927"
down_revision = "b7e42d19f0c5"
branch_labels = None
depends_on = None

_ASSETS = ("logo", "favicon")


def upgrade() -> None:
    for asset in _ASSETS:
        op.add_column(
            "app_settings",
            sa.Column(
                f"{asset}_mime", sa.String(length=60), nullable=True,
                comment="Detected from the file's magic bytes, never from the request",
            ),
        )
        op.add_column(
            "app_settings",
            sa.Column(f"{asset}_bytes", sa.LargeBinary(), nullable=True),
        )
        op.add_column(
            "app_settings",
            sa.Column(
                f"{asset}_updated_at", sa.DateTime(timezone=True), nullable=True,
                comment="Cache key for the ?v= query and the ETag",
            ),
        )


def downgrade() -> None:
    """Drops the stored images, which cannot be recovered from anywhere else.

    Unlike the text columns — whose values fall back to environment variables — an
    uploaded logo exists only here. A downgrade therefore loses it permanently and
    the application reverts to the monogram. That is acceptable and worth stating:
    the alternative would be refusing to downgrade at all, and the monogram is a
    complete fallback rather than a broken state.
    """
    for asset in _ASSETS:
        op.drop_column("app_settings", f"{asset}_updated_at")
        op.drop_column("app_settings", f"{asset}_bytes")
        op.drop_column("app_settings", f"{asset}_mime")
