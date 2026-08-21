"""Add VIEWED and SPAM to the enquiry_status enum — TECH_DEBT PM-47.

Revision ID: f8c2e91a44d7
Revises: c1f7a03b5e42
Create Date: 2026-08-21

Hand-written because it has to be: SQLAlchemy emits **no DDL** for adding a value
to an existing enum, so autogenerate produces an empty migration and the inserts
then fail at runtime with `invalid input value for enum enquiry_status`.
`DATABASE_MIGRATIONS.md` § 201 anticipates exactly this case.

## Why these two values

`SPAM` is the defect. Enquiries arrive from an anonymous public form, so some are
junk — and with nowhere to put them they stay `first_responded_at IS NULL` for
ever, which `enquiry_service.partner_metrics` counts as *unanswered*. A partner's
response rate is therefore dragged down by spam they were right to ignore, and
§ 9 ranks partners on that number. The alternatives available today (`CLOSED`,
`LOST`) are legitimate commercial outcomes and would misreport the pipeline
instead of the inbox.

`VIEWED` is the scaffolding: it makes "opened but not answered" a state the
inbox can show, which is the distinction `first_viewed_at` (added in
`d4a71b93c8e2`) already measures but nothing could display.

## No backfill, deliberately

Every existing row keeps the status it has. Reclassifying history would be a
guess: nothing recorded which of the existing `NEW` rows were junk, and marking
any of them `SPAM` would improve the very metric this migration exists to make
honest. § 16.4's honest zero — the measure starts now.

`ALTER TYPE ... ADD VALUE` is permitted inside a transaction on PostgreSQL 12+
provided the new value is not *used* in the same transaction. Nothing here
inserts or updates a row, so the transactional DDL Alembic assumes is safe.
"""

from alembic import op

revision = "f8c2e91a44d7"
down_revision = "c1f7a03b5e42"
branch_labels = None
depends_on = None

#: `IF NOT EXISTS` so a re-run is a no-op rather than a failure. This migration
#: is additive and idempotent by construction, which matters more than usual here
#: because the downgrade cannot undo it — see below.
_NEW_VALUES = ("VIEWED", "SPAM")


def upgrade() -> None:
    for value in _NEW_VALUES:
        op.execute(f"ALTER TYPE enquiry_status ADD VALUE IF NOT EXISTS '{value}'")


def downgrade() -> None:
    """Not reversible, deliberately.

    PostgreSQL has no `DROP VALUE` for an enum. The only way back is to create a
    replacement type, rewrite every column that uses it, and drop the old one —
    and that is only safe if no row currently holds one of the values being
    removed, which this function cannot know. Half-reversing (dropping the type
    while rows still reference it) would fail mid-transaction and leave the
    schema in a state neither revision describes.

    `DATABASE_MIGRATIONS.md` § 6 sanctions raising here, and revisions
    `e7b41c9a2d10` and `c1e70a5d94b2` set the precedent.

    Leaving two unused values in an enum is harmless: nothing reads the type's
    members except the application, and the application's own allowlist
    (`enquiry_service._TRANSITIONS`) is what decides which are reachable. So if
    you need to undo the *behaviour*, revert the service code — the type does not
    need to change.
    """
    raise NotImplementedError(
        "Irreversible: PostgreSQL cannot remove a value from an enum. The two "
        "added values are inert unless the application allows them, so revert "
        "the service code instead. To move the schema back regardless, restore a "
        "pre-migration dump and `alembic stamp c1f7a03b5e42`."
    )
