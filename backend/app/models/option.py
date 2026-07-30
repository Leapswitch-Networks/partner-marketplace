import uuid

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Option(Base):
    __tablename__ = "options"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    question_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("questions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    label: Mapped[str] = mapped_column(
        String(1), nullable=False, comment="Single letter label: A, B, C, or D"
    )
    text: Mapped[str] = mapped_column(Text, nullable=False)

    question: Mapped["Question"] = relationship("Question", back_populates="options")  # noqa: F821
