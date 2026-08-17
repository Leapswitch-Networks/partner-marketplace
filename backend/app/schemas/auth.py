"""Auth wire contracts.

One password policy for every account type. The previous schemas had two —
admins needed an uppercase letter and a digit, end users needed only length
(TECH_DEBT PM-14). `validate_password_strength` is now the single rule.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

from app.core.config import settings

AccountType = Literal["internal", "external"]
#: Two values, matching `UserStatusEnum` — see the note on it in models/user.py.
#: Keep this in step with `app.schemas.rbac.UserStatus`, which is the same type
#: declared twice so the two modules do not import each other.
UserStatus = Literal["INACTIVE", "ACTIVE"]


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
    #: Ticking "keep me signed in" extends the session from `REFRESH_TOKEN_EXPIRE_DAYS`
    #: to `REMEMBER_ME_DAYS`. Defaults to False so an omitted field means the shorter
    #: session — the safe direction, and it keeps older clients working.
    remember_me: bool = False


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
    employee_id: str | None = Field(default=None, max_length=50)
    personal_mobile_number: str | None = Field(default=None, max_length=30)
    personal_email: EmailStr | None = None
    company_name: str | None = Field(default=None, max_length=255)
    timezone_preference: str | None = Field(default=None, max_length=50)


class ChangePasswordRequest(_PasswordPair):
    """Self-service password change.

    There was previously no way at all to change a password (TECH_DEBT PM-16).

    `current_password` is **optional**, and that is not a loosening: it may be
    omitted only when the user has just proved control of their email address via
    the OTP flow, which `auth_service.change_own_password` checks server-side. A
    request that omits it without that grace is rejected. This mirrors LeapDesk's
    `PasswordUpdateRequest`, which drops the rule when `otp_reset_pending_grace`
    is set in the session.
    """

    current_password: str | None = None


class VerifyPasswordOtpRequest(BaseModel):
    """The 6-digit code from the password-recovery email.

    Exactly six characters, matching LeapDesk's `size:6`. Kept as a string rather
    than an int so a leading zero survives — `012345` is a valid code and would
    become `12345` through an integer.
    """

    otp: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


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
    #: Organisation membership. NULL means an internal, first-party account.
    #: Added 2026-08-17 with the write path (CORE_EXTRACTION_PLAN.md phase 2) —
    #: a column the UI cannot read is a column an admin cannot verify they set.
    organisation_id: str | None = None
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
    #: 2FA enrolled **and confirmed**. A boolean only — never the secret.
    #:
    #: Added 2026-08-06. It was missing here while `UserListItem` had it, so the
    #: frontend's `CurrentUser` type declared a field `/auth/me` never sent —
    #: anything trusting it would read `undefined`. Found by PM-42's generated-type
    #: contract on its first run, which is precisely the drift it exists to catch.
    #: The model property's own docstring says it is named for direct serialisation
    #: by schemas, so the omission was accidental rather than deliberate.
    two_factor_enabled: bool = False
    #: Email ownership recently proved via OTP — the password page may omit the
    #: current-password field. Server-enforced regardless of what the client sends.
    password_otp_grace: bool = False


class LoginResponse(BaseModel):
    message: str
    user: CurrentUserResponse


class TwoFactorRequiredResponse(BaseModel):
    """Returned by `/login` when the password was right but 2FA is enabled.

    No cookies are set and no session exists yet — the caller must exchange
    `challenge_token` at `/two-factor-challenge`. `two_factor_required` is an
    explicit boolean rather than something the client infers from a missing
    `user`, because a client guessing at the shape is a client that will
    eventually guess wrong and treat a challenge as a successful login.
    """

    two_factor_required: bool = True
    challenge_token: str
    message: str = "Enter the code from your authenticator app."
    recovery_codes_remaining: int


class TwoFactorChallengeRequest(BaseModel):
    challenge_token: str
    #: Carried through from the sign-in form, because the session is created **here**
    #: rather than at /login for a 2FA user — two requests after the box was ticked.
    #: Without this the choice is silently lost for exactly the users most likely to
    #: care about staying signed in.
    remember_me: bool = False
    #: Exactly one of these. A six-digit TOTP, or a recovery code if the
    #: authenticator is gone.
    code: str | None = Field(default=None, max_length=10)
    recovery_code: str | None = Field(default=None, max_length=20)


class TwoFactorEnrolmentResponse(BaseModel):
    """The one and only time the secret and recovery codes are readable.

    Both columns hold ciphertext and nothing decrypts them for display, so a user
    who loses this response must re-enrol or regenerate.
    """

    secret: str
    otpauth_uri: str
    recovery_codes: list[str]
    message: str = (
        "Scan the QR code, then confirm with a code to finish enabling two-factor "
        "authentication. Save the recovery codes now — they are not shown again."
    )


class TwoFactorConfirmRequest(BaseModel):
    code: str = Field(min_length=6, max_length=10)


class TwoFactorStatusResponse(BaseModel):
    enabled: bool
    #: True when a secret exists but has never been confirmed — enrolment started
    #: and was abandoned. 2FA is NOT enforced in this state.
    pending_confirmation: bool
    confirmed_at: datetime | None
    recovery_codes_remaining: int


class SessionResponse(BaseModel):
    """One live sign-in, for the caller's own "where am I signed in" list.

    `user_agent` is untrusted, self-reported text of unbounded length — truncated
    on write and rendered as text, never interpreted. It is shown so a person can
    recognise their own devices, and must never drive a decision.
    """

    id: str
    ip_address: str | None
    user_agent: str | None
    created_at: datetime
    last_seen_at: datetime
    #: True for the session making this request, so the UI can label it rather
    #: than offering a sign-out that logs the user out of the page they are on.
    is_current: bool


class VerifyEmailRequest(BaseModel):
    token: str = Field(min_length=8)


class ConfirmPasswordRequest(BaseModel):
    password: str = Field(min_length=1)


class RecoveryCodesResponse(BaseModel):
    recovery_codes: list[str]
    message: str = "Previous recovery codes no longer work."


class MessageResponse(BaseModel):
    message: str


class GoogleAuthUrlResponse(BaseModel):
    """Where the browser should be sent to begin the Google flow."""

    authorization_url: str
