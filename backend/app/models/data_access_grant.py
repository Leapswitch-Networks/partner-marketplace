import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

#: `view` reads the subject's records; `manage` also writes them. Exactly two
#: levels, and `manage` implies `view` — the reference has the same pair and no
#: hierarchy beyond it.
AccessLevelEnum = Enum("view", "manage", name="data_access_level")

#: A grant whose scope is this matches every module, including ones that do not
#: exist yet. Kept as a literal rather than an enum for that reason: a new module
#: must not require a migration before an existing wildcard grant covers it.
SCOPE_ALL = "*"


class DataAccessGrant(Base):
    """One user may see (or manage) the records another user created.

    **User to user, not role to role.** This is delegation — "while I am on
    leave, Priya can see my partners" — and it is deliberately decoupled from
    both roles and any reporting line. A role says what you can *do*; this says
    whose records you can do it *to*.

    That distinction is the whole design, and it is easy to get wrong: the
    reference's own route lives under `roles/data-access`, which reads as though
    grants attach to roles. They do not. `grantee_id` and `subject_id` are both
    users.

    ## Fail-closed

    Holding no grant means you see **only your own records** — never everything.
    The resolver seeds its result with the caller's own id before consulting any
    grant, so the empty case is "just me" rather than an empty filter that a
    caller might mistake for "no restriction". Ported from
    `HasDataAccess::accessibleUserIds()`, which does the same for the same reason.

    ## This model enforces nothing on its own

    There is no global query filter and no automatic scoping. `data_access_service`
    exposes the resolver, and each read that should respect delegation has to call
    it. That is the reference's design too, and its real cost is worth stating:
    **a module that never calls it has no data-access enforcement at all.** The
    mitigation is that `PM-5` will attach the same resolver at the
    `get_or_404`/`run_list` seams, so new modules inherit it rather than
    remembering it.
    """

    __tablename__ = "data_access_grants"
    __table_args__ = (
        # Makes a re-grant idempotent: the same pair and scope updates the level
        # rather than accumulating rows that disagree about it.
        UniqueConstraint(
            "grantee_id", "subject_id", "scope", name="uq_data_access_grant"
        ),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )

    grantee_id: Mapped[str] = mapped_column(
        String(36),
        # Cascade: a grant to a deleted user is meaningless, and leaving it would
        # let a recycled id inherit someone else's access.
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="The user RECEIVING access",
    )
    subject_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="The user whose records are exposed",
    )

    scope: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        default=SCOPE_ALL,
        index=True,
        comment="Module slug, or '*' for every module including future ones",
    )
    access_level: Mapped[str] = mapped_column(
        AccessLevelEnum, nullable=False, default="view", index=True
    )

    granted_by: Mapped[str | None] = mapped_column(
        String(36),
        # SET NULL, not CASCADE: the grant outlives whoever created it. Deleting
        # an administrator must not silently revoke the access they handed out.
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        comment="Who created the grant. Null once that account is deleted",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    grantee = relationship("User", foreign_keys=[grantee_id], lazy="joined")
    subject = relationship("User", foreign_keys=[subject_id], lazy="joined")
    granter = relationship("User", foreign_keys=[granted_by], lazy="joined")

    @property
    def is_wildcard(self) -> bool:
        return self.scope == SCOPE_ALL

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return (
            f"<DataAccessGrant {self.grantee_id} -> {self.subject_id} "
            f"scope={self.scope} level={self.access_level}>"
        )
