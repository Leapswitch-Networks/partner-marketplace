import secrets
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    DateTime,
    Enum,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

#: Where the buyer was when they sent it. Kept because it is the only signal of
#: whether profiles or listings actually convert, and § 16 has no other way to
#: tell them apart.
EnquirySourceEnum = Enum("PROFILE", "LISTING", name="enquiry_source")

#: Deliberately short. § 16.2 measures response rate and time to first response;
#: WON is self-reported and directional only, and everything past it is a CRM
#: this product has decided not to be (§ 14.5).
#: Listed in the order PostgreSQL holds them, which is creation order and not
#: lifecycle order — `VIEWED` and `SPAM` were appended by `f8c2e91a44d7` (PM-47)
#: and `ALTER TYPE ... ADD VALUE` cannot insert into the middle. Nothing sorts on
#: this type, so the discrepancy is cosmetic; the lifecycle lives in
#: `enquiry_service._TRANSITIONS`, which is the only place that decides what may
#: follow what.
EnquiryStatusEnum = Enum(
    "NEW", "RESPONDED", "CLOSED", "WON", "LOST", "VIEWED", "SPAM", name="enquiry_status"
)


def _reference() -> str:
    """An unguessable public reference.

    ⚠️ **This is a capability.** `/enquiries/<reference>` is the buyer's only way
    back to their own thread, and they have no account — so the reference *is*
    the authentication. `secrets.token_urlsafe` is the right generator and a
    sequential id or a uuid4 rendered short is not: the first is enumerable and
    the second invites someone to "tidy" it into something shorter later.

    Prefixed so it is recognisable in a support conversation, and upper-cased on
    the visible half so it survives being read aloud.
    """
    return f"ENQ-{secrets.token_urlsafe(9)}"


class Enquiry(Base):
    """A buyer's message to one partner. **The product.**

    `PARTNER_DIRECTORY_PLAN.md` § 16.1's one number is enquiries per listed
    partner per month and the share answered within the SLA. Everything else on
    this table exists to make one of those two measurable.

    ## One partner, and the table that keeps the option open

    `partner_id` is not nullable: an enquiry always names exactly one recipient,
    which is the promise the public pages make in as many words — *"it goes to
    them and to nobody else"*. Decision 5 (fan-out to several partners) is open,
    and `enquiry_recipients` exists from day one with a single row in it so that
    answering it later is a write path rather than a migration. § 14.5.

    ## `buyer_user_id` is nullable and stays that way

    Decision 9 — whether buyers get accounts — is open. Anonymous is the default
    and the column costs nothing while it waits.

    ## `first_responded_at` is stamped once

    It is the numerator of the only trust signal we can honestly show a buyer.
    Re-stamping it on every reply would turn "time to first response" into "time
    to most recent reply", which is a different and much less useful number.
    """

    __tablename__ = "enquiries"
    __table_args__ = (
        UniqueConstraint("reference", name="uq_enquiries_reference"),
        # The partner inbox's query: my enquiries, newest first.
        Index("ix_enquiries_partner_created", "partner_id", "created_at"),
        # § 16.2's unanswered-rate measure.
        Index("ix_enquiries_partner_responded", "partner_id", "first_responded_at"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    reference: Mapped[str] = mapped_column(String(32), nullable=False, default=_reference)

    partner_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("partners.id", ondelete="CASCADE"), nullable=False, index=True
    )
    #: Null when the buyer enquired from a profile rather than a listing.
    listing_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("service_listings.id", ondelete="SET NULL"), nullable=True
    )
    #: Open decision 9. Anonymous enquiries are the default and the norm.
    buyer_user_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    buyer_name: Mapped[str] = mapped_column(String(120), nullable=False)
    buyer_email: Mapped[str] = mapped_column(String(255), nullable=False)
    buyer_phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    company: Mapped[str | None] = mapped_column(String(160), nullable=True)

    message: Mapped[str] = mapped_column(Text, nullable=False)
    #: Optional, and § 6.4 records that these two raise lead quality sharply —
    #: which is why they are on the form at all despite being optional.
    budget_range: Mapped[str | None] = mapped_column(String(80), nullable=True)
    timeline: Mapped[str | None] = mapped_column(String(80), nullable=True)

    source: Mapped[str] = mapped_column(EnquirySourceEnum, nullable=False, default="PROFILE")
    status: Mapped[str] = mapped_column(
        EnquiryStatusEnum, nullable=False, default="NEW", index=True
    )

    #: Stamped once, the first time the **recipient partner** opens the enquiry.
    #:
    #: § 10 of `PARTNER_DIRECTORY_PLAN.md` calls this and `first_responded_at`
    #: "the two timestamps the entire trust system depends on": together they give
    #: time-to-first-view and time-to-first-response, which feed § 16's measures
    #: and the ranking in § 9.
    #:
    #: ⚠️ **Staff opening an enquiry must never set this.** Staff hold
    #: `enquiry-view` for oversight, and stamping on their read would turn a
    #: measure of partner responsiveness into a measure of staff browsing. The
    #: rule lives in `enquiry_service.mark_viewed`.
    first_viewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        # Kept identical to the migration's comment. `0e6d123d0fa3` exists
        # precisely because model and database comments had drifted apart, and
        # `--autogenerate` reports a mismatch here as an `alter_column`.
        comment=(
            "Stamped once, when the recipient partner first opens the enquiry. "
            "Never on a staff read — see enquiry_service.mark_viewed"
        ),
    )

    first_responded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    #: For rate limiting and abuse investigation only. Never rendered anywhere.
    submitted_ip: Mapped[str | None] = mapped_column(String(45), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    messages: Mapped[list["EnquiryMessage"]] = relationship(
        "EnquiryMessage",
        back_populates="enquiry",
        cascade="all, delete-orphan",
        order_by="EnquiryMessage.created_at",
    )
    recipients: Mapped[list["EnquiryRecipient"]] = relationship(
        "EnquiryRecipient", back_populates="enquiry", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<Enquiry {self.reference} partner={self.partner_id} {self.status}>"


class EnquiryMessage(Base):
    """One message in the thread.

    **Replying on-platform is the only way response time is measurable** — if the
    partner answers by email from their own client, the enquiry sits at NEW
    forever and § 16's one number reads zero while the product works fine. That
    is the entire argument for having a thread rather than forwarding a mail.

    `author_user_id` is null for the buyer, who has no account. The `direction`
    column exists so that stays unambiguous rather than being inferred from a
    null, which reads as missing data rather than as a deliberate value.
    """

    __tablename__ = "enquiry_messages"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    enquiry_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("enquiries.id", ondelete="CASCADE"), nullable=False, index=True
    )
    #: FROM_BUYER or FROM_PARTNER. Staff may read a thread and may never write to
    #: one — § 20.6.1: staff must not reply as the partner.
    direction: Mapped[str] = mapped_column(
        Enum("FROM_BUYER", "FROM_PARTNER", name="enquiry_message_direction"), nullable=False
    )
    author_user_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    enquiry: Mapped["Enquiry"] = relationship("Enquiry", back_populates="messages")


class EnquiryRecipient(Base):
    """Which partners an enquiry reached.

    **Today this always holds exactly one row per enquiry**, duplicating
    `enquiries.partner_id`. That is deliberate and § 14.5 argues it: decision 5
    — whether an enquiry may fan out to several partners — is open, and a join
    table costs nothing now while retrofitting one later means a migration plus
    rewriting every query that assumed a single recipient.

    The duplication is the price of the option. If decision 5 is ever answered
    "no, permanently", this table can go — but not before, and not by accident.
    """

    __tablename__ = "enquiry_recipients"
    __table_args__ = (
        UniqueConstraint("enquiry_id", "partner_id", name="uq_enquiry_recipient"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    enquiry_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("enquiries.id", ondelete="CASCADE"), nullable=False, index=True
    )
    partner_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("partners.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    enquiry: Mapped["Enquiry"] = relationship("Enquiry", back_populates="recipients")
