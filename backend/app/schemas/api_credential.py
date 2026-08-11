"""Schemas for API Credentials (Module 7).

**No schema in this file exposes a plaintext credential except `RevealResponse`,
which is the endpoint whose entire purpose is that.** Values travel outward as
`masked_value` and inward as `field_values`; there is no response model with a
readable secret on it by accident, which is the property to preserve when adding
one.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.schemas.common import Page

#: `local` / `staging` / `production`, matching the reference's
#: `in:local,staging,production`. A `Literal` so an unknown environment is a 422
#: rather than a row that no lookup will ever find.
ENVIRONMENT_PATTERN = r"^(local|staging|production)$"

#: Lowercase slug. The slug is resolved by code (`resolve("anthropic")`), so it
#: has to be typeable and stable, not free text.
SLUG_PATTERN = r"^[a-z0-9]+(?:[_-][a-z0-9]+)*$"


# --- Provider field schemas --------------------------------------------------


class CredentialFieldSchema(BaseModel):
    """One declared field. This is what the credential form is generated from."""

    model_config = {"from_attributes": True}

    id: int | None = None
    field_key: str = Field(min_length=1, max_length=100)
    field_label: str = Field(min_length=1, max_length=150)
    field_type: str = Field(default="text", max_length=30)
    field_options: dict[str, Any] | list[Any] | None = None
    is_required: bool = True
    #: **Per field.** A provider's region is not a secret; its token is.
    is_encrypted: bool = True
    validation_rules: dict[str, Any] | None = None
    placeholder: str | None = Field(default=None, max_length=191)
    help_text: str | None = None
    default_value: str | None = Field(default=None, max_length=500)
    display_order: int = 0


class CredentialFieldWrite(BaseModel):
    """A field declaration as submitted. `display_order` comes from list position."""

    field_key: str = Field(min_length=1, max_length=100)
    field_label: str = Field(min_length=1, max_length=150)
    field_type: str = Field(default="text", max_length=30)
    field_options: dict[str, Any] | list[Any] | None = None
    is_required: bool = True
    is_encrypted: bool = True
    validation_rules: dict[str, Any] | None = None
    placeholder: str | None = Field(default=None, max_length=191)
    help_text: str | None = None
    default_value: str | None = Field(default=None, max_length=500)


# --- Providers ---------------------------------------------------------------


class ProviderResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    name: str
    slug: str
    description: str | None
    icon: str | None
    documentation_url: str | None
    setup_steps: list[str] | None
    category: str
    #: Seeded from code and resolved by slug — not deletable, slug not editable.
    is_system: bool
    is_active: bool
    display_order: int
    created_at: datetime
    updated_at: datetime

    schemas: list[CredentialFieldSchema] = Field(default_factory=list)
    #: How many environments have a credential row for this provider. Lets the
    #: index say "configured" without a second request per row.
    credential_count: int = 0


class ProviderWriteRequest(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    slug: str = Field(min_length=1, max_length=150, pattern=SLUG_PATTERN)
    description: str | None = None
    icon: str | None = Field(default=None, max_length=100)
    documentation_url: str | None = Field(default=None, max_length=500)
    setup_steps: list[str] | None = None
    category: str = Field(default="general", max_length=64)
    is_active: bool = True
    display_order: int = 0
    #: Omit to leave a provider's field declarations untouched; send a list to
    #: replace them. Matched on `field_key`, never dropped and recreated — see
    #: `credential_service._replace_schemas` for why that distinction matters.
    schemas: list[CredentialFieldWrite] | None = None


class ProviderPage(Page[ProviderResponse]):
    can_manage: bool
    categories: list[str] = Field(default_factory=list)


# --- Credentials -------------------------------------------------------------


class MaskedFieldValue(BaseModel):
    """One field of a credential, as the UI is allowed to see it.

    `masked_value` is **never** plaintext for an encrypted or password field.
    `is_set` exists separately because an empty mask is ambiguous on its own —
    it could mean "not configured" or "configured to an empty string", and the
    screen needs to tell an operator which.
    """

    field_key: str
    field_label: str
    field_type: str
    is_encrypted: bool
    is_required: bool
    is_set: bool
    masked_value: str


class ProviderSummary(BaseModel):
    """Just enough provider to render a credential row."""

    model_config = {"from_attributes": True}

    id: int
    name: str
    slug: str
    icon: str | None
    category: str


class CredentialResponse(BaseModel):
    id: int
    provider: ProviderSummary
    environment: str
    name: str | None
    is_active: bool
    last_used_at: datetime | None
    last_verified_at: datetime | None
    verification_status: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime

    values: list[MaskedFieldValue] = Field(default_factory=list)
    #: `3 of 5` on the index without a second request.
    configured_fields: int = 0
    total_fields: int = 0


class CredentialWriteRequest(BaseModel):
    """Create and update take the same body.

    `field_values` is `{field_key: value}`. On update, **a blank value for an
    encrypted field means "leave it as it is"** — the edit form is never given
    the secret, so it cannot send it back, so a save that did not touch it must
    not wipe it.
    """

    provider_id: int
    environment: str = Field(default="production", pattern=ENVIRONMENT_PATTERN)
    name: str | None = Field(default=None, max_length=150)
    is_active: bool = True
    notes: str | None = None
    field_values: dict[str, Any] = Field(default_factory=dict)


class CredentialPage(Page[CredentialResponse]):
    can_manage: bool
    can_reveal: bool
    environments: list[str] = Field(default_factory=list)


# --- Reveal ------------------------------------------------------------------


class RevealRequest(BaseModel):
    """Which single field to decrypt.

    One field per call, deliberately: the audit entry then names the secret that
    was read, and someone who needs the SMTP host does not also pull the token
    into their browser.
    """

    field_key: str = Field(min_length=1, max_length=100)


class RevealResponse(BaseModel):
    """**The only response model in this module carrying a plaintext secret.**

    Reaching it requires `api-credential-view` *and* a password confirmation
    within the re-auth window, and every call writes an activity-log entry.
    """

    field_key: str
    value: str | None
