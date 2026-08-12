"""Wire contracts for roles, permissions, and user administration."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.schemas.auth import RoleSummary, validate_password_strength

AccountType = Literal["staff", "partner"]
#: Must stay identical to `app.schemas.auth.UserStatus` — see the note there.
UserStatus = Literal["INACTIVE", "ACTIVE"]


# --- Permissions ------------------------------------------------------------


class PermissionResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    name: str
    display_name: str


class PermissionGroupResponse(BaseModel):
    """A group with its permissions, ready to render as a checkbox section."""

    model_config = {"from_attributes": True}

    id: int
    name: str
    display_name: str
    display_order: int
    module: str | None
    permissions: list[PermissionResponse]


# --- Roles ------------------------------------------------------------------


class RoleResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    name: str
    display_name: str
    description: str | None
    is_system: bool
    is_protected: bool
    created_at: datetime
    permissions: list[PermissionResponse]
    user_count: int = 0


class CreateRoleRequest(BaseModel):
    name: str = Field(
        min_length=2,
        max_length=100,
        pattern=r"^[A-Za-z][A-Za-z0-9 _-]*$",
        description="Referenced by code; letters, digits, space, underscore, hyphen",
    )
    display_name: str = Field(min_length=2, max_length=150)
    description: str | None = None
    permission_ids: list[int] = Field(default_factory=list)


class UpdateRoleRequest(BaseModel):
    """All fields optional. `permission_ids` REPLACES the role's permissions
    when supplied, and is left untouched when omitted — sending `[]` clears them.
    """

    display_name: str | None = Field(default=None, min_length=2, max_length=150)
    description: str | None = None
    permission_ids: list[int] | None = None


class SetRolePermissionsRequest(BaseModel):
    """The whole grant set, for `PUT /roles/{id}/permissions`.

    A replacement rather than a patch, and required rather than optional: this
    endpoint exists to say what a role grants, so an omitted list would have to
    mean either "grant nothing" or "change nothing", and no wording makes that
    unambiguous at the call site. `[]` clears the grants and says so.
    """

    permission_ids: list[int]


# --- Users (administration) -------------------------------------------------


class UserListItem(BaseModel):
    """One row of the users table.

    `can_*` flags are computed per row against the *requesting* actor, so the UI
    never offers an action the API would reject. The API re-checks regardless —
    these are for rendering, not for security.
    """

    model_config = {"from_attributes": True}

    id: str
    email: str
    full_name: str
    initials: str
    avatar_url: str | None
    designation: str | None
    company_name: str | None
    account_type: str
    status: str
    auth_provider: str
    last_login_at: datetime | None
    created_at: datetime
    roles: list[RoleSummary]
    #: 2FA enrolled AND confirmed. On the LIST item, not just the detail response:
    #: the Users table offers "Reset 2FA" per row, and an action whose visibility
    #: depends on a field the row does not carry would either never appear or
    #: appear everywhere. A boolean only — never the secret.
    two_factor_enabled: bool = False

    can_edit: bool = False
    can_delete: bool = False
    can_toggle_status: bool = False
    can_approve: bool = False


class UserDetailResponse(UserListItem):
    first_name: str
    last_name: str
    employee_id: str | None
    personal_mobile_number: str | None
    personal_email: str | None
    timezone_preference: str
    email_verified_at: datetime | None
    failed_login_attempts: int
    locked_until: datetime | None
    last_login_ip: str | None
    updated_at: datetime


class PaginatedUsers(BaseModel):
    items: list[UserListItem]
    total: int
    page: int
    per_page: int
    pages: int


class CreateUserRequest(BaseModel):
    """Admin-created account. Password optional — omit it for an SSO-only staff
    account, in which case `password` stays NULL and only Google can sign in.
    """

    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str | None = Field(default=None, max_length=128)
    account_type: AccountType = "partner"
    status: UserStatus = "INACTIVE"
    role_ids: list[int] = Field(default_factory=list)
    designation: str | None = Field(default=None, max_length=150)
    employee_id: str | None = Field(default=None, max_length=50)
    personal_mobile_number: str | None = Field(default=None, max_length=30)
    personal_email: EmailStr | None = None
    company_name: str | None = Field(default=None, max_length=255)
    timezone_preference: str = "Asia/Kolkata"

    @field_validator("password")
    @classmethod
    def _strong_if_present(cls, v: str | None) -> str | None:
        if v is None or v == "":
            return None
        return validate_password_strength(v)


class UpdateUserRequest(BaseModel):
    """Admin update. All fields optional; only what is sent is applied.

    `status` and `role_ids` are privileged — the service rejects them unless the
    actor has admin access, and refuses them on protected targets entirely.
    """

    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    email: EmailStr | None = None
    password: str | None = Field(default=None, max_length=128)
    account_type: AccountType | None = None
    status: UserStatus | None = None
    role_ids: list[int] | None = None
    designation: str | None = Field(default=None, max_length=150)
    employee_id: str | None = Field(default=None, max_length=50)
    personal_mobile_number: str | None = Field(default=None, max_length=30)
    personal_email: EmailStr | None = None
    company_name: str | None = Field(default=None, max_length=255)
    timezone_preference: str | None = Field(default=None, max_length=50)

    @field_validator("password")
    @classmethod
    def _strong_if_present(cls, v: str | None) -> str | None:
        if v is None or v == "":
            return None
        return validate_password_strength(v)


class BulkUserIdsRequest(BaseModel):
    user_ids: list[str] = Field(min_length=1)


class BulkStatusRequest(BulkUserIdsRequest):
    status: UserStatus


class RoleUserItem(BaseModel):
    """A user holding a role, for `GET /roles/{id}/users`."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    full_name: str
    email: str
    status: str
    account_type: str


class CloneRoleRequest(BaseModel):
    """Copy a role's permissions onto a new one.

    `name` is required and must be new. The reference pre-fills it with
    "<original> Copy" in the form; the server does not invent one, because a
    silently generated role name is a thing nobody chose.
    """

    name: str = Field(min_length=1, max_length=64)
    display_name: str | None = Field(default=None, max_length=120)
    description: str | None = Field(default=None, max_length=255)


class MatrixGroupCell(BaseModel):
    """One role-by-group cell: how many of the group's permissions it grants."""

    group_id: int
    granted: int
    total: int


class MatrixRow(BaseModel):
    role_id: int
    role_name: str
    display_name: str
    is_system: bool
    cells: list[MatrixGroupCell]


class RoleMatrixResponse(BaseModel):
    """Roles down, permission groups across."""

    groups: list[PermissionGroupResponse]
    rows: list[MatrixRow]


class MatrixCellRequest(BaseModel):
    """Grant or revoke a whole group for one role, from the matrix."""

    role_id: int
    group_id: int
    granted: bool


class SendUserEmailRequest(BaseModel):
    """An ad-hoc message from an administrator to one user.

    Ported from the reference's `sendEmail`. **The three text fields only** —
    files arrive as multipart parts alongside them and are validated by
    `core/attachments.py`, not by this model, because a Pydantic body and an
    upload cannot share one request. The route composes both.
    """

    subject: str = Field(min_length=1, max_length=255)
    message: str = Field(min_length=1, max_length=10000)
    #: Copy the sender, so they hold a record of what was sent.
    bcc_sender: bool = False


class SendUserEmailResult(BaseModel):
    sent: bool
    message: str


class BulkActionResult(BaseModel):
    """Bulk operations report what they skipped and why, rather than failing
    silently — protected targets are filtered out, not rejected wholesale.
    """

    requested: int
    affected: int
    skipped: int
    skipped_reasons: list[str] = Field(default_factory=list)
    message: str


# --- Invitations ------------------------------------------------------------


class InvitationResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    email: str
    status: str
    account_type: str
    expires_at: datetime
    accepted_at: datetime | None
    resent_count: int
    last_sent_at: datetime | None
    note: str | None
    created_at: datetime
    is_expired: bool
    role: RoleSummary | None
    invited_by_name: str | None = None


class SkippedInvitation(BaseModel):
    """One address the batch could not invite, and why."""

    email: str
    reason: str


class InvitationStats(BaseModel):
    """Counts by status, for the index's summary cards.

    Its own endpoint rather than derived from the page: the list is paginated, so
    counting the rows on screen would report the page size. The reference gets
    away with deriving them only because its list is unpaginated.
    """

    pending: int
    accepted: int
    expired: int
    cancelled: int


class CreateInvitationRequest(BaseModel):
    email: EmailStr
    role_id: int | None = None
    account_type: AccountType = "partner"
    note: str | None = Field(default=None, max_length=1000)


class BulkCreateInvitationRequest(BaseModel):
    invitations: list[CreateInvitationRequest] = Field(min_length=1, max_length=50)


class InvitationPreviewResponse(BaseModel):
    """What the acceptance page shows before the user commits.

    Deliberately minimal: the email is echoed so the invitee can confirm they
    have the right link, but nothing about the inviter or the wider system is
    exposed to an unauthenticated caller holding a token.
    """

    email: str
    role_name: str | None
    account_type: str
    expires_at: datetime
    requires_google: bool
