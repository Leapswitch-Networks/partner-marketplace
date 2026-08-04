"""add password OTP recovery for the settings password page

Ports LeapDesk's self-service OTP recovery (`Settings/PasswordOtpController`),
which lets an **already signed-in** user who does not know their current password
prove ownership of their email and set a new one. Three cases it covers:

  1. A partner or external user who only ever signed in through a recovery flow.
  2. A Google SSO user who never set a fallback password.
  3. Anyone who simply forgot, and does not want to sign out to use
     `/forgot-password`.

**Why columns rather than LeapDesk's `password_reset_otps` table.** LeapDesk parks
the "this user proved their email, let them skip the current-password check" flag
in the **session** (`otp_reset_pending_grace`). Partner Marketplace has no session
— authentication is a stateless JWT — so that flag has nowhere to live. It becomes
state on the user instead, which also survives a restart and is auditable. Columns
match how the sibling reset flow already stores its state
(`password_reset_token` / `password_reset_expires_at`) rather than introducing a
second pattern for the same job.

  * ``password_otp``              bcrypt hash of the 6-digit code.
  * ``password_otp_expires_at``   when the code stops being accepted. The send
                                  cooldown is derived from this rather than stored
                                  separately: the code was sent at
                                  ``expires_at - PASSWORD_OTP_TTL``.
  * ``password_otp_verified_at``  the grace marker. Non-NULL and inside the window
                                  means change-password may omit the current
                                  password. Cleared the moment the password saves.

**The OTP is hashed, which LeapDesk does not do.** LeapDesk stores the six digits
in plaintext. Storing a live credential readable is the exact debt PM-1 existed to
remove, and hashing costs nothing here because `verify_password` already exists. A
six-digit space is small enough that the hash is not much of a barrier to an
offline attack, so the real protections remain the ten-minute expiry and
single use — but a casual read of the table no longer hands over a working code.

Revision ID: e2b8d5c31f47
Revises: d4a71f6c8e93
Create Date: 2026-08-04
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e2b8d5c31f47"
down_revision: Union[str, None] = "d4a71f6c8e93"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "password_otp",
            sa.Text(),
            nullable=True,
            comment="bcrypt hash of the pending 6-digit password-recovery code",
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "password_otp_expires_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="When the pending code expires; send cooldown derives from this",
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "password_otp_verified_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Email ownership proved; lets change-password skip the current password",
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "password_otp_verified_at")
    op.drop_column("users", "password_otp_expires_at")
    op.drop_column("users", "password_otp")
