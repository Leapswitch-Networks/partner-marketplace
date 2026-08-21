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
from app.models.user import User
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


# ── The lifecycle — TECH_DEBT PM-47 ──────────────────────────────────────────
#
# Modelled on `listing_service._TRANSITIONS` deliberately: one table, one guard,
# and the same 409 vocabulary, so there is not a second way of expressing a state
# machine in this codebase.
#
# The rule the table encodes is **never contradict a recorded timestamp**. That is
# what made the old `set_status` wrong: it accepted any of the five statuses in any
# order, so `RESPONDED -> NEW` was reachable on an enquiry whose
# `first_responded_at` proved a reply had been sent. The status and the timestamp
# then disagreed, and § 16.1's measure is built on the timestamp.

#: A commercial conclusion. Mutually reachable **on purpose** — recording `WON` on
#: an enquiry that was actually `LOST` is a mis-click, and none of these three
#: contradicts a timestamp, so correcting one is not rewriting history.
_OUTCOMES = frozenset({"WON", "LOST", "CLOSED"})

#: Still in the inbox. `VIEWED` means opened and not yet answered — the state
#: `first_viewed_at` (`d4a71b93c8e2`) has measured since 2026-08-20 with nothing
#: able to display it.
_OPEN = frozenset({"NEW", "VIEWED"})

_TRANSITIONS: dict[str, frozenset[str]] = {
    # NEW -> RESPONDED without passing through VIEWED is legitimate: a partner can
    # reply straight from the list without opening the record, and `reply()` does
    # exactly that.
    "NEW": frozenset({"VIEWED", "RESPONDED"}) | _OUTCOMES,
    "VIEWED": frozenset({"RESPONDED"}) | _OUTCOMES,
    "RESPONDED": _OUTCOMES,
    "WON": _OUTCOMES - {"WON"},
    "LOST": _OUTCOMES - {"LOST"},
    "CLOSED": _OUTCOMES - {"CLOSED"},
    # Recovering a false positive. `SPAM` is one click away from every state, so it
    # *will* be applied to a real enquiry by accident, and a classification that
    # cannot be undone would destroy a genuine lead permanently. It returns to
    # `NEW` and not to whatever it was before, because nothing records what it was.
    "SPAM": frozenset({"NEW"}),
}

#: Reachable from anywhere, per `PARTNER_DIRECTORY_PLAN.md` § 19.9. Kept out of the
#: table rather than added to all seven rows: as a row it reads like six ordinary
#: edges, and the next person to add a status would have to remember to include it.
_ALWAYS_REACHABLE = frozenset({"SPAM"})

#: Everything the enum permits. Derived from the table so the two cannot drift —
#: adding a row is the only thing needed to make a status settable.
_ALL_STATUSES = frozenset(_TRANSITIONS)


def allowed_transitions(current: str) -> frozenset[str]:
    """What `current` may become. The dropdown should offer exactly this.

    Exposed rather than kept private because the alternative is the frontend
    holding its own copy of the table — and a copy that drifts offers the operator
    a status the API will refuse with a 409, which reads as a bug in the page.
    """
    return _TRANSITIONS.get(current, frozenset()) | (_ALWAYS_REACHABLE - {current})


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
    # `_OPEN` and not `== "NEW"`. Before PM-47 there was only one open state; now
    # a partner who opens the enquiry first sits at VIEWED, and checking for NEW
    # alone would leave their reply recorded as unanswered in the inbox while
    # `first_responded_at` said otherwise — the exact status/timestamp
    # disagreement `_TRANSITIONS` exists to prevent.
    if enquiry.status in _OPEN:
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


def mark_viewed(db: Session, enquiry: Enquiry, actor: User) -> bool:
    """Stamp `first_viewed_at` the first time the **recipient partner** looks.

    Returns whether it stamped, so a caller can tell "just seen" from "seen
    before" without comparing timestamps.

    ## Two rules, and both of them are the point

    **Write-once.** § 19.9 makes both trust timestamps write-once. Re-stamping on
    every open would turn "how long did they take to look at it" into "when did
    they last look at it", which is a different question and not the one ranking
    asks.

    **Only the recipient partner.** Staff hold `enquiry-view` for oversight
    (§ 20.6), so without this check a staff member browsing the enquiries index
    would stamp view times across every partner on the platform — and the measure
    would silently become "how fast does Leapswitch read its own mail". Staff have
    no `organisation_id`, so the comparison below excludes them by construction
    rather than by naming them.

    A machine principal or an anonymous caller cannot reach this: the route
    requires a permission, and neither holds any.
    """
    if enquiry.first_viewed_at is not None:
        return False
    # `organisation_id` is None for staff and for super admins, so this is False
    # for both — deliberately. It is the *recipient* whose responsiveness is
    # being measured, not whoever happened to open the record.
    if actor.organisation_id is None or actor.organisation_id != enquiry.partner_id:
        return False

    enquiry.first_viewed_at = datetime.now(timezone.utc)
    # PM-47: the timestamp landed first, on its own, because it needed no enum
    # change. Now that `VIEWED` exists the status follows it — but only from NEW.
    # A later state is further along the lifecycle and must not be walked back:
    # `_TRANSITIONS` has no edge from RESPONDED to VIEWED precisely because the
    # reply already happened.
    if enquiry.status == "NEW":
        enquiry.status = "VIEWED"
    db.flush()
    return True


def set_status(db: Session, enquiry: Enquiry, new_status: str) -> Enquiry:
    """Move one enquiry along the lifecycle, refusing moves that lie.

    Two different refusals, and the distinction is the caller's:

    * **422** — the status does not exist. A client bug or a stale build.
    * **409** — the status exists but not from here. A legitimate request that
      the current state does not allow, which is what `_TRANSITIONS` decides.

    Re-sending the status the enquiry already holds is a **no-op, not an error**.
    The table has no self-edges — a status cannot "become itself" — but a client
    that re-submits a form unchanged is not doing anything wrong, and answering it
    with a 409 would turn a harmless duplicate into a visible failure.
    """
    if new_status not in _ALL_STATUSES:
        raise HTTPException(
            http_status.HTTP_422_UNPROCESSABLE_ENTITY, f"Unknown status {new_status!r}"
        )
    if new_status == enquiry.status:
        return enquiry

    allowed = allowed_transitions(enquiry.status)
    if new_status not in allowed:
        raise HTTPException(
            http_status.HTTP_409_CONFLICT,
            f"A {enquiry.status} enquiry cannot become {new_status}. "
            f"Allowed from here: {', '.join(sorted(allowed)) or 'nothing'}.",
        )
    enquiry.status = new_status
    db.flush()
    return enquiry


def public_status(enquiry: Enquiry) -> str:
    """The status an **anonymous** buyer may see at their capability URL.

    Two of the seven are withheld, and for different reasons:

    **`SPAM` is withheld from everyone.** Telling the sender their message was
    classified as junk hands a spammer the feedback loop they need to iterate
    past the filter, and tells a *misclassified* real buyer something worse than
    silence. It reports as `NEW`, which is what their page already conveys —
    nobody has replied.

    **`VIEWED` is withheld because the timestamp behind it is.** `first_viewed_at`
    was deliberately kept off `PublicEnquiryStatus` when it was added: it was
    briefly exposed there by mistake, which would have told a buyer exactly when
    the partner opened their enquiry. Passing the *status* through would leak the
    same fact in a coarser form, and the field would have been withheld for
    nothing.

    Everything else passes through unchanged, so this narrows the public surface
    and never widens it.
    """
    return "NEW" if enquiry.status in {"VIEWED", "SPAM"} else enquiry.status


def partner_metrics(db: Session, partner_id: str) -> dict[str, int]:
    """§ 16.2's numbers for one partner, for their own dashboard.

    Returned as counts rather than a rate: a rate over three enquiries is noise
    presented as a measurement, and the caller can divide when the denominator is
    worth dividing by.

    ## Spam is excluded from both halves — this is the PM-47 defect

    Enquiries arrive through a public form that anonymous visitors can submit, so
    some of them are junk. Junk is never replied to, so it stays
    `first_responded_at IS NULL` for ever, and counting it made a partner's
    responsiveness a measure of how much spam they attracted. § 9 ranks partners
    on that number.

    So `SPAM` leaves the **numerator and the denominator**. Taking it out of only
    the unanswered count would be worse than leaving it in: the answered share
    would then be computed against a denominator inflated by messages nobody was
    ever meant to answer, so attracting spam would still cost a partner their
    rating — just less obviously.

    It is reported separately rather than silently dropped. A partner seeing
    `total` fall with no explanation would reasonably think enquiries had gone
    missing, and the count is the only evidence the classification is being used
    proportionately — a partner marking most of their inbox as spam is a
    conversation to have, and an invisible number cannot start it.
    """
    real = Enquiry.status != "SPAM"

    total = db.execute(
        select(func.count())
        .select_from(Enquiry)
        .where(and_(Enquiry.partner_id == partner_id, real))
    ).scalar_one()
    unanswered = db.execute(
        select(func.count())
        .select_from(Enquiry)
        .where(
            and_(
                Enquiry.partner_id == partner_id,
                real,
                Enquiry.first_responded_at.is_(None),
            )
        )
    ).scalar_one()
    spam = db.execute(
        select(func.count())
        .select_from(Enquiry)
        .where(and_(Enquiry.partner_id == partner_id, Enquiry.status == "SPAM"))
    ).scalar_one()
    return {
        "total": total,
        "unanswered": unanswered,
        "answered": total - unanswered,
        "spam": spam,
    }
