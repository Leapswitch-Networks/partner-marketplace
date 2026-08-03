"""add refresh-token rotation with reuse detection

Closes PM-31. Sessions (migration `f3c81a5be204`) made revocation possible, but
`/refresh` only *reissued*: the session id was carried over and the superseded
refresh token stayed decodable and usable until its own seven-day expiry. So a
captured refresh token remained good for as long as the session lived, even after
the legitimate client had refreshed several times.

Three columns on `user_sessions`:

  * ``refresh_token_jti``    the id of the ONE refresh token currently valid for
                             this session. Anything else is not current.
  * ``previous_refresh_jti`` the one just superseded, kept only for the grace
                             window below.
  * ``refresh_rotated_at``   when the swap happened, which is what bounds the
                             window.

**Why a grace window exists at all.** Strict rotation plus reuse detection has a
well-known failure mode: two browser tabs refreshing at the same moment. The
second request presents a token that was valid microseconds earlier, is judged a
replay, and the whole session is killed — so a completely legitimate user is
signed out for having two tabs open. Accepting the immediately-previous token for
a few seconds without rotating again removes that, and an attacker gains only
those seconds on a token they would have to have captured already.

Beyond the window, presenting a superseded token means either a replay or a theft,
and neither should continue — the session is revoked with reason
``reuse_detected``, which `user_session.py` already anticipated.

**No backfill: existing sessions have a NULL jti and will be refused.** Their
tokens carry no `jti` claim, so accepting them "until the first rotation" would
leave a window where a pre-migration stolen token still works — precisely the hole
this closes. Those users sign in again. That is the same fail-closed choice made
for `sid`, for the same reason.

Revision ID: d4a71f6c8e93
Revises: c8f42e7b91d5
Create Date: 2026-08-03
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d4a71f6c8e93"
down_revision: Union[str, None] = "c8f42e7b91d5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "user_sessions",
        sa.Column(
            "refresh_token_jti",
            sa.String(length=36),
            nullable=True,
            comment="The one refresh token currently valid for this session",
        ),
    )
    op.add_column(
        "user_sessions",
        sa.Column(
            "previous_refresh_jti",
            sa.String(length=36),
            nullable=True,
            comment="Just-superseded token, honoured only inside the grace window",
        ),
    )
    op.add_column(
        "user_sessions",
        sa.Column(
            "refresh_rotated_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="When the last rotation happened; bounds the grace window",
        ),
    )

    # Reuse detection looks up by jti when diagnosing, and the column is highly
    # selective, so an index keeps that cheap as the table grows.
    op.create_index(
        "ix_user_sessions_refresh_token_jti", "user_sessions", ["refresh_token_jti"]
    )


def downgrade() -> None:
    op.drop_index("ix_user_sessions_refresh_token_jti", table_name="user_sessions")
    op.drop_column("user_sessions", "refresh_rotated_at")
    op.drop_column("user_sessions", "previous_refresh_jti")
    op.drop_column("user_sessions", "refresh_token_jti")
