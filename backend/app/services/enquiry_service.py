"""Enquiries — the product.

`PARTNER_DIRECTORY_PLAN.md` § 16.1's one number is *enquiries per listed partner
per month, and the share answered within the SLA*. Everything here exists to make
one of those two measurable.

## The two rules that are not negotiable

**One enquiry goes to one partner.** The public pages promise it in as many
words. `create_enquiry` takes a single `partner_id`, writes one
`enquiry_recipients` row, and there is no code path that fans out — decision 5 is
open and the table is the placeholder for answering it, not permission to.

**`first_responded_at` is stamped once.** It is the numerator of the only trust
signal we can honestly show a buyer. Re-stamping on every reply turns "time to
first response" into "time to most recent reply", which is a different and much
less useful number.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status as http_status
from sqlalchemy import Select, and_, func, select
from sqlalchemy.orm import Session, selectinload

from app.models.enquiry import Enquiry, EnquiryMessage, EnquiryRecipient
from app.models.partner import Partner
from app.models.service_listing import ServiceListing
from app.services import scoping

# ── Scoping — punchlist 1.8 ──────────────────────────────────────────────────
#
# An enquiry belongs to the partner it was sent to. There is **no public
# predicate**: `None` means nothing anonymous may ever read an enquiry through
# `apply_scope`, which is correct — the buyer's own access is by unguessable
# reference and goes through `get_by_reference`, deliberately not through the
# scoping machinery.
scoping.register_scope(Enquiry, owner_column=Enquiry.partner_id, public_predicate=None)
scoping.register_scope(
    EnquiryRecipient, owner_column=EnquiryRecipient.partner_id, public_predicate=None
)


def base_query() -> Select:
    return select(Enquiry).options(selectinload(Enquiry.messages))


def get_or_404(db: Session, enquiry_id: str) -> Enquiry:
    enquiry = db.get(Enquiry, enquiry_id)
    if enquiry is None:
        raise HTTPException(http_status.HTTP_404_NOT_FOUND, "Enquiry not found")
    return enquiry


def get_by_reference(db: Session, reference: str) -> Enquiry | None:
    """The buyer's own way back to their thread.

    ⚠️ **The reference is the credential.** The buyer has no account, so
    possession of the reference is the whole of the authorisation — which is why
    it is generated with `secrets` and why `/enquiries/<reference>` is `noindex`
    and excluded from the sitemap. Do not add a second lookup that accepts an id.
    """
    return db.execute(
        base_query().where(Enquiry.reference == reference)
    ).unique().scalar_one_or_none()


def create_enquiry(
    db: Session,
    *,
    partner_id: str,
    buyer_name: str,
    buyer_email: str,
    message: str,
    listing_id: str | None = None,
    buyer_phone: str | None = None,
    company: str | None = None,
    budget_range: str | None = None,
    timeline: str | None = None,
    source: str = "PROFILE",
    submitted_ip: str | None = None,
) -> Enquiry:
    """Accept an enquiry from an anonymous visitor.

    **The recipient is validated against what the public can see**, not merely
    against existence: an enquiry to a suspended or unlisted partner would be a
    message nobody reads, and accepting it would tell the sender their request
    had gone somewhere. Same for a listing that is not published.
    """
    partner = db.execute(
        select(Partner).where(
            Partner.id == partner_id,
            Partner.is_listed.is_(True),
            Partner.status == "ACTIVE",
        )
    ).scalar_one_or_none()
    if partner is None:
        raise HTTPException(http_status.HTTP_404_NOT_FOUND, "Partner not found")

    if listing_id is not None:
        listing = db.execute(
            select(ServiceListing).where(
                ServiceListing.id == listing_id,
                ServiceListing.partner_id == partner_id,
                ServiceListing.status == "PUBLISHED",
                ServiceListing.deleted_at.is_(None),
            )
        ).scalar_one_or_none()
        if listing is None:
            raise HTTPException(http_status.HTTP_404_NOT_FOUND, "Listing not found")

    enquiry = Enquiry(
        id=str(uuid.uuid4()),
        partner_id=partner_id,
        listing_id=listing_id,
        buyer_name=buyer_name.strip(),
        buyer_email=buyer_email.strip().lower(),
        buyer_phone=buyer_phone,
        company=company,
        message=message.strip(),
        budget_range=budget_range,
        timeline=timeline,
        source=source,
        status="NEW",
        submitted_ip=submitted_ip,
    )
    db.add(enquiry)
    db.flush()

    # The buyer's own words become the first message in the thread, so the thread
    # is complete on its own rather than needing the enquiry row read alongside
    # it. Without this the partner's reply is the first thing in the transcript.
    db.add(
        EnquiryMessage(
            id=str(uuid.uuid4()),
            enquiry_id=enquiry.id,
            direction="FROM_BUYER",
            author_user_id=None,
            body=enquiry.message,
        )
    )
    # One row. See the module docstring and § 14.5.
    db.add(
        EnquiryRecipient(id=str(uuid.uuid4()), enquiry_id=enquiry.id, partner_id=partner_id)
    )
    db.flush()
    return enquiry


def reply(db: Session, enquiry: Enquiry, *, author_user_id: str, body: str) -> EnquiryMessage:
    """A partner's reply, and the one place response time is recorded."""
    if not body or not body.strip():
        raise HTTPException(http_status.HTTP_422_UNPROCESSABLE_ENTITY, "A reply needs a body.")

    msg = EnquiryMessage(
        id=str(uuid.uuid4()),
        enquiry_id=enquiry.id,
        direction="FROM_PARTNER",
        author_user_id=author_user_id,
        body=body.strip(),
    )
    db.add(msg)

    # Stamped once — see the module docstring.
    if enquiry.first_responded_at is None:
        enquiry.first_responded_at = datetime.now(timezone.utc)
    if enquiry.status == "NEW":
        enquiry.status = "RESPONDED"

    db.flush()
    return msg


def add_buyer_message(db: Session, enquiry: Enquiry, *, body: str) -> EnquiryMessage:
    """A follow-up from the buyer, via their reference URL.

    Deliberately does **not** touch `first_responded_at` or `status`: the buyer
    writing again is not the partner responding, and letting it reset the status
    would let an impatient buyer make their own enquiry look answered.
    """
    if not body or not body.strip():
        raise HTTPException(http_status.HTTP_422_UNPROCESSABLE_ENTITY, "A message needs a body.")
    msg = EnquiryMessage(
        id=str(uuid.uuid4()),
        enquiry_id=enquiry.id,
        direction="FROM_BUYER",
        author_user_id=enquiry.buyer_user_id,
        body=body.strip(),
    )
    db.add(msg)
    db.flush()
    return msg


def set_status(db: Session, enquiry: Enquiry, new_status: str) -> Enquiry:
    allowed = {"NEW", "RESPONDED", "CLOSED", "WON", "LOST"}
    if new_status not in allowed:
        raise HTTPException(
            http_status.HTTP_422_UNPROCESSABLE_ENTITY, f"Unknown status {new_status!r}"
        )
    enquiry.status = new_status
    db.flush()
    return enquiry


def partner_metrics(db: Session, partner_id: str) -> dict[str, int]:
    """§ 16.2's numbers for one partner, for their own dashboard.

    Returned as counts rather than a rate: a rate over three enquiries is noise
    presented as a measurement, and the caller can divide when the denominator is
    worth dividing by.
    """
    total = db.execute(
        select(func.count()).select_from(Enquiry).where(Enquiry.partner_id == partner_id)
    ).scalar_one()
    unanswered = db.execute(
        select(func.count())
        .select_from(Enquiry)
        .where(and_(Enquiry.partner_id == partner_id, Enquiry.first_responded_at.is_(None)))
    ).scalar_one()
    return {"total": total, "unanswered": unanswered, "answered": total - unanswered}
