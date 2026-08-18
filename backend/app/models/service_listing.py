import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

#: The moderation state machine. `listing_service` owns every transition; a
#: router may never write this column directly.
#:
#: DRAFT ──submit──► PENDING_REVIEW ──approve──► PUBLISHED
#:                         │                        │
#:                         └──reject──► REJECTED    └──edit──► PENDING_REVIEW
#:
#: **Editing a PUBLISHED listing returns it to review**, which is the rule that
#: makes moderation mean anything: without it, a listing is approved once and
#: then freely rewritten into whatever the partner likes.
ListingStatusEnum = Enum(
    "DRAFT", "PENDING_REVIEW", "PUBLISHED", "REJECTED", name="listing_status"
)

#: § 20.2 rule 9: never render a price we do not have. `ON_REQUEST` is the
#: common case and is a first-class value, not a null — "Price on request" is an
#: answer, whereas an empty price cell is a bug the reader has to interpret.
PricingModelEnum = Enum("FIXED", "FROM", "ON_REQUEST", name="listing_pricing_model")


class ServiceListing(Base):
    """One service a partner publishes.

    ## The table the public surface is really about

    A partner profile says who a company is; a listing says what you can buy and
    is where an enquiry is sent from. `PARTNER_DIRECTORY_PLAN.md` § 20.4 calls
    the listing detail page the most commercially important page on the site.

    ## Why `status` and `partners.is_listed` are both needed

    They gate different things and a single flag cannot do both. `is_listed`
    hides a whole company; `status` hides one service. A partner in good standing
    routinely has published listings and drafts at the same time, and a suspended
    partner's published listings must all disappear at once — which is a join on
    the partner, not an update of thirty rows.

    ## `rejection_reason` is not optional in practice

    § 20.6.1 puts it prominently on the partner's own view. A queue that rejects
    without saying why produces a resubmission loop that costs the moderator more
    than writing the reason would have.
    """

    __tablename__ = "service_listings"
    __table_args__ = (
        UniqueConstraint("slug", name="uq_service_listings_slug"),
        # The public category page's exact query: published listings in one
        # category. Composite and ordered status-first because status is the
        # more selective of the two once the directory has any size.
        Index("ix_service_listings_status_category", "status", "category_id"),
        Index("ix_service_listings_partner_status", "partner_id", "status"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )

    partner_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("partners.id", ondelete="CASCADE"), nullable=False, index=True
    )
    category_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("service_categories.id", ondelete="RESTRICT"), nullable=False
    )

    title: Mapped[str] = mapped_column(String(160), nullable=False)
    #: Globally unique — the public route is `/services/<category>/<listing>` but
    #: the slug alone has to resolve, so two partners cannot both own "backup".
    slug: Mapped[str] = mapped_column(String(180), nullable=False)
    summary: Mapped[str] = mapped_column(String(280), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    pricing_model: Mapped[str] = mapped_column(
        PricingModelEnum, nullable=False, default="ON_REQUEST"
    )
    #: Numeric, not Float. Money in a float is a rounding bug waiting for a
    #: report to disagree with an invoice.
    price: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="INR")

    status: Mapped[str] = mapped_column(
        ListingStatusEnum, nullable=False, default="DRAFT", index=True
    )
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    #: Set once, on first approval. Drives "recently added" and the sitemap's
    #: lastmod; deliberately not cleared when a listing returns to review, so the
    #: original publication date survives an edit.
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reviewed_by: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    created_by: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    #: Soft delete, matching the rest of the codebase's recycle-bin behaviour.
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    category: Mapped["ServiceCategory"] = relationship("ServiceCategory")  # noqa: F821
    media: Mapped[list["ListingMedia"]] = relationship(
        "ListingMedia",
        back_populates="listing",
        cascade="all, delete-orphan",
        order_by="ListingMedia.sort_order",
    )
    attributes: Mapped[list["ListingAttribute"]] = relationship(
        "ListingAttribute",
        back_populates="listing",
        cascade="all, delete-orphan",
        order_by="ListingAttribute.sort_order",
    )

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<ServiceListing {self.slug!r} {self.status}>"


class ListingMedia(Base):
    """An image on a listing.

    A row rather than a JSON column because media is **moderated**: a reviewer
    approves or removes individual images, and § 20.4 requires each to carry
    explicit dimensions so the page reserves its space and does not shift.
    Neither is expressible in a JSON blob without inventing a schema inside it.
    """

    __tablename__ = "listing_media"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    listing_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("service_listings.id", ondelete="CASCADE"), nullable=False, index=True
    )
    path: Mapped[str] = mapped_column(String(255), nullable=False)
    alt_text: Mapped[str | None] = mapped_column(String(200), nullable=True)
    #: Stored so the page can set width/height before the image loads — the CLS
    #: budget in § 20.2 is 0.1 and an unsized image blows it on its own.
    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    listing: Mapped["ServiceListing"] = relationship("ServiceListing", back_populates="media")


class ListingAttribute(Base):
    """A key/value row rendered as the listing's spec table.

    Deliberately free-form key and value: the alternative is a per-category
    attribute definition table, which is a large amount of machinery to prevent a
    problem — inconsistent labels — that moderation already catches, and that
    nobody has yet reported.
    """

    __tablename__ = "listing_attributes"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    listing_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("service_listings.id", ondelete="CASCADE"), nullable=False, index=True
    )
    label: Mapped[str] = mapped_column(String(80), nullable=False)
    value: Mapped[str] = mapped_column(String(300), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    listing: Mapped["ServiceListing"] = relationship("ServiceListing", back_populates="attributes")
