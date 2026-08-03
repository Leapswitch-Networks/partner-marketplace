"""add two-factor auth and password confirmation

Closes the two Fortify features LeapDesk has and we did not: TOTP two-factor, and
the password confirmation that `twoFactorAuthentication(['confirmPassword' => true])`
implies.

`users` gains Fortify's three column names verbatim, so the schemas agree:
``two_factor_secret``, ``two_factor_recovery_codes``, ``two_factor_confirmed_at``.

Both secret columns hold **encrypted** text, not raw values — see
`core/encryption.py`. A TOTP secret in the clear means anyone with a database
dump can mint valid codes, and the second factor silently stops being a factor.
Laravel encrypts these for the same reason.

``two_factor_confirmed_at`` is what makes 2FA *active*, and the distinction is the
point of Fortify's ``confirm => true``: enrolling stores a secret, but until the
user has proved they can read a code from their authenticator the account must
still log in without it. Otherwise a mis-scanned QR locks someone out of their own
account permanently.

`user_sessions` gains ``password_confirmed_at``. Password confirmation is stored
**per session**, not per user: it means "this browser proved it knows the password
recently", which is exactly a property of the session. Putting it on `users` would
let a confirmation performed on one device authorise a sensitive action on another.

Revision ID: c8f42e7b91d5
Revises: b6e15d3a9f27
Create Date: 2026-08-03
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c8f42e7b91d5"
down_revision: Union[str, None] = "b6e15d3a9f27"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- users: Fortify's three column names ---------------------------------
    op.add_column(
        "users",
        sa.Column(
            "two_factor_secret",
            sa.Text(),
            nullable=True,
            comment="Fernet-encrypted TOTP secret. NEVER stored in the clear",
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "two_factor_recovery_codes",
            sa.Text(),
            nullable=True,
            comment="Fernet-encrypted JSON array. Codes are removed as they are used",
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "two_factor_confirmed_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="NULL means enrolled but unproven — 2FA is not enforced until set",
        ),
    )

    # --- user_sessions: per-session password confirmation -------------------
    op.add_column(
        "user_sessions",
        sa.Column(
            "password_confirmed_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="When this session last re-proved the password. Per session, not per user",
        ),
    )


def downgrade() -> None:
    op.drop_column("user_sessions", "password_confirmed_at")
    # Dropping these disables 2FA for everyone who had it, and the secrets are
    # gone — re-enrolment is the only way back. Not recoverable by re-running the
    # upgrade.
    op.drop_column("users", "two_factor_confirmed_at")
    op.drop_column("users", "two_factor_recovery_codes")
    op.drop_column("users", "two_factor_secret")
