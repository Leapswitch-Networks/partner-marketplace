"""Auth wire contracts.

One password policy for every account type. The previous schemas had two —
admins needed an uppercase letter and a digit, end users needed only length
(TECH_DEBT PM-14). `validate_password_strength` is now the single rule.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

from app.core.config import settings

AccountType = Literal["staff", "partner"]
UserStatus = Literal["INACTIVE", "ACTIVE", "SUSPENDED"]


def validate_password_strength(value: str) -> str:
    """At least `PASSWORD_MIN_LENGTH` chars, one uppercase letter, one digit.

    Raising ValueError here surfaces as a 422 with the message attached to the
    field, which is what the frontend renders under the input.
    """
    if len(value) < settings.PASSWORD_MIN_LENGTH:
        raise ValueError(
            f"Password must be at least {settings.PASSWORD_MIN_LENGTH} characters"
        )
    if not any(c.isupper() for c in value):
        raise ValueError("Password must contain at least one uppercase letter")
    if not any(c.isdigit() for c in value):
        raise ValueError("Password must contain at least one number")
    return value


class _PasswordPair(BaseModel):
    """Mixin for the password + confirmation pattern."""

    password: str = Field(max_length=128)
    confirm_password: str

    @field_validator("password")
    @classmethod
    def _strong(cls, v: str) -> str:
        return validate_password_strength(v)

    @model_validator(mode="after")
    def _match(self):
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match")
        return self


# --- Registration & login ---------------------------------------------------


class RegisterRequest(_PasswordPair):
    """Partner self-registration.

    Staff do not register here — they arrive via Google SSO or an invitation.
    The service rejects a staff-domain address on this endpoint so a staff
    account can never be created with a self-chosen password.
    """

    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    company_name: str | None = Field(default=None, max_length=255)
    personal_mobile_number: str | None = Field(default=None, max_length=30)
    personal_email: EmailStr | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AcceptInvitationRequest(_PasswordPair):
    """Completing a tokenised invitation with credentials."""

    token: str = Field(min_length=8, max_length=128)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)


# --- Profile ----------------------------------------------------------------


class UpdateProfileRequest(BaseModel):
    """Self-service profile update. Every field optional — a true PATCH.

    The previous version required every field, so PATCH behaved like PUT
    (TECH_DEBT PM-15).
    """

    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    designation: str | None = Field(default=None, max_length=150)
    personal_mobile_number: str | None = Field(default=None, max_length=30)
    personal_email: EmailStr | None = None
    company_name: str | None = Field(default=None, max_length=255)
    timezone_preference: str | None = Field(default=None, max_length=50)


class ChangePasswordRequest(_PasswordPair):
    """Self-service password change. Requires the current password.

    There was previously no way at all to change a password (TECH_DEBT PM-16).
    """

    current_password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(_PasswordPair):
    token: str = Field(min_length=8, max_length=256)


# --- Responses --------------------------------------------------------------


class RoleSummary(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    name: str
    display_name: str


class CurrentUserResponse(BaseModel):
    """The authenticated identity, including everything the UI needs to gate itself.

    `permissions` is the resolved union across roles — and for a super admin it
    is the FULL catalog, expanded server-side, so the frontend never has to know
    about the bypass rule.
    """

    model_config = {"from_attributes": True}

    id: str
    email: str
    first_name: str
    last_name: str
    full_name: str
    initials: str
    avatar_url: str | None
    designation: str | None
    employee_id: str | None
    personal_mobile_number: str | None
    personal_email: str | None
    company_name: str | None
    account_type: str
    status: str
    auth_provider: str
    timezone_preference: str
    email_verified_at: datetime | None
    last_login_at: datetime | None
    created_at: datetime

    roles: list[RoleSummary]
    permissions: list[str]
    is_super_admin: bool
    has_admin_access: bool


class LoginResponse(BaseModel):
    message: str
    user: CurrentUserResponse


class MessageResponse(BaseModel):
    message: str


class GoogleAuthUrlResponse(BaseModel):
    """Where the browser should be sent to begin the Google flow."""

    authorization_url: str
