"""align user columns with LeapDesk's names

LeapDesk is the reference implementation for this platform, and a developer moving
between the two should not have to translate column names. This renames and adds
the columns where the two schemas describe the same thing differently.

Applied:

  * ``phone`` -> ``personal_mobile_number``
  * ``+ personal_email``       LeapDesk keeps a personal address alongside the
                               work one used for sign-in
  * ``+ profile_photo_path``   an uploaded avatar. Distinct from ``google_avatar``,
                               which is a remote URL Google supplies — a user who
                               signs in with Google can still upload their own
  * ``+ sidebar_preference``   ACTIVE = collapsed, INACTIVE = expanded. The
                               inverted-sounding naming is LeapDesk's; kept
                               verbatim, with the comment, because matching it
                               matters more than improving it
  * ``auth_provider`` value ``'credentials'`` -> ``'password'``

**Deliberately NOT copied**, because they are Laravel plumbing that nothing here
would read: ``guard_name`` (Laravel auth guards), ``remember_token`` (cookie auth,
not JWT), the polymorphic ``model_has_roles``/``role_has_permissions`` pivot shape
(Spatie supports roles on any model; we have exactly one, so ``model_type`` would
be the same string on every row), and ``sessions.payload``/``last_activity`` (a
server-side session blob, where ours is a revocation registry).

``candidates.phone`` is untouched. It belongs to the inherited test-platform
domain and has nothing to do with a user's contact details.

Revision ID: a7d92c4f1b83
Revises: f3c81a5be204
Create Date: 2026-08-03
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a7d92c4f1b83"
down_revision: Union[str, None] = "f3c81a5be204"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- Rename, don't drop-and-add: the column holds data ------------------
    op.alter_column("users", "phone", new_column_name="personal_mobile_number")

    op.add_column(
        "users",
        sa.Column(
            "personal_email",
            sa.String(length=255),
            nullable=True,
            comment="Personal address. NOT used for sign-in — `email` is the identity",
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "profile_photo_path",
            sa.String(length=2048),
            nullable=True,
            comment="Uploaded avatar path. `google_avatar` is the remote Google URL",
        ),
    )

    # --- sidebar_preference needs its own enum type -------------------------
    sidebar_preference = sa.Enum("ACTIVE", "INACTIVE", name="sidebar_preference")
    sidebar_preference.create(op.get_bind(), checkfirst=True)
    op.add_column(
        "users",
        sa.Column(
            "sidebar_preference",
            sidebar_preference,
            nullable=False,
            server_default="INACTIVE",
            comment="LeapDesk semantics: ACTIVE = collapsed, INACTIVE = expanded",
        ),
    )

    # --- Rename the enum VALUE in place ------------------------------------
    # Postgres 10+ can rename an enum label without recreating the type, so no
    # data rewrite and no dependency juggling. Every existing 'credentials' row
    # becomes 'password' by definition, because the label itself is renamed.
    op.execute("ALTER TYPE auth_provider RENAME VALUE 'credentials' TO 'password'")

    # The column default still names the old label as a literal string, so it has
    # to be restated or inserts without an explicit value would fail.
    op.alter_column("users", "auth_provider", server_default="password")


def downgrade() -> None:
    op.alter_column("users", "auth_provider", server_default="credentials")
    op.execute("ALTER TYPE auth_provider RENAME VALUE 'password' TO 'credentials'")

    op.drop_column("users", "sidebar_preference")
    sa.Enum(name="sidebar_preference").drop(op.get_bind(), checkfirst=True)

    op.drop_column("users", "profile_photo_path")
    op.drop_column("users", "personal_email")
    op.alter_column("users", "personal_mobile_number", new_column_name="phone")
