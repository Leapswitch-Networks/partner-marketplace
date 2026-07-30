import uuid

from sqlalchemy import Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    test_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("tests.id", ondelete="CASCADE"), nullable=False, index=True
    )
    text: Mapped[str] = mapped_column(Text, nullable=False)
    type: Mapped[str] = mapped_column(
        Enum("mcq", "true_false", "descriptive", name="question_type"), nullable=False
    )
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    difficulty: Mapped[str | None] = mapped_column(
        Enum("easy", "medium", "hard", name="question_difficulty"), nullable=True
    )
    correct_answer: Mapped[str | None] = mapped_column(
        Text, nullable=True,
        comment="For MCQ: option label (A/B/C/D). For true_false: 'true'/'false'. Null for descriptive."
    )
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
    marks: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    test: Mapped["Test"] = relationship("Test", back_populates="questions")  # noqa: F821
    options: Mapped[list["Option"]] = relationship(  # noqa: F821
        "Option", back_populates="question", cascade="all, delete-orphan"
    )
    session_answers: Mapped[list["SessionAnswer"]] = relationship(  # noqa: F821
        "SessionAnswer", back_populates="question"
    )
