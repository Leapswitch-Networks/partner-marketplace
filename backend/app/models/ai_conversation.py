"""The AI assistant's memory: conversations, their messages, and feedback.

Column names and shapes are taken from LeapDesk's `agent_conversations` /
`agent_conversation_messages` / `ai_message_feedback`, which are in turn
`Laravel\\Ai`'s. Keeping them means a developer who has read one schema can read
the other, and it is the same rule `activity_log` follows.

**Three things diverge, all for the same reason — we have no `Laravel\\Ai`:**

1. `agent` is nullable and unused today. It exists in the reference so several
   named agents can share one table; we have one assistant. Kept so a second one
   does not need a migration, dropped from nothing.
2. `attachments`, `tool_calls`, `tool_results`, `usage` and `meta` are **JSONB
   rather than text**. The reference stores serialised JSON in text columns
   because Eloquent casts it on the way out; ours can be queried, which is what
   makes "how often did the assistant call `database_query` last week"
   answerable without exporting the table.
3. There is no `deleted_at`. A conversation is not a business record and the
   recycle bin's four tables are enough of that machinery; deleting a thread
   deletes it.

**What is deliberately NOT stored: the system prompt.** It is rebuilt per request
from the user's roles and permissions, so a stored copy would go stale the moment
someone's role changed — and it would be a copy of the access rules sitting in a
table the assistant itself can be asked about.
"""

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

#: Who said it. `user` and `assistant` are the two the API round-trips; `tool` is
#: written for a tool result so a replayed thread shows what the model was given,
#: not only what it concluded from it.
ROLE_USER = "user"
ROLE_ASSISTANT = "assistant"
ROLE_TOOL = "tool"


def _now() -> datetime:
    return datetime.now(timezone.utc)


class AgentConversation(Base):
    """One thread. Owned by a user, or by nobody once that user is deleted."""

    __tablename__ = "agent_conversations"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    #: `SET NULL`, not cascade: the thread is evidence of what the assistant was
    #: asked and what it answered, and that outlives the account. The messages
    #: carry their own null-able user reference for the same reason.
    user_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now, onupdate=_now
    )

    messages: Mapped[list["AgentConversationMessage"]] = relationship(
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="AgentConversationMessage.created_at",
    )

    __table_args__ = (
        # The reference's index, and the only query the list makes: this user's
        # threads, most recently used first.
        Index("agent_conversations_user_updated_index", "user_id", "updated_at"),
    )

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<AgentConversation {self.id} {self.title!r}>"


class AgentConversationMessage(Base):
    """One turn in a thread."""

    __tablename__ = "agent_conversation_messages"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    conversation_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("agent_conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    #: Which agent produced it. One today; see the module docstring.
    agent: Mapped[str | None] = mapped_column(String(100), nullable=True)
    role: Mapped[str] = mapped_column(String(25), nullable=False)

    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    attachments: Mapped[Any | None] = mapped_column(JSONB, nullable=True)
    #: What the model asked to run, and what came back. Stored **after** the
    #: tools have applied their own redaction — `database_query` replaces secret
    #: columns before its result is a string, so nothing here has ever held one.
    tool_calls: Mapped[Any | None] = mapped_column(JSONB, nullable=True)
    tool_results: Mapped[Any | None] = mapped_column(JSONB, nullable=True)
    usage: Mapped[Any | None] = mapped_column(JSONB, nullable=True)
    meta: Mapped[Any | None] = mapped_column(JSONB, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now, onupdate=_now
    )

    conversation: Mapped["AgentConversation"] = relationship(back_populates="messages")

    __table_args__ = (
        Index(
            "agent_messages_conversation_user_updated_index",
            "conversation_id",
            "user_id",
            "updated_at",
        ),
    )

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<AgentConversationMessage {self.role} in {self.conversation_id}>"


class AiMessageFeedback(Base):
    """👍/👎 on a reply. The only quality signal the assistant has."""

    __tablename__ = "ai_message_feedback"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    #: Nullable, and **no foreign key**, matching the reference: feedback on a
    #: thread that is later deleted is still a data point about answer quality,
    #: and the alternative is losing the negative feedback whenever someone
    #: clears the conversation that prompted it.
    conversation_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    user_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    helpful: Mapped[bool] = mapped_column(Boolean, nullable=False)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now
    )

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<AiMessageFeedback helpful={self.helpful}>"
