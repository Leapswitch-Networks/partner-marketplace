import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

#: The organisation's lifecycle, one level above the account gate on `users`.
#: PENDING is the onboarding state: the row exists and staff have not activated
#: it yet. SUSPENDED stops the whole organisation without touching its logins.
PartnerStatusEnum = Enum("PENDING", "ACTIVE", "SUSPENDED", name="partner_status")

#: What Leapswitch vouches for, and the strongest signal a closed directory has.
#: `PARTNER_DIRECTORY_PLAN.md` § 9: this is the whole product — nobody else can
#: offer it — and § 9's ranking reads it FIRST, before any paid placement.
VerificationLevelEnum = Enum(
    "UNVERIFIED", "VERIFIED", "PREMIER", name="partner_verification_level"
)


class Partner(Base):
    """A partner organisation — the thing a directory listing belongs to.

    **An organisation with many logins, not one login per partner.** That was the
    expensive decision in `MARKETPLACE_DOMAIN_PLAN.md`, it survived the switch to
    the directory product on 2026-08-10, and `PARTNER_DIRECTORY_PLAN.md` § 0 says
    explicitly that it should not be revisited: a listing belongs to a company,
    not to whoever happened to sign up. `users.organisation_id` is the link, and it is
    the single column every scoping rule reads.

    ## Two independent gates, deliberately not one column

    `status` gates **login**: a user inside a SUSPENDED partner cannot sign in
    even when their own `users.status` is ACTIVE, which is what makes suspending
    an organisation one action rather than a hunt through its logins. The check
    lives in `get_current_user`.

    `is_listed` gates **public visibility**. A partner can be perfectly able to
    sign in and still be invisible to the directory — that is the normal state
    while they are drafting their profile. Conflating the two would mean the only
    way to hide a partner is to lock them out of the tool they need to fix it.

    ## What is deliberately NOT here yet

    § 6.1 of the plan also specifies `avg_rating`, `review_count`, `response_rate`
    and `avg_response_minutes` — denormalised counters that § 9's ranking reads
    rather than aggregating at query time. They are **omitted until the features
    that write them exist** (enquiries are phase 6, reviews phase 8). Four columns
    that nothing writes and nothing reads is exactly the anti-pattern
    `FASTAPI_STANDARDS.md` § 12 still lists as live on `users.profile_photo_path`;
    `partners` is a low-volume table where adding them later is a trivial ALTER.
    """

    __tablename__ = "partners"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )

    # --- Identity -----------------------------------------------------------
    name: Mapped[str] = mapped_column(
        String(255), nullable=False, index=True,
        comment="Trading name, shown everywhere in the UI",
    )
    legal_name: Mapped[str | None] = mapped_column(
        String(255), nullable=True, comment="Registered name, for documents"
    )
    slug: Mapped[str] = mapped_column(
        String(120), unique=True, nullable=False, index=True,
        comment="Stable public key — /partners/<slug>. Never reuse across partners",
    )

    tier_id: Mapped[int | None] = mapped_column(
        Integer,
        # SET NULL, not CASCADE: deleting a tier must never delete the partners
        # on it. A tier-less partner falls back to the most restrictive
        # entitlement, which is the safe direction.
        ForeignKey("partner_tiers.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    status: Mapped[str] = mapped_column(
        PartnerStatusEnum, nullable=False, default="PENDING", index=True,
        comment="Gates LOGIN for every user in this organisation. Not visibility",
    )

    # --- Directory face (PARTNER_DIRECTORY_PLAN § 6.1) -----------------------
    tagline: Mapped[str | None] = mapped_column(
        String(200), nullable=True, comment="One line under the name on the listing page"
    )
    about: Mapped[str | None] = mapped_column(Text, nullable=True)
    logo_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    banner_path: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Deliberately separate from the account email on `users`. What is DISPLAYED
    # is a business decision; what SIGNS IN is an identity. Merging them would
    # publish a login address the moment a partner is listed.
    website: Mapped[str | None] = mapped_column(String(255), nullable=True)
    public_email: Mapped[str | None] = mapped_column(
        String(255), nullable=True,
        comment="Shown publicly. NOT a login — see users.email",
    )
    public_phone: Mapped[str | None] = mapped_column(String(30), nullable=True)

    founded_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    employee_range: Mapped[str | None] = mapped_column(
        String(50), nullable=True, comment="Buyer filter, e.g. '11-50'"
    )

    verification_level: Mapped[str] = mapped_column(
        VerificationLevelEnum, nullable=False, default="UNVERIFIED", index=True,
        comment="What Leapswitch vouches for. Ranked BEFORE any paid placement",
    )
    verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    verified_by: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
        comment="Which staff member vouched. Null once that account is deleted",
    )

    is_listed: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, index=True,
        comment="Publicly visible in the directory. Independent of `status`",
    )

    # --- Commercial / compliance --------------------------------------------
    gst_number: Mapped[str | None] = mapped_column(String(30), nullable=True)
    pan_number: Mapped[str | None] = mapped_column(String(30), nullable=True)

    billing_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    state: Mapped[str | None] = mapped_column(String(100), nullable=True)
    country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    postal_code: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # --- The public half, added 2026-08-18 (punchlist 1.2) ------------------
    #
    # ⚠️ **No column here may record what a partner buys from us.** That
    # relationship is confidential — `PARTNER_DIRECTORY_PLAN.md` § 0.1 — and the
    # strongest enforcement available is that the column does not exist, because
    # a column that does not exist cannot be serialised by a schema somebody
    # writes next month.

    #: Where they will actually work. Free text is deliberate here and NOT for
    #: expertise: an area is displayed, never joined, whereas expertise is the
    #: filter's index and has to be a foreign key.
    service_areas: Mapped[str | None] = mapped_column(
        Text, nullable=True,
        comment="Comma-separated display list of served areas. Display only, never filtered on",
    )
    #: Stamped the first time staff make the profile publicly visible. Distinct
    #: from `is_listed`, which can be toggled back and forth — this records when
    #: the directory first showed them, and drives sitemap lastmod.
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    agreement_signed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    onboarded_by: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
        comment="Which staff member onboarded this partner",
    )
    notes: Mapped[str | None] = mapped_column(
        Text, nullable=True,
        comment="INTERNAL ONLY — never serialise this into a partner-facing schema",
    )

    # --- Audit --------------------------------------------------------------
    created_by: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    updated_by: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # --- Relationships ------------------------------------------------------
    # joined, not selectin: a partner is almost always rendered with its tier
    # (the list shows the tier badge), and the tier table is a handful of rows.
    tier: Mapped["PartnerTier | None"] = relationship(  # noqa: F821
        back_populates="partners", lazy="joined"
    )
    # Explicit foreign_keys because `users` reaches this table twice — once as
    # the membership link (users.organisation_id) and three times as audit columns
    # pointing the other way. Without it SQLAlchemy cannot choose a join.
    users: Mapped[list["User"]] = relationship(  # noqa: F821
        back_populates="organisation",
        foreign_keys="User.organisation_id",
    )
    #: What they advertise expertise in — the join the public filter runs on.
    #:
    #: `selectin` rather than `joined`: a partner card renders its expertise, so
    #: it is always needed, but a joined load would multiply the partner row by
    #: its categories and break the pagination count on the directory index.
    #: Two queries, never N+1.
    expertise: Mapped[list["ServiceCategory"]] = relationship(  # noqa: F821
        "ServiceCategory",
        secondary="partner_expertise",
        lazy="selectin",
        order_by="ServiceCategory.sort_order",
    )
    listings: Mapped[list["ServiceListing"]] = relationship(  # noqa: F821
        "ServiceListing",
        primaryjoin="Partner.id == ServiceListing.partner_id",
        viewonly=True,
    )

    # --- Derived values -----------------------------------------------------
    # Python properties, NOT columns — none can appear in a SQL filter. Filter on
    # Partner.status / Partner.is_listed / Partner.verification_level instead.

    @property
    def is_active(self) -> bool:
        return self.status == "ACTIVE"

    @property
    def is_verified(self) -> bool:
        return self.verification_level in ("VERIFIED", "PREMIER")

    @property
    def can_sign_in(self) -> bool:
        """Whether this organisation's users may authenticate at all.

        Read by `get_current_user`. PENDING is refused as well as SUSPENDED: an
        organisation staff have not activated yet should not have working logins,
        or onboarding would grant access before anyone approved it.
        """
        return self.status == "ACTIVE"

    @property
    def publicly_visible(self) -> bool:
        """Whether the directory may show this partner to an anonymous visitor.

        Both halves are required. `is_listed` alone would publish a suspended
        organisation; `is_active` alone would publish one still drafting.
        """
        return self.is_listed and self.status == "ACTIVE"

    @property
    def tier_name(self) -> str | None:
        return self.tier.name if self.tier else None

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<Partner {self.slug} [{self.status}]>"
