"""create the API credentials tables

Revision ID: a2f80c3d5e19
Revises: f7a3d9142e60
Create Date: 2026-08-11

LeapDesk parity Module 7 — API Credentials. Four tables, columns matching the
reference. Written ahead of the service and screens so that work can proceed in
parallel without a second author touching the Alembic chain.

**Order is load-bearing**: providers → schemas → credentials → values, because
each references the one before it.

**`api_credential_values.value` holds ciphertext** when its schema row says
`is_encrypted`. Nothing in the schema enforces that — encryption is the service's
job — but the column is `Text` rather than a bounded `String` precisely because
ciphertext is longer than the plaintext it replaces, and a `String(255)` here
would truncate a token at rest and fail at decryption rather than at write.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "a2f80c3d5e19"
down_revision: str | None = "f7a3d9142e60"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

JSONB = postgresql.JSONB(astext_type=sa.Text())


def upgrade() -> None:
    op.create_table(
        "api_service_providers",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("slug", sa.String(length=150), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("icon", sa.String(length=100), nullable=True),
        sa.Column("documentation_url", sa.String(length=500), nullable=True),
        sa.Column("setup_steps", JSONB, nullable=True),
        sa.Column("category", sa.String(length=64), server_default="general", nullable=False),
        sa.Column("is_system", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("display_order", sa.Integer(), server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug", name="uq_api_service_providers_slug"),
    )

    op.create_table(
        "api_credential_schemas",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("provider_id", sa.Integer(), nullable=False),
        sa.Column("field_key", sa.String(length=100), nullable=False),
        sa.Column("field_label", sa.String(length=150), nullable=False),
        sa.Column("field_type", sa.String(length=30), server_default="text", nullable=False),
        sa.Column("field_options", JSONB, nullable=True),
        sa.Column("is_required", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column(
            "is_encrypted", sa.Boolean(), server_default=sa.true(), nullable=False,
            comment="Per field, not per credential — see the model",
        ),
        sa.Column("validation_rules", JSONB, nullable=True),
        sa.Column("placeholder", sa.String(length=191), nullable=True),
        sa.Column("help_text", sa.Text(), nullable=True),
        sa.Column("default_value", sa.String(length=500), nullable=True),
        sa.Column("display_order", sa.Integer(), server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["provider_id"], ["api_service_providers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "provider_id", "field_key", name="uq_api_credential_schemas_provider_field"
        ),
    )

    op.create_table(
        "api_credentials",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("provider_id", sa.Integer(), nullable=False),
        sa.Column("environment", sa.String(length=30), server_default="production", nullable=False),
        sa.Column("name", sa.String(length=150), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("verification_status", sa.String(length=30), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by", sa.String(length=36), nullable=True),
        sa.Column("updated_by", sa.String(length=36), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["provider_id"], ["api_service_providers.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("provider_id", "environment", name="uq_api_credentials_provider_env"),
    )

    op.create_table(
        "api_credential_values",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("credential_id", sa.Integer(), nullable=False),
        sa.Column("schema_id", sa.Integer(), nullable=False),
        sa.Column(
            "value", sa.Text(), nullable=True,
            comment="Ciphertext when the schema says is_encrypted. Never logged",
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["credential_id"], ["api_credentials.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["schema_id"], ["api_credential_schemas.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "credential_id", "schema_id", name="uq_api_credential_values_cred_schema"
        ),
    )


def downgrade() -> None:
    op.drop_table("api_credential_values")
    op.drop_table("api_credentials")
    op.drop_table("api_credential_schemas")
    op.drop_table("api_service_providers")
