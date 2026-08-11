"""API Credentials — the four tables (LeapDesk parity, Module 7).

Port of `api_service_providers`, `api_credential_schemas`, `api_credentials` and
`api_credential_values`. Columns match the reference one for one.

## Why four tables and not one

The obvious design is one `credentials` table with a JSON blob of values. It is
wrong here, and the reason is the **schema** table: a provider declares what
fields it needs — their labels, types, whether each is required, whether each is
encrypted — so the form for a new provider is generated rather than written. That
declaration has to live somewhere queryable, and a blob cannot say "this one field
is secret and that one is not".

The split also puts encryption at the right granularity. `api_credential_values`
holds one row per field, so a provider's non-secret settings (a region, an
account id) stay readable while its secret ones are encrypted — instead of the
whole blob being opaque because one field in it is.
"""

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class ApiServiceProvider(Base):
    """A third party we hold credentials for — Slack, an SMTP host, a registrar."""

    __tablename__ = "api_service_providers"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    slug: Mapped[str] = mapped_column(String(150), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    icon: Mapped[str | None] = mapped_column(String(100), nullable=True)
    documentation_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    #: Ordered prose shown beside the form — "create an app, copy the token".
    #: A provider nobody can work out how to configure is a support ticket.
    setup_steps: Mapped[list[str] | None] = mapped_column(JSONB, nullable=True)

    category: Mapped[str] = mapped_column(String(64), nullable=False, default="general")

    #: Seeded from code and not deletable through the UI. A provider some code
    #: resolves by slug must not be removable by an administrator who has not
    #: read that code.
    is_system: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now, onupdate=_now
    )

    schemas: Mapped[list["ApiCredentialSchema"]] = relationship(
        back_populates="provider", cascade="all, delete-orphan", passive_deletes=True
    )
    credentials: Mapped[list["ApiCredential"]] = relationship(
        back_populates="provider", cascade="all, delete-orphan", passive_deletes=True
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<ApiServiceProvider {self.slug}>"


class ApiCredentialSchema(Base):
    """One field a provider requires — the declaration the form is generated from."""

    __tablename__ = "api_credential_schemas"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    provider_id: Mapped[int] = mapped_column(
        ForeignKey("api_service_providers.id", ondelete="CASCADE"), nullable=False
    )

    field_key: Mapped[str] = mapped_column(String(100), nullable=False)
    field_label: Mapped[str] = mapped_column(String(150), nullable=False)
    field_type: Mapped[str] = mapped_column(String(30), nullable=False, default="text")
    field_options: Mapped[dict[str, Any] | list[Any] | None] = mapped_column(JSONB, nullable=True)

    is_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    #: **Per field, not per credential.** A provider's region is not a secret and
    #: masking it makes the screen unusable; its token is, and must never be
    #: rendered. One flag per field is what lets both be true at once.
    is_encrypted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    validation_rules: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    placeholder: Mapped[str | None] = mapped_column(String(191), nullable=True)
    help_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    default_value: Mapped[str | None] = mapped_column(String(500), nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now, onupdate=_now
    )

    provider: Mapped["ApiServiceProvider"] = relationship(back_populates="schemas")

    __table_args__ = (
        UniqueConstraint("provider_id", "field_key", name="uq_api_credential_schemas_provider_field"),
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<ApiCredentialSchema {self.field_key} encrypted={self.is_encrypted}>"


class ApiCredential(Base):
    """One provider's credentials for one environment.

    `(provider_id, environment)` is unique: production and staging keys for the
    same provider are two rows, and there is exactly one of each. Without the
    constraint, "which key is live" becomes a question with two answers.
    """

    __tablename__ = "api_credentials"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    provider_id: Mapped[int] = mapped_column(
        ForeignKey("api_service_providers.id", ondelete="CASCADE"), nullable=False
    )

    environment: Mapped[str] = mapped_column(String(30), nullable=False, default="production")
    name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    #: Stamped by whatever resolves the credential, so an unused key is visible
    #: as unused. A credential nobody can tell is stale gets rotated last.
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    verification_status: Mapped[str | None] = mapped_column(String(30), nullable=True)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_by: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    updated_by: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now, onupdate=_now
    )

    provider: Mapped["ApiServiceProvider"] = relationship(back_populates="credentials")
    values: Mapped[list["ApiCredentialValue"]] = relationship(
        back_populates="credential", cascade="all, delete-orphan", passive_deletes=True
    )

    __table_args__ = (
        UniqueConstraint("provider_id", "environment", name="uq_api_credentials_provider_env"),
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<ApiCredential provider={self.provider_id} env={self.environment}>"


class ApiCredentialValue(Base):
    """One field's stored value.

    ⚠️ **`value` holds ciphertext when its schema says `is_encrypted`.** Nothing
    in this model decrypts; that belongs in the service, behind a permission and
    an audit entry. A model property that transparently decrypted would make
    every incidental `repr()` and log line a disclosure.
    """

    __tablename__ = "api_credential_values"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    credential_id: Mapped[int] = mapped_column(
        ForeignKey("api_credentials.id", ondelete="CASCADE"), nullable=False
    )
    schema_id: Mapped[int] = mapped_column(
        ForeignKey("api_credential_schemas.id", ondelete="CASCADE"), nullable=False
    )

    value: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="Ciphertext when the schema says is_encrypted. Never logged"
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now, onupdate=_now
    )

    credential: Mapped["ApiCredential"] = relationship(back_populates="values")

    __table_args__ = (
        UniqueConstraint("credential_id", "schema_id", name="uq_api_credential_values_cred_schema"),
    )

    def __repr__(self) -> str:  # pragma: no cover
        # Deliberately does NOT include `value`. A repr that printed ciphertext
        # would put it in every debugger session and stack dump.
        return f"<ApiCredentialValue credential={self.credential_id} schema={self.schema_id}>"
