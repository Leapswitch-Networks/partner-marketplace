"""add enquiries.first_viewed_at — half of TECH_DEBT PM-47

§ 10 of `PARTNER_DIRECTORY_PLAN.md` calls `first_viewed_at` and
`first_responded_at` "the two timestamps the entire trust system depends on".
Only the second one existed. This adds the first.

**Scope is deliberately one column.** PM-47 also wants two new `enquiry_status`
values (`VIEWED`, `SPAM`), and those are *not* here — adding an enum value the
frontend cannot label produces an unstyled badge for a state nobody can reach,
and the enquiries screen was being edited elsewhere when this was written. Those
values also cannot be removed once added (PostgreSQL has no `ALTER TYPE … DROP
VALUE`), so they want their own migration whose `downgrade` refuses honestly
rather than one that half-reverses. This column, by contrast, drops cleanly.

**Nullable with no backfill, on purpose.** NULL means "the partner has not opened
it yet", which is exactly true of every row that predates this column — the
information was never recorded, and inventing a view time from `created_at` or
`first_responded_at` would fabricate the very measure the column exists to
report. § 16.4's "honest zero" applies: an absent measure reads as absent.

Revision ID: d4a71b93c8e2
Revises: 0e6d123d0fa3
Create Date: 2026-08-20

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "d4a71b93c8e2"
down_revision: Union[str, None] = "0e6d123d0fa3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "enquiries",
        sa.Column(
            "first_viewed_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment=(
                "Stamped once, when the recipient partner first opens the enquiry. "
                "Never on a staff read — see enquiry_service.mark_viewed"
            ),
        ),
    )


def downgrade() -> None:
    op.drop_column("enquiries", "first_viewed_at")
