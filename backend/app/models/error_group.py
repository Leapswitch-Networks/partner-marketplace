from datetime import datetime, timezone
from typing import Any, Literal

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

#: `open` → `resolved` is the normal path. `ignored` is "this is not worth
#: fixing"; `muted` is "it is worth fixing but stop telling me". LeapDesk's four,
#: kept — the two negative states are genuinely different and collapsing them
#: loses the difference between a decision and a deferral.
ErrorStatus = Literal["open", "resolved", "ignored", "muted"]

ERROR_STATUSES: tuple[ErrorStatus, ...] = ("open", "resolved", "ignored", "muted")

#: A status a *sighting* should reopen. `ignored` and `muted` are deliberate
#: choices about a known error, so a new sighting must not undo them — only
#: `resolved` is a claim that the error stopped happening, and a new sighting is
#: proof it did not.
REOPENABLE: frozenset[str] = frozenset({"resolved"})


class ErrorGroup(Base):
    """A distinct production error, grouped by fingerprint.

    Port of LeapDesk's `error_groups` (Module 17). **The fingerprint is the whole
    design** — see `error_service.fingerprint`. It is what turns tens of thousands
    of log lines into a list you can actually triage.

    The two-table split is deliberate and worth stating: **the group is what you
    triage, the occurrences are the evidence.** Status, notes and who resolved it
    belong to the bug; the IP, the URL and the stack belong to one sighting of it.
    """

    __tablename__ = "error_groups"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    fingerprint: Mapped[str] = mapped_column(
        String(32), unique=True, nullable=False,
        comment="md5(exception_class|file|line|route). Excludes the message — see the service",
    )

    exception_class: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    module: Mapped[str] = mapped_column(
        String(32), nullable=False, index=True, default="core",
        comment="Which part of the product raised it — filters the index",
    )

    route_name: Mapped[str | None] = mapped_column(String(191), nullable=True)
    method: Mapped[str | None] = mapped_column(String(10), nullable=True)
    path: Mapped[str | None] = mapped_column(String(500), nullable=True)

    file: Mapped[str] = mapped_column(String(500), nullable=False)
    line: Mapped[int] = mapped_column(Integer, nullable=False)

    latest_message: Mapped[str] = mapped_column(
        Text, nullable=False,
        comment="Most recent message. Not part of the fingerprint",
    )

    status: Mapped[ErrorStatus] = mapped_column(
        String(20), nullable=False, default="open", index=True
    )
    occurrence_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0,
        comment="Denormalised. Rows are pruned; this count is not",
    )

    first_seen_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    last_seen_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )

    resolved_by: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    occurrences: Mapped[list["ErrorOccurrence"]] = relationship(
        back_populates="group", cascade="all, delete-orphan", passive_deletes=True
    )

    __table_args__ = (Index("ix_error_groups_status_seen", "status", "last_seen_at"),)

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<ErrorGroup {self.exception_class} x{self.occurrence_count} [{self.status}]>"


class ErrorOccurrence(Base):
    """One sighting of an `ErrorGroup` — the evidence behind the count.

    ⚠️ **`context` deliberately does not capture request input.** LeapDesk says
    why in as many words and it is the most important line in this module: request
    bodies routinely carry names, emails and credentials, and **this table is
    readable by anyone holding `error-view`**. An error tracker that quietly
    becomes a credential store is worse than no error tracker.
    """

    __tablename__ = "error_occurrences"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    error_group_id: Mapped[int] = mapped_column(
        ForeignKey("error_groups.id", ondelete="CASCADE"), nullable=False
    )

    user_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
        comment="Who hit it, when there was a session. SET NULL — the sighting outlives the account",
    )

    ip: Mapped[str | None] = mapped_column(String(45), nullable=True)
    url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    method: Mapped[str | None] = mapped_column(String(10), nullable=True)

    message: Mapped[str] = mapped_column(Text, nullable=False)
    stack_trace: Mapped[str | None] = mapped_column(Text, nullable=True)
    context: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB, nullable=True,
        comment="User agent and referer ONLY. Never request input — see the class docstring",
    )

    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True,
        default=lambda: datetime.now(timezone.utc),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    group: Mapped["ErrorGroup"] = relationship(back_populates="occurrences")

    __table_args__ = (Index("ix_error_occ_group_time", "error_group_id", "occurred_at"),)

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<ErrorOccurrence group={self.error_group_id} at={self.occurred_at}>"
