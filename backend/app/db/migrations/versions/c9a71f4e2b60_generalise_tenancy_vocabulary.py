"""generalise tenancy vocabulary: organisation_id and internal/external

Revision ID: c9a71f4e2b60
Revises: b6e2a91c4d78
Create Date: 2026-08-17

`CORE_EXTRACTION_PLAN.md` phase 2. The platform layer had the partner directory's
vocabulary baked into two of its most load-bearing places — a column on `users`
that `get_current_user` reads on every authenticated request, and a Postgres enum
that literally spells `staff | partner`. A second project built on this core
inherited both.

Four changes, and one addition that closes a hole the plan found on the way:

| Change | Why |
|---|---|
| `users.partner_id` → `users.organisation_id` | The core owns a tenancy concept; "partner" is this project's word for the tenant. The FK still points at `partners` — the domain names the table, the core names the relationship |
| `account_type: staff\\|partner` → `internal\\|external` | `is_staff_email()` already decides which; it only spelled the answer domain-specifically |
| `invitation_account_type` the same | It mirrors `account_type` and must not drift from it |
| `user_invitations.organisation_id` **added** | See below |

## The hole this closes

**Nothing in the application could write `users.partner_id`.** No service set it,
neither user schema carried it, and `user_invitations` had no such column —
measured 2026-08-17. So an organisation could be onboarded, activated, verified
and published, and no person could ever be attached to it except by hand in the
database. The organisation gate in `core/dependencies.py`, which re-reads the
org's status on every request, therefore governed **zero users**.

Adding the column here is the schema half; the service and schema halves land in
the same change.

## Why `ALTER TYPE ... RENAME VALUE` rather than create-cast-drop

The usual recipe for changing a Postgres enum is to build a new type, cast the
column, drop the old and rename. That is required when values are *added in the
middle* or *removed*. Renaming a value in place has been supported since PG 10,
is transactional, and — unlike the recipe — cannot lose a row to a failed cast.
This deployment runs PG 16 (verified before writing this).

The rename also means **no data migration**: every existing row keeps its
identity, `'staff'` simply becomes `'internal'`. Measured before running: 12
users, all `staff`; 1 invitation shape, `partner`.

## The downgrade is real and was tested

Enum migrations are exactly where an untested `downgrade()` bites, because the
failure surfaces only when someone is already rolling back. Round-tripped
`upgrade → downgrade → upgrade` against the live development database before
this file was committed.
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "c9a71f4e2b60"
down_revision = "b6e2a91c4d78"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- users.partner_id -> users.organisation_id --------------------------
    #
    # The index and the FK constraint keep their old NAMES after a column
    # rename, which is cosmetic but confusing — `fk_users_partner_id` on a column
    # called `organisation_id` is the kind of thing that makes the next person
    # doubt the schema. Renamed explicitly.
    op.alter_column("users", "partner_id", new_column_name="organisation_id")
    op.execute("ALTER INDEX ix_users_partner_id RENAME TO ix_users_organisation_id")
    op.execute("ALTER TABLE users RENAME CONSTRAINT fk_users_partner_id TO fk_users_organisation_id")

    op.execute(
        "COMMENT ON COLUMN users.organisation_id IS "
        "'Organisation membership. NULL means an internal (first-party) account'"
    )

    # --- account_type: staff|partner -> internal|external -------------------
    op.execute("ALTER TYPE account_type RENAME VALUE 'staff' TO 'internal'")
    op.execute("ALTER TYPE account_type RENAME VALUE 'partner' TO 'external'")
    op.execute("ALTER TYPE invitation_account_type RENAME VALUE 'staff' TO 'internal'")
    op.execute("ALTER TYPE invitation_account_type RENAME VALUE 'partner' TO 'external'")

    # The column defaults quote the old value, so they have to be restated or
    # the next INSERT that omits account_type fails with "invalid input value".
    op.execute("ALTER TABLE users ALTER COLUMN account_type SET DEFAULT 'external'")
    op.execute("ALTER TABLE user_invitations ALTER COLUMN account_type SET DEFAULT 'external'")

    # --- user_invitations.organisation_id (new) -----------------------------
    #
    # SET NULL, matching `users.organisation_id`: deleting an organisation must
    # not delete the record that someone was invited into it. CASCADE here would
    # destroy the audit trail of an invitation that was already accepted.
    op.execute(
        """
        ALTER TABLE user_invitations
            ADD COLUMN organisation_id VARCHAR(36)
            REFERENCES partners(id) ON DELETE SET NULL
        """
    )
    op.execute(
        "COMMENT ON COLUMN user_invitations.organisation_id IS "
        "'Organisation the invitee joins. NULL means an internal account'"
    )
    op.create_index(
        "ix_user_invitations_organisation_id", "user_invitations", ["organisation_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_user_invitations_organisation_id", table_name="user_invitations")
    op.drop_column("user_invitations", "organisation_id")

    # **Rename the enum values BEFORE restating the defaults, not after.**
    #
    # The first version of this function had these two blocks the other way
    # round and failed outright: `SET DEFAULT 'partner'` is rejected while the
    # type still spells that value `external`. Transactional DDL rolled the
    # whole downgrade back, so nothing was half-applied — but a rollback that
    # cannot run is a rollback you do not have, which is precisely the failure
    # an untested `downgrade()` hides until someone needs it.
    op.execute("ALTER TYPE invitation_account_type RENAME VALUE 'external' TO 'partner'")
    op.execute("ALTER TYPE invitation_account_type RENAME VALUE 'internal' TO 'staff'")
    op.execute("ALTER TYPE account_type RENAME VALUE 'external' TO 'partner'")
    op.execute("ALTER TYPE account_type RENAME VALUE 'internal' TO 'staff'")

    op.execute("ALTER TABLE users ALTER COLUMN account_type SET DEFAULT 'partner'")
    op.execute("ALTER TABLE user_invitations ALTER COLUMN account_type SET DEFAULT 'partner'")

    op.execute("ALTER TABLE users RENAME CONSTRAINT fk_users_organisation_id TO fk_users_partner_id")
    op.execute("ALTER INDEX ix_users_organisation_id RENAME TO ix_users_partner_id")
    op.alter_column("users", "organisation_id", new_column_name="partner_id")

    op.execute(
        "COMMENT ON COLUMN users.partner_id IS "
        "'Organisation membership. NULL means Leapswitch staff'"
    )
