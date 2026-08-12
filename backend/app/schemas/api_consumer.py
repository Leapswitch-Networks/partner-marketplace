"""Request and response shapes for the Platform API's governance surface.

**`TokenIssued.token` is the only field in the application that carries a usable
credential in plaintext**, and it exists exactly once — in the response that
mints it. Everything else here is deliberately unable to.
"""

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class AbilityOption(BaseModel):
    name: str
    label: str
    group: str
    #: `low` | `medium` | `high`. The grant screen warns on `high`.
    sensitivity: str
    description: str


class TokenSummary(BaseModel):
    """A token as it can ever be shown after the moment it was minted."""

    model_config = {"from_attributes": True}

    id: str
    name: str
    #: `pmp_a1b2c3d4` — enough to identify the credential, useless as one.
    prefix: str
    abilities: list[str]
    expires_at: datetime | None
    last_used_at: datetime | None
    revoked_at: datetime | None
    created_at: datetime


class ConsumerResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    name: str
    slug: str
    description: str | None
    owner_name: str | None
    owner_email: str | None
    active: bool
    created_at: datetime
    updated_at: datetime
    tokens: list[TokenSummary] = Field(default_factory=list)
    #: Registered but holding no live token — neither active nor disabled, and
    #: the difference between access granted and access working.
    has_live_token: bool = False


class ConsumerWriteRequest(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    slug: str = Field(min_length=2, max_length=150)
    description: str | None = Field(default=None, max_length=2000)
    owner_name: str | None = Field(default=None, max_length=150)
    #: **Required here although the column is nullable** — the reference's rule,
    #: kept with its reasoning: someone must be contactable when this integration
    #: needs revoking.
    owner_email: EmailStr
    active: bool = True


class ConsumerUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=150)
    slug: str | None = Field(default=None, min_length=2, max_length=150)
    description: str | None = Field(default=None, max_length=2000)
    owner_name: str | None = Field(default=None, max_length=150)
    owner_email: EmailStr | None = None
    active: bool | None = None


class SetActiveRequest(BaseModel):
    active: bool


class IssueTokenRequest(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    abilities: list[str] = Field(min_length=1)
    #: `None` means it never expires — offered, but the screen says what that
    #: means rather than making it the quiet default.
    expires_in_days: int | None = Field(default=None, ge=1, le=3650)


class TokenIssued(BaseModel):
    """⚠️ Contains the plaintext token. Returned once, stored nowhere.

    The router must keep this body out of any request/response logging, and the
    client must not put it in Redux or `localStorage` — render it, offer copy,
    discard on dismiss.
    """

    token: str
    warning: str
    detail: TokenSummary


class ConsumerUsage(BaseModel):
    total: int
    rejected: int
    last_called_at: datetime | None


class RequestLogEntry(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    method: str
    path: str
    status_code: int
    #: Null when the call succeeded; otherwise why it was refused.
    outcome: str | None
    token_prefix: str | None
    ip: str | None
    duration_ms: int | None
    created_at: datetime
