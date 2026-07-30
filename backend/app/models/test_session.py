import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class TestSession(Base):
    __tablename__ = "test_sessions"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    test_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("tests.id", ondelete="CASCADE"), nullable=False, index=True
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    submitted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    status: Mapped[str] = mapped_column(
        Enum("in_progress", "submitted", "expired", name="session_status"),
        nullable=False,
        default="in_progress",
    )
    score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_marks: Mapped[int | None] = mapped_column(Integer, nullable=True)

    user: Mapped["User"] = relationship("User")  # noqa: F821
    test: Mapped["Test"] = relationship("Test", back_populates="sessions")  # noqa: F821
    answers: Mapped[list["SessionAnswer"]] = relationship(  # noqa: F821
        "SessionAnswer", back_populates="session", cascade="all, delete-orphan"
    )
