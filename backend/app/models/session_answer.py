import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class SessionAnswer(Base):
    __tablename__ = "session_answers"
    __table_args__ = (
        UniqueConstraint("session_id", "question_id", name="uq_session_question"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("test_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    question_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("questions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    answer: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_correct: Mapped[bool | None] = mapped_column(
        Boolean, nullable=True, comment="Set during grading on submission"
    )
    answered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    session: Mapped["TestSession"] = relationship("TestSession", back_populates="answers")  # noqa: F821
    question: Mapped["Question"] = relationship("Question", back_populates="session_answers")  # noqa: F821
