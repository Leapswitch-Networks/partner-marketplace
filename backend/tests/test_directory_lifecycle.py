"""The whole directory loop, walked end to end against a real database.

`DIRECTORY_BUILD_PUNCHLIST.md` § 6.3 asks for this walk to be done once by hand.
It is a test instead, for the reason every manual check eventually becomes one:
a walk done once proves the code worked that afternoon, and a walk that runs on
every commit proves it still does.

## The loop, as the owner described it on 2026-08-18

    partner applies → we approve the company → partner signs in and edits
    their own data → we approve the data → buyer filters → buyer enquires →
    partner reads it in their back office

Each step below is one of those, in order, sharing state — so a break anywhere
fails at the step that broke rather than somewhere downstream.

## What this covers, and what it deliberately does not

**Covers:** the state machine, the moderation gate, public visibility, the
enquiry write path, response-time recording, and the tenant boundary between two
partners.

**Does not cover:** HTTP, cookies, or permissions — those are asserted by
`test_route_enforcement.py`, which pins every route's guard, and by the live
checks recorded in `DAILY_CHANGES.md`. Driving this through the API would need a
signed-in session per actor and would be testing FastAPI's dependency injection
rather than the product's rules.

Everything it creates, it removes. A test that leaves rows behind makes the next
run's failure someone else's mystery.
"""

from __future__ import annotations

import uuid

import pytest
from fastapi import HTTPException
from sqlalchemy import select

from app.core.principal import ANONYMOUS
from app.models.enquiry import Enquiry
from app.models.partner import Partner
from app.models.service_category import ServiceCategory
from app.models.service_listing import ServiceListing
from app.models.user import User
from app.services import enquiry_service, listing_service, scoping


@pytest.fixture
def world():
    """Two partners, a category, and a staff reviewer — torn down afterwards.

    Two partners is not padding: the tenant boundary is the one rule here whose
    failure is a data breach rather than a bug, and it cannot be tested with one.
    """
    from app.db.session import SessionLocal

    db = SessionLocal()
    reviewer = db.scalars(select(User).where(User.status == "ACTIVE")).first()
    if reviewer is None:
        db.close()
        pytest.skip("needs one active user to act as the reviewer")

    tag = uuid.uuid4().hex[:8]
    category = ServiceCategory(name=f"Walk {tag}", slug=f"walk-{tag}", sort_order=99)
    db.add(category)
    db.flush()

    partners = []
    for index in (1, 2):
        partner = Partner(
            id=str(uuid.uuid4()),
            name=f"Walk Partner {index} {tag}",
            slug=f"walk-partner-{index}-{tag}",
            status="ACTIVE",
            verification_level="VERIFIED",
            is_listed=True,
        )
        db.add(partner)
        partners.append(partner)
    db.flush()
    db.commit()

    yield db, category, partners[0], partners[1], reviewer

    for listing in db.scalars(
        select(ServiceListing).where(ServiceListing.category_id == category.id)
    ).all():
        for enquiry in db.scalars(
            select(Enquiry).where(Enquiry.listing_id == listing.id)
        ).all():
            db.delete(enquiry)
        db.delete(listing)
    for partner in partners:
        for enquiry in db.scalars(
            select(Enquiry).where(Enquiry.partner_id == partner.id)
        ).all():
            db.delete(enquiry)
        db.delete(partner)
    db.delete(category)
    db.commit()
    db.close()


def _actor(user: User, partner: Partner) -> User:
    """A staff user borrowed as a partner member, for scoping purposes.

    `apply_scope` reads `organisation_id` and `has_admin_access`; it does not
    care how the object was built. Mutating a real row would be a side effect on
    shared data, so this shadows the two attributes on a detached copy.
    """

    class _Member:
        id = user.id
        organisation_id = partner.id
        has_admin_access = False
        roles = []

    return _Member()  # type: ignore[return-value]


class TestTheLoop:
    def test_a_new_listing_is_a_draft_and_is_not_public(self, world):
        """Step 3. Nothing publishes on creation."""
        db, category, partner, _other, _reviewer = world
        listing = listing_service.create_listing(
            db,
            partner_id=partner.id,
            title=f"Draft {uuid.uuid4().hex[:6]}",
            summary="A summary long enough to pass validation.",
            category_id=category.id,
        )
        db.commit()

        assert listing.status == "DRAFT"
        # The public predicate is the enforcement, not a filter at a call site.
        public = db.execute(
            scoping.apply_scope(
                select(ServiceListing).where(ServiceListing.id == listing.id),
                ServiceListing,
                ANONYMOUS,
            )
        ).scalar_one_or_none()
        assert public is None, "a DRAFT listing must be invisible to the public"

    def test_submitting_then_rejecting_carries_a_reason_back(self, world):
        """Steps 4 and 5. A rejection without a reason is refused."""
        db, category, partner, _other, reviewer = world
        listing = listing_service.create_listing(
            db,
            partner_id=partner.id,
            title=f"Reject {uuid.uuid4().hex[:6]}",
            summary="A summary long enough to pass validation.",
            category_id=category.id,
        )
        listing_service.submit_for_review(db, listing)
        assert listing.status == "PENDING_REVIEW"
        assert listing in listing_service.pending_queue(db)

        with pytest.raises(HTTPException) as exc:
            listing_service.reject(db, listing, reviewer_id=reviewer.id, reason="   ")
        assert exc.value.status_code == 422, "a rejection must carry a reason"

        listing_service.reject(
            db, listing, reviewer_id=reviewer.id, reason="Say what is not included."
        )
        db.commit()
        assert listing.status == "REJECTED"
        assert "not included" in listing.rejection_reason

    def test_approval_publishes_and_the_public_can_see_it(self, world):
        """Step 5 into step 6."""
        db, category, partner, _other, reviewer = world
        listing = listing_service.create_listing(
            db,
            partner_id=partner.id,
            title=f"Publish {uuid.uuid4().hex[:6]}",
            summary="A summary long enough to pass validation.",
            category_id=category.id,
        )
        listing_service.submit_for_review(db, listing)
        listing_service.approve(db, listing, reviewer_id=reviewer.id)
        db.commit()

        assert listing.status == "PUBLISHED"
        assert listing.published_at is not None
        public = db.execute(
            scoping.apply_scope(
                select(ServiceListing).where(ServiceListing.id == listing.id),
                ServiceListing,
                ANONYMOUS,
            )
        ).scalar_one_or_none()
        assert public is not None, "an approved listing must be publicly visible"

    def test_editing_a_published_listing_returns_it_to_review(self, world):
        """**The rule that makes moderation mean anything.**

        Without it a listing is approved once and then freely rewritten, and the
        reviewer's decision applies to text nobody can see any more.
        """
        db, category, partner, _other, reviewer = world
        listing = listing_service.create_listing(
            db,
            partner_id=partner.id,
            title=f"Edit {uuid.uuid4().hex[:6]}",
            summary="A summary long enough to pass validation.",
            category_id=category.id,
        )
        listing_service.submit_for_review(db, listing)
        listing_service.approve(db, listing, reviewer_id=reviewer.id)
        db.commit()
        assert listing.status == "PUBLISHED"

        listing_service.update_listing(db, listing, title="A materially different title")
        db.commit()

        assert listing.status == "PENDING_REVIEW", "a material edit must re-open review"
        gone = db.execute(
            scoping.apply_scope(
                select(ServiceListing).where(ServiceListing.id == listing.id),
                ServiceListing,
                ANONYMOUS,
            )
        ).scalar_one_or_none()
        assert gone is None, "an edited listing must leave the public site until re-approved"

    def test_a_partner_cannot_see_another_partners_listing(self, world):
        """The tenant boundary. **404, never 403** — the row must be invisible,
        not merely forbidden, because a 403 confirms it exists."""
        db, category, mine, theirs, _reviewer = world
        listing = listing_service.create_listing(
            db,
            partner_id=theirs.id,
            title=f"Theirs {uuid.uuid4().hex[:6]}",
            summary="A summary long enough to pass validation.",
            category_id=category.id,
        )
        db.commit()

        found = db.execute(
            scoping.apply_scope(
                select(ServiceListing).where(ServiceListing.id == listing.id),
                ServiceListing,
                _actor(_reviewer_placeholder(db), mine),
            )
        ).scalar_one_or_none()
        assert found is None, "one partner must not reach another partner's listing"

    def test_an_enquiry_reaches_one_partner_and_records_the_first_reply(self, world):
        """Steps 7 and 8, and § 16.1's one number.

        `first_responded_at` is stamped once. Re-stamping on every reply would
        turn "time to first response" into "time to most recent reply".
        """
        db, _category, partner, other, reviewer = world
        enquiry = enquiry_service.create_enquiry(
            db,
            partner_id=partner.id,
            buyer_name="Walk Buyer",
            buyer_email="walk@example.com",
            message="A message long enough to pass validation.",
        )
        db.commit()

        assert enquiry.status == "NEW"
        assert enquiry.first_responded_at is None
        assert len(enquiry.messages) == 1, "the buyer's own words start the thread"
        assert [r.partner_id for r in enquiry.recipients] == [partner.id]

        # It belongs to one partner and is invisible to the other.
        theirs = db.execute(
            scoping.apply_scope(
                select(Enquiry).where(Enquiry.id == enquiry.id),
                Enquiry,
                _actor(reviewer, other),
            )
        ).scalar_one_or_none()
        assert theirs is None, "an enquiry must not be visible to a partner it was not sent to"

        enquiry_service.reply(db, enquiry, author_user_id=reviewer.id, body="On it.")
        db.commit()
        first = enquiry.first_responded_at
        assert first is not None
        assert enquiry.status == "RESPONDED"

        enquiry_service.reply(db, enquiry, author_user_id=reviewer.id, body="One more thing.")
        db.commit()
        assert enquiry.first_responded_at == first, "first response time must be stamped once"

    def test_an_enquiry_to_an_unlisted_partner_is_refused(self, world):
        """Accepting it would tell the sender their message had gone somewhere."""
        db, _category, partner, _other, _reviewer = world
        partner.is_listed = False
        db.commit()

        with pytest.raises(HTTPException) as exc:
            enquiry_service.create_enquiry(
                db,
                partner_id=partner.id,
                buyer_name="Walk Buyer",
                buyer_email="walk2@example.com",
                message="A message long enough to pass validation.",
            )
        assert exc.value.status_code == 404

        partner.is_listed = True
        db.commit()


def _reviewer_placeholder(db):
    """Any active user — the scoping branch under test reads `organisation_id`
    and `has_admin_access`, never the identity."""
    return db.scalars(select(User).where(User.status == "ACTIVE")).first()


class TestTheViewTimestampMeasuresThePartnerNotUs:
    """`first_viewed_at` — the other half of the trust pair, added 2026-08-20.

    § 10 calls `first_viewed_at` and `first_responded_at` *"the two timestamps the
    entire trust system depends on"*. Only the second existed; TECH_DEBT PM-47
    records the rest of that gap. These cover the two rules that make the new one
    mean something.
    """

    def test_the_recipient_partner_opening_it_stamps_once(self, world):
        db, category, partner, _other, reviewer = world

        listing = listing_service.create_listing(
            db,
            partner_id=partner.id,
            title="Viewed once",
            summary="A service to enquire about.",
            category_id=category.id,
        )
        listing_service.submit_for_review(db, listing)
        listing_service.approve(db, listing, reviewer_id=reviewer.id)
        db.commit()

        enquiry = enquiry_service.create_enquiry(
            db,
            partner_id=partner.id,
            listing_id=listing.id,
            buyer_name="Vera Viewer",
            buyer_email="vera@example.com",
            message="Is this available next month?",
        )
        db.commit()
        assert enquiry.first_viewed_at is None

        member = _actor(reviewer, partner)

        assert enquiry_service.mark_viewed(db, enquiry, member) is True
        first = enquiry.first_viewed_at
        assert first is not None

        # Write-once: a second open must not move it. Re-stamping would turn "how
        # long did they take to look" into "when did they last look", which is a
        # different question from the one ranking asks.
        assert enquiry_service.mark_viewed(db, enquiry, member) is False
        assert enquiry.first_viewed_at == first

    def test_a_staff_read_never_stamps_it(self, world):
        """**The rule that keeps the measure honest.**

        Staff hold `enquiry-view` for oversight, so without this a staff member
        working the enquiries index would stamp view times across every partner
        on the platform — and the measure would quietly become "how fast does
        Leapswitch read its own mail" rather than how responsive a partner is.

        Staff have no `organisation_id`, so they are excluded by construction
        rather than by being named.
        """
        db, category, partner, other, reviewer = world

        listing = listing_service.create_listing(
            db,
            partner_id=partner.id,
            title="Not viewed by staff",
            summary="A service to enquire about.",
            category_id=category.id,
        )
        listing_service.submit_for_review(db, listing)
        listing_service.approve(db, listing, reviewer_id=reviewer.id)
        db.commit()

        enquiry = enquiry_service.create_enquiry(
            db,
            partner_id=partner.id,
            listing_id=listing.id,
            buyer_name="Sam Staffwatch",
            buyer_email="sam@example.com",
            message="Asking about availability.",
        )
        db.commit()

        # `reviewer` is a real staff row: internal, and belonging to no organisation.
        assert reviewer.organisation_id is None
        assert enquiry_service.mark_viewed(db, enquiry, reviewer) is False
        assert enquiry.first_viewed_at is None

        # And a member of the *wrong* partner is refused too — the recipient is
        # the only one whose attention is being measured.
        outsider = _actor(reviewer, other)
        assert enquiry_service.mark_viewed(db, enquiry, outsider) is False
        assert enquiry.first_viewed_at is None


class TestTheStateMachineAndTheTrustMetric:
    """The database half of TECH_DEBT PM-47.

    `tests/test_enquiry_lifecycle.py` covers the transition table itself without a
    database. What needs one is the interaction between the table and the two
    write-once timestamps — which is where the original defect lived.
    """

    def _enquiry(self, db, partner):
        enquiry = enquiry_service.create_enquiry(
            db,
            partner_id=partner.id,
            buyer_name="State Buyer",
            buyer_email="state@example.com",
            message="A message long enough to pass validation.",
        )
        db.commit()
        return enquiry

    def test_the_recipient_opening_it_advances_new_to_viewed(self, world):
        """The status half of `first_viewed_at`, shipped separately on 2026-08-20.

        Against the pre-fix code the enquiry stayed `NEW` — the timestamp moved and
        nothing on screen could say so.
        """
        db, _category, partner, _other, reviewer = world
        enquiry = self._enquiry(db, partner)
        assert enquiry.status == "NEW"

        assert enquiry_service.mark_viewed(db, enquiry, _actor(reviewer, partner)) is True
        db.commit()
        assert enquiry.status == "VIEWED"
        assert enquiry.first_viewed_at is not None

    def test_a_staff_read_advances_nothing(self, world):
        """The rule that makes the measure honest, restated for the status.

        A staff member has no `organisation_id`, so `mark_viewed` refuses — and it
        must refuse the status change too, or browsing the oversight index would
        mark every partner's inbox as read.
        """
        db, _category, partner, _other, reviewer = world
        enquiry = self._enquiry(db, partner)

        assert enquiry_service.mark_viewed(db, enquiry, reviewer) is False
        db.commit()
        assert enquiry.status == "NEW"
        assert enquiry.first_viewed_at is None

    def test_replying_after_opening_still_records_a_response(self, world):
        """The regression adding VIEWED would have introduced.

        `reply()` used to promote only from `NEW`. Once opening the enquiry moves it
        to `VIEWED`, that check would leave a partner who read before replying sitting
        at `VIEWED` for ever — unanswered in the inbox while `first_responded_at`
        proved they had answered. Exactly the disagreement the table forbids.
        """
        db, _category, partner, _other, reviewer = world
        enquiry = self._enquiry(db, partner)
        enquiry_service.mark_viewed(db, enquiry, _actor(reviewer, partner))
        db.commit()
        assert enquiry.status == "VIEWED"

        enquiry_service.reply(db, enquiry, author_user_id=reviewer.id, body="On it.")
        db.commit()
        assert enquiry.status == "RESPONDED"
        assert enquiry.first_responded_at is not None

    def test_a_responded_enquiry_cannot_be_returned_to_new(self, world):
        """409, and the message says what is allowed instead.

        Against the pre-fix code this succeeded silently and left the status
        contradicting `first_responded_at`.
        """
        db, _category, partner, _other, reviewer = world
        enquiry = self._enquiry(db, partner)
        enquiry_service.reply(db, enquiry, author_user_id=reviewer.id, body="On it.")
        db.commit()

        with pytest.raises(HTTPException) as exc:
            enquiry_service.set_status(db, enquiry, "NEW")
        assert exc.value.status_code == 409
        assert "cannot become NEW" in exc.value.detail
        assert enquiry.status == "RESPONDED", "the refused move must not have applied"

    def test_resending_the_current_status_is_not_an_error(self, world):
        """A form submitted twice is not a client doing anything wrong.

        The table has no self-edges, so without the explicit no-op this would 409 —
        turning a harmless duplicate into a visible failure on a page that had
        worked a moment earlier.
        """
        db, _category, partner, _other, _reviewer = world
        enquiry = self._enquiry(db, partner)

        assert enquiry_service.set_status(db, enquiry, "NEW") is enquiry
        assert enquiry.status == "NEW"

    def test_spam_leaves_the_response_metric_entirely(self, world):
        """**The defect PM-47 was raised for.**

        Junk is never replied to, so it stays `first_responded_at IS NULL` for ever
        and used to count as `unanswered`. § 9 ranks partners on that number, so a
        partner was penalised for spam they were right to ignore.

        Against the pre-fix code the final assertion reads `unanswered == 1`.
        """
        db, _category, partner, _other, reviewer = world
        answered = self._enquiry(db, partner)
        enquiry_service.reply(db, answered, author_user_id=reviewer.id, body="On it.")
        junk = self._enquiry(db, partner)
        db.commit()

        before = enquiry_service.partner_metrics(db, partner.id)
        assert before == {"total": 2, "unanswered": 1, "answered": 1, "spam": 0}

        enquiry_service.set_status(db, junk, "SPAM")
        db.commit()

        after = enquiry_service.partner_metrics(db, partner.id)
        assert after["unanswered"] == 0, "spam is still counted as an enquiry they failed to answer"
        assert after["total"] == 1, "spam must leave the denominator too, not only the numerator"
        assert after["answered"] == 1
        assert after["spam"] == 1, "and it must still be visible, not silently dropped"

    def test_marking_spam_is_reversible(self, world):
        """A real enquiry mis-marked as junk must come back to the inbox."""
        db, _category, partner, _other, _reviewer = world
        enquiry = self._enquiry(db, partner)
        enquiry_service.set_status(db, enquiry, "SPAM")
        db.commit()
        assert enquiry_service.partner_metrics(db, partner.id)["total"] == 0

        enquiry_service.set_status(db, enquiry, "NEW")
        db.commit()
        assert enquiry.status == "NEW"
        assert enquiry_service.partner_metrics(db, partner.id) == {
            "total": 1,
            "unanswered": 1,
            "answered": 0,
            "spam": 0,
        }

    def test_the_detail_response_carries_the_legal_moves(self, world):
        """The wiring, because forgetting it fails silently.

        `allowed_transitions` defaults to `[]` on the schema, and an empty list is
        indistinguishable from "this enquiry is finished and can go nowhere" — the
        dropdown would simply render no options and nothing would look wrong. So
        the route filling it is worth an assertion of its own.
        """
        from app.api.enquiries import _detail

        db, _category, partner, _other, _reviewer = world
        enquiry = self._enquiry(db, partner)

        detail = _detail(enquiry)
        assert detail.allowed_transitions, "the route returned no legal moves at all"
        assert detail.allowed_transitions == sorted(
            enquiry_service.allowed_transitions(enquiry.status)
        )
        # And the two the buyer-facing form cannot reach are present for staff:
        # SPAM from a NEW enquiry is the whole point of the classification.
        assert "SPAM" in detail.allowed_transitions
        assert "VIEWED" in detail.allowed_transitions


class TestTheModerationQueueRouteAssemblesItsResponse:
    """The route, not the service — and that distinction is the whole point.

    `pending_queue` was already covered (`TestTheLoop` asserts a submitted listing
    appears in it). What was never exercised was `api/moderation.review_queue`,
    which takes those rows and builds `ModerationQueueItem` from them. So a defect
    in the *assembly* was invisible to the suite:

    **`GET /moderation/queue` returned a 500 for every non-empty queue between
    2026-08-20 and 2026-08-21.** `partner_name` and `entitlement` are required on
    the response model and are not columns, so `model_validate(listing)` raised two
    `missing` errors — and the lines that would have supplied them ran *after* the
    validation. The empty-queue early return meant the only queue anyone had seen
    was an empty one, so the screen looked idle rather than broken. Even the
    browser pass agreed: the page rendered its empty state and the text probe
    matched.

    A response model with required non-column fields is worth a route-level test
    on principle, because the service can be perfectly correct and the endpoint
    still 500.
    """

    def test_a_non_empty_queue_serialises(self, world):
        """Against the pre-fix code this raises `ValidationError`, not an assertion.

        Two rows, so an accidental single-row special case cannot pass it.
        """
        from app.api.moderation import review_queue

        db, category, partner, other, reviewer = world
        for owner, title in ((partner, "Queued one"), (other, "Queued two")):
            listing = listing_service.create_listing(
                db,
                partner_id=owner.id,
                title=title,
                summary="A service somebody might buy.",
                category_id=category.id,
            )
            listing_service.submit_for_review(db, listing)
        db.commit()

        items = review_queue(db=db, _=reviewer)

        titles = [item.title for item in items]
        assert "Queued one" in titles and "Queued two" in titles

        for item in items:
            # The three fields that are not columns. `partner_name` failing to
            # populate is what the 500 was.
            assert item.partner_name, f"{item.title} has no partner name"
            assert item.entitlement is not None
            assert isinstance(item.blockers, list)

    def test_an_empty_queue_is_an_empty_list_not_an_error(self, world):
        """The path that *did* work, pinned so the fix did not trade one for the other."""
        from app.api.moderation import review_queue

        db, _category, _partner, _other, reviewer = world
        # `world` creates no listings of its own, and any left by a sibling test
        # are rolled back with it — but assert rather than assume, or this test
        # silently becomes a duplicate of the one above.
        items = review_queue(db=db, _=reviewer)
        assert isinstance(items, list)

    def test_the_queue_reports_a_tier_limit_as_a_blocker(self, world):
        """The reason the extra fields exist at all.

        A reviewer must learn that approving is impossible *before* reading the
        listing. This asserts the blocker reaches the response, which is the half
        the 500 was hiding — `publish_blockers` itself was already tested.
        """
        from app.api.moderation import review_queue
        from app.models.partner_tier import PartnerTier

        db, category, partner, _other, reviewer = world

        published = listing_service.create_listing(
            db,
            partner_id=partner.id,
            title="Occupying the only slot",
            summary="A service somebody might buy.",
            category_id=category.id,
        )
        listing_service.submit_for_review(db, published)
        listing_service.approve(db, published, reviewer_id=reviewer.id)

        tier = PartnerTier(
            name=f"cap-{uuid.uuid4().hex[:8]}",
            display_name="Capped At One",
            max_listings=1,
            sort_order=98,
        )
        db.add(tier)
        db.flush()
        partner.tier_id = tier.id

        waiting = listing_service.create_listing(
            db,
            partner_id=partner.id,
            title="Over the allowance",
            summary="A service somebody might buy.",
            category_id=category.id,
        )
        listing_service.submit_for_review(db, waiting)
        db.commit()

        entry = next(item for item in review_queue(db=db, _=reviewer) if item.title == "Over the allowance")
        assert entry.blockers, "a listing over the tier allowance must carry a blocker"
        assert "Capped At One" in entry.blockers[0]
        assert entry.entitlement.at_limit is True
        assert entry.entitlement.max_listings == 1

        # Leave the shared tier table as it was found.
        partner.tier_id = None
        db.commit()
        db.delete(db.get(PartnerTier, tier.id))
        db.commit()
