"""drop SUSPENDED from user_status, leaving ACTIVE and INACTIVE

Revision ID: b3d7e02f4c19
Revises: a9f2c71e5b64
Create Date: 2026-08-11

Owner's call, 2026-08-11: an account is active or it is not, and the users module
must not be able to store a third thing.

**Why the column, not just the UI.** Dropping SUSPENDED from the Pydantic
`Literal` alone would stop the API accepting it while leaving the database
willing to hold it — so a future migration, a manual `UPDATE`, or a restored dump
could reintroduce a value every read path has stopped branching on. The type is
where "two values" is a fact rather than a convention.

**Postgres cannot remove a value from an enum.** `ALTER TYPE ... DROP VALUE` does
not exist at any version. The supported route is the four-step swap below —
rename the old type out of the way, create the new one, retype the column with an
explicit cast, drop the old type. The column is retyped rather than the type
edited, so the index and the NOT NULL travel with it untouched.

**Data.** Any row sitting on SUSPENDED becomes INACTIVE, because that is what
SUSPENDED already meant operationally: refused at sign-in, sessions revoked. The
`USING` expression does the mapping inside the same statement that changes the
type, so there is no window in which a row holds a value its column disallows.
Measured before writing this: 4 ACTIVE, 1 INACTIVE, **0 SUSPENDED** — the
mapping is defensive, not corrective, and must stay for the environments that
were not measured.

**The downgrade is honest about what it cannot do.** It restores the three-value
type, so the schema round-trips. It does NOT restore which accounts were
suspended, because that information stops existing the moment they are folded
into INACTIVE. The activity log keeps the history — every status change is
recorded with its `old` value — and that is the only place it survives.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "b3d7e02f4c19"
down_revision: str | None = "a9f2c71e5b64"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TYPE user_status RENAME TO user_status_old")
    op.execute("CREATE TYPE user_status AS ENUM ('INACTIVE', 'ACTIVE')")
    op.execute(
        """
        ALTER TABLE users
            ALTER COLUMN status DROP DEFAULT,
            ALTER COLUMN status TYPE user_status
                USING (
                    CASE WHEN status::text = 'SUSPENDED' THEN 'INACTIVE'
                         ELSE status::text
                    END
                )::user_status,
            ALTER COLUMN status SET DEFAULT 'INACTIVE'
        """
    )
    op.execute("DROP TYPE user_status_old")


def downgrade() -> None:
    op.execute("ALTER TYPE user_status RENAME TO user_status_old")
    op.execute("CREATE TYPE user_status AS ENUM ('INACTIVE', 'ACTIVE', 'SUSPENDED')")
    op.execute(
        """
        ALTER TABLE users
            ALTER COLUMN status DROP DEFAULT,
            ALTER COLUMN status TYPE user_status USING status::text::user_status,
            ALTER COLUMN status SET DEFAULT 'INACTIVE'
        """
    )
    op.execute("DROP TYPE user_status_old")
