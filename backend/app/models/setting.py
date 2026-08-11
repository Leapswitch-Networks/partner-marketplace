from datetime import datetime, timezone
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.setting_types import SettingType, coerce
from app.db.base import Base


class Setting(Base):
    """One configurable value, declared in code and edited by an administrator.

    Port of LeapDesk's `settings` table (Module 11), whose own docblock says it
    *"replaces four parallel per-plugin implementations"*. Same columns, same
    ordering key, same rule about who may create rows.

    **A setting is declared, never invented at the call site.** `register()` in
    the service is the only way a row appears, and it runs from a seeder. That is
    what guarantees the screen always has a label, a type and a group for
    everything it renders — a key written directly into the table by a stray
    `INSERT` would render as an untyped, unlabelled row nobody can safely edit.

    The corollary is that **there is no create endpoint and no delete endpoint**.
    A setting nothing reads is dead weight; code reading a setting that does not
    exist is a bug. Both are migration concerns, not UI ones.
    """

    __tablename__ = "settings"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    key: Mapped[str] = mapped_column(
        String(150), unique=True, nullable=False,
        comment="Dotted, namespaced — 'security.reauth.window_minutes'. The API contract",
    )

    #: JSONB, and wrapped in `{"v": …}` rather than stored bare.
    #:
    #: The wrapper is LeapDesk's (`$setting->value['v']`) and it is worth keeping:
    #: a bare JSON `null` and a SQL NULL are different states, and only the
    #: wrapper can tell "this setting is explicitly set to nothing" from "this
    #: setting has never been written". Without it, a nullable text setting and
    #: an unregistered one look identical on read.
    #:
    #: JSONB rather than JSON because Postgres can index and compare it, and the
    #: registry will be queried by value the first time anyone asks "which
    #: settings are still on their default".
    value: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB, nullable=True,
        comment="Always {'v': <typed value>}. See the note on null-vs-unset",
    )

    type: Mapped[SettingType] = mapped_column(
        String(20), nullable=False, default="string",
        comment="bool | int | string | text | json — see core/setting_types.py",
    )

    group: Mapped[str] = mapped_column(
        String(64), nullable=False, index=True,
        comment="Card heading on the screen — 'Queue Monitor', 'Invitations'",
    )
    module: Mapped[str] = mapped_column(
        String(32), nullable=False, default="core", index=True,
        comment="Which part of the product owns this. Filters the index",
    )

    label: Mapped[str] = mapped_column(
        String(191), nullable=False,
        comment="What the admin sees. A sentence, not the key",
    )
    description: Mapped[str | None] = mapped_column(
        Text, nullable=True,
        comment="One line explaining the consequence of changing it",
    )

    updated_by: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
        comment="Who last changed it. SET NULL — the change outlives the account",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        # `module, group` is the screen's sort and filter key, and the index
        # exists for the same reason LeapDesk's does: the Configuration page
        # orders by it on every load.
        Index("ix_settings_module_group", "module", "group"),
    )

    def typed_value(self) -> Any:
        """The stored value, cast to its declared type.

        Mirrors `Setting::typedValue()`. Reads through `coerce` rather than
        returning the raw JSON so a row written before a type changed still
        answers in the shape callers expect — and if it cannot, that surfaces
        here rather than three layers away.
        """
        raw = (self.value or {}).get("v")
        if raw is None:
            return None
        return coerce(self.type, raw)

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<Setting {self.key}={self.value}>"
