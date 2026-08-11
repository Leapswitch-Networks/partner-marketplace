from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Index, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SearchableEntity(Base):
    """One record type the global search will look in — configured, not hardcoded.

    Port of LeapDesk's `searchable_entities` (Module 8). Column names are kept so
    the two schemas read the same; **two of them mean something different in our
    stack and the difference is written on each.**

    The point of the table is that adding a searchable type is an admin action
    rather than a deploy. The cost is that a row names a model and a route, and
    both have to be resolved at runtime — which is where the security work is.
    """

    __tablename__ = "searchable_entities"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    #: **Adapted.** LeapDesk stores a PHP class string and resolves it with
    #: `new $modelClass`. Ours is a short model *name* — `"User"`, `"Partner"` —
    #: resolved against an **allowlist in code**, never by importing whatever the
    #: column happens to say.
    #:
    #: That is the same rule Recycle Bin follows in the reference and states
    #: outright: *"a raw string from the request is never resolved to a class
    #: name."* It applies with more force here, because this string comes from a
    #: database row an admin can edit, not from a request an admin cannot.
    model_class: Mapped[str] = mapped_column(
        String(150), unique=True, nullable=False,
        comment="Model NAME resolved against an allowlist in code — never imported directly",
    )

    label: Mapped[str] = mapped_column(
        String(100), nullable=False, comment="Section heading in the results — 'Users'"
    )
    group: Mapped[str] = mapped_column(
        String(64), nullable=False, comment="Orders and buckets the result sections"
    )
    icon: Mapped[str | None] = mapped_column(
        String(50), nullable=True, comment="navIcons key. NULL renders no glyph"
    )

    #: Which columns the text search covers, as a JSON array of column names.
    #: Also allowlisted at resolution time: a column named here that the model
    #: does not have is skipped, not interpolated into SQL.
    fields: Mapped[list[str]] = mapped_column(
        JSONB, nullable=False,
        comment="Column names to search. Checked against the model, never trusted",
    )

    display_template: Mapped[str] = mapped_column(
        String(191), nullable=False,
        comment="Result title, e.g. '{first_name} {last_name}'",
    )
    subtitle_template: Mapped[str | None] = mapped_column(
        String(191), nullable=True, comment="Second line, e.g. '{email}'"
    )

    #: **Adapted.** LeapDesk stores a Laravel named route and calls `route()`.
    #: Ours is a **path template** — `/dashboard/users/{id}` — because our routes
    #: are Next.js paths with no server-side name registry to resolve against.
    route_name: Mapped[str] = mapped_column(
        String(191), nullable=False,
        comment="Path template with one placeholder, e.g. '/dashboard/users/{id}'",
    )
    route_param_field: Mapped[str] = mapped_column(
        String(64), nullable=False, default="id",
        comment="Which column fills the placeholder",
    )

    #: Permission a searcher must hold for this type to be searched **at all**.
    #: NULL means anyone signed in. This is the first of the three layers the
    #: plan describes; it is not sufficient on its own — results must still be
    #: row-scoped, because holding `user-view` does not mean seeing every user.
    permission: Mapped[str | None] = mapped_column(
        String(100), nullable=True,
        comment="Required permission. NULL = any signed-in user. NOT row scoping",
    )

    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    created_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
    updated_by: Mapped[str | None] = mapped_column(String(36), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    #: Soft delete (Recycle Bin). NULL means live. See `recycle_bin_service` for
    #: which queries filter on it and which deliberately do not.
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True,
        comment="Soft delete. NULL means live; set means in the recycle bin",
    )

    __table_args__ = (Index("ix_searchable_entities_enabled_order", "enabled", "sort_order"),)

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<SearchableEntity {self.model_class} enabled={self.enabled}>"


class SearchLog(Base):
    """What was searched for, by whom, and how well it went.

    Port of `search_logs`. Not an audit trail — it is a **product signal**: the
    queries returning zero results are the list of things people expect to find
    here and cannot.

    ⚠️ **This table records what users type**, which on a search box is
    occasionally a name, an email or an account number. It is not covered by the
    activity log's redaction, and it should get a retention policy before it gets
    a year of data. Left as a note rather than a silent decision.
    """

    __tablename__ = "search_logs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    user_id: Mapped[str | None] = mapped_column(
        String(36), nullable=True, index=True,
        comment="No FK — the log outlives the account, like activity_log.causer_id",
    )
    q: Mapped[str] = mapped_column(String(255), nullable=False, comment="The raw query")
    result_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    duration_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    ip: Mapped[str | None] = mapped_column(String(45), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True,
        default=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (Index("ix_search_logs_user_time", "user_id", "created_at"),)

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<SearchLog {self.q!r} -> {self.result_count}>"
