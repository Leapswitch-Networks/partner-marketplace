"""Tier entitlement at the publish gate — `PARTNER_DIRECTORY_PLAN.md` § 14.1 row 2b.

`partner_tiers.max_listings` was a column nothing checked. The plan says so in
three separate places and calls a tier "currently a label"; § 19.9 states the rule
it should have had all along:

    Publishing checks the tier: count of PUBLISHED listings must stay
    < tier.max_listings (NULL = unlimited).

Enforced in `listing_service.approve` as of 2026-08-20. These tests exist because
an entitlement rule is the kind of thing that is easy to write and easy to get
subtly wrong in a way that only shows up commercially — either a paid limit that
does nothing, or a limit that traps a partner who is merely fixing a typo.

**The most important test here is `test_a_partner_with_no_tier_is_unlimited`.**
Every partner in this database has `tier_id` NULL (measured 2026-08-20), so the
opposite reading of "no tier" would have refused every publication in the system
the moment the guard landed.
"""

from __future__ import annotations

import uuid

import pytest
from fastapi import HTTPException
from sqlalchemy import delete, select

from app.models.partner import Partner
from app.models.partner_tier import PartnerTier
from app.models.service_category import ServiceCategory
from app.models.service_listing import ServiceListing
from app.models.user import User
from app.services import listing_service

pytestmark = pytest.mark.db


@pytest.fixture
def world():
    """A partner, a category, a reviewer, and three tiers of differing generosity."""
    from app.db.session import SessionLocal

    db = SessionLocal()
    reviewer = db.scalars(select(User).where(User.status == "ACTIVE")).first()
    if reviewer is None:
        db.close()
        pytest.skip("needs one active user to act as the reviewer")

    tag = uuid.uuid4().hex[:8]
    category = ServiceCategory(name=f"Ent {tag}", slug=f"ent-{tag}", sort_order=98)
    db.add(category)

    tiers = {
        "one": PartnerTier(name=f"ent-one-{tag}", display_name="One", max_listings=1),
        "two": PartnerTier(name=f"ent-two-{tag}", display_name="Two", max_listings=2),
        # NULL is the documented spelling of unlimited — never a -1 sentinel.
        "open": PartnerTier(name=f"ent-open-{tag}", display_name="Open", max_listings=None),
    }
    for tier in tiers.values():
        db.add(tier)
    db.flush()

    partner = Partner(
        id=str(uuid.uuid4()),
        name=f"Ent Partner {tag}",
        slug=f"ent-partner-{tag}",
        status="ACTIVE",
        verification_level="VERIFIED",
        is_listed=True,
    )
    db.add(partner)
    db.commit()

    yield db, category, partner, reviewer, tiers

    # Bulk delete rather than per-object: several of these rows are soft-deleted
    # or were committed mid-test, and ORM deletion asserts a row count it cannot
    # always match — eleven SAWarnings per run, which is exactly the noise that
    # hides a real one.
    db.execute(delete(ServiceListing).where(ServiceListing.partner_id == partner.id))
    db.delete(partner)
    db.commit()
    for tier in tiers.values():
        row = db.get(PartnerTier, tier.id)
        if row:
            db.delete(row)
    db.delete(db.get(ServiceCategory, category.id))
    db.commit()
    db.close()


def _publish(db, category, partner, reviewer, title: str) -> ServiceListing:
    """Take a listing all the way to PUBLISHED, the way the product does."""
    listing = listing_service.create_listing(
        db,
        partner_id=partner.id,
        title=title,
        summary="A service.",
        category_id=category.id,
    )
    listing_service.submit_for_review(db, listing)
    listing_service.approve(db, listing, reviewer_id=reviewer.id)
    db.commit()
    return listing


def _submit(db, category, partner, title: str) -> ServiceListing:
    """A listing sitting in PENDING_REVIEW, awaiting a decision."""
    listing = listing_service.create_listing(
        db,
        partner_id=partner.id,
        title=title,
        summary="A service.",
        category_id=category.id,
    )
    listing_service.submit_for_review(db, listing)
    db.commit()
    return listing


class TestTheAllowance:
    def test_a_partner_with_no_tier_is_unlimited(self, world):
        """**The compatibility case, and the reason this reading was chosen.**

        Every partner in this database has `tier_id` NULL. Reading "no tier" as
        "no entitlement" would have made this guard an outage rather than a
        feature — so a tier's *absence* means nobody has sold this partner a
        limit, not that their limit is zero.
        """
        db, category, partner, reviewer, _ = world
        assert partner.tier_id is None

        for n in range(3):
            _publish(db, category, partner, reviewer, f"No tier {n}")

        assert listing_service.published_count(db, partner.id) == 3
        assert listing_service.entitlement(db, partner)["unlimited"] is True

    def test_publishing_stops_at_the_tier_limit(self, world):
        db, category, partner, reviewer, tiers = world
        partner.tier_id = tiers["one"].id
        db.commit()

        _publish(db, category, partner, reviewer, "First")
        second = _submit(db, category, partner, "Second")

        with pytest.raises(HTTPException) as excinfo:
            listing_service.approve(db, second, reviewer_id=reviewer.id)

        assert excinfo.value.status_code == 409
        # The message has to name the tier and both numbers: the reviewer is not
        # the person who chose the plan, and "not allowed" tells them nothing
        # they can act on.
        detail = excinfo.value.detail
        assert "One" in detail
        assert "1 of 1" in detail

        # And the refusal must leave the listing where the reviewer found it.
        db.refresh(second)
        assert second.status == "PENDING_REVIEW"

    def test_a_refusal_does_not_publish_anything(self, world):
        """The status code and the database are separate claims."""
        db, category, partner, reviewer, tiers = world
        partner.tier_id = tiers["one"].id
        db.commit()

        _publish(db, category, partner, reviewer, "Only")
        blocked = _submit(db, category, partner, "Blocked")
        with pytest.raises(HTTPException):
            listing_service.approve(db, blocked, reviewer_id=reviewer.id)
        db.rollback()

        assert listing_service.published_count(db, partner.id) == 1
        db.refresh(blocked)
        assert blocked.published_at is None

    def test_publishing_up_to_the_limit_is_allowed(self, world):
        """A limit of two must permit two, not one.

        The off-by-one is the whole risk in a `<` versus `<=` rule, and it fails
        in the direction nobody notices: a "2 listings" plan that silently
        allows 1 looks like a bug in the second listing.
        """
        db, category, partner, reviewer, tiers = world
        partner.tier_id = tiers["two"].id
        db.commit()

        _publish(db, category, partner, reviewer, "One of two")
        _publish(db, category, partner, reviewer, "Two of two")

        assert listing_service.published_count(db, partner.id) == 2
        ent = listing_service.entitlement(db, partner)
        assert ent["remaining"] == 0
        assert ent["at_limit"] is True

    def test_a_tier_with_a_null_allowance_is_unlimited(self, world):
        db, category, partner, reviewer, tiers = world
        partner.tier_id = tiers["open"].id
        db.commit()

        for n in range(3):
            _publish(db, category, partner, reviewer, f"Open {n}")

        ent = listing_service.entitlement(db, partner)
        assert ent["unlimited"] is True
        assert ent["remaining"] is None
        assert ent["at_limit"] is False


class TestTheCasesThatWouldTrapAPartner:
    def test_a_partner_at_their_limit_can_still_fix_a_typo(self, world):
        """**The trap this rule most easily sets.**

        § 19.9 sends every edit of a published listing back through review. If the
        allowance check treated that re-approval as a new publication, a partner
        who had used their last slot could never correct a word in it again —
        their own listing would be blocked by their own listing.

        It works because editing moves the listing out of PUBLISHED, so it stops
        counting toward its own allowance while it sits in review. No special
        case; the count does the work.
        """
        db, category, partner, reviewer, tiers = world
        partner.tier_id = tiers["one"].id
        db.commit()

        listing = _publish(db, category, partner, reviewer, "Original title")
        listing_service.update_listing(db, listing, title="Corrected title")
        db.commit()
        assert listing.status == "PENDING_REVIEW"

        listing_service.approve(db, listing, reviewer_id=reviewer.id)
        db.commit()

        assert listing.status == "PUBLISHED"
        assert listing.title == "Corrected title"
        assert listing_service.published_count(db, partner.id) == 1

    def test_a_downgrade_keeps_what_is_live_and_refuses_what_is_new(self, world):
        """Moving a partner to a smaller tier must not unpublish anything.

        Retroactively hiding paid-for listings because a plan changed would be a
        far worse failure than allowing an over-limit partner to sit tight. So the
        rule is forward-looking: what is live stays live, and nothing new goes up
        until they are back under the allowance.
        """
        db, category, partner, reviewer, tiers = world
        partner.tier_id = tiers["two"].id
        db.commit()

        _publish(db, category, partner, reviewer, "Kept one")
        _publish(db, category, partner, reviewer, "Kept two")

        partner.tier_id = tiers["one"].id
        db.commit()

        ent = listing_service.entitlement(db, partner)
        assert ent["published"] == 2
        assert ent["max_listings"] == 1
        assert ent["at_limit"] is True
        # Over the limit, not merely at it — `remaining` must not go negative.
        assert ent["remaining"] == 0

        assert listing_service.published_count(db, partner.id) == 2

        blocked = _submit(db, category, partner, "Not allowed")
        with pytest.raises(HTTPException):
            listing_service.approve(db, blocked, reviewer_id=reviewer.id)

    def test_archiving_frees_a_slot(self, world):
        """A partner who tidies up must be able to replace what they removed."""
        db, category, partner, reviewer, tiers = world
        partner.tier_id = tiers["one"].id
        db.commit()

        first = _publish(db, category, partner, reviewer, "To be removed")
        assert listing_service.entitlement(db, partner)["at_limit"] is True

        listing_service.soft_delete(db, first)
        db.commit()

        assert listing_service.published_count(db, partner.id) == 0
        assert listing_service.entitlement(db, partner)["at_limit"] is False

        _publish(db, category, partner, reviewer, "The replacement")
        assert listing_service.published_count(db, partner.id) == 1


class TestThePartnerMustBePublishable:
    def test_a_suspended_partner_cannot_publish(self, world):
        """Defence in depth, not a plugged leak.

        Every public read already joins partner visibility, so a suspended
        partner's listings are invisible regardless. What this prevents is a
        PUBLISHED row that is a lie: `published_at` stamped, the listing claiming
        to be live, and nothing on screen explaining why it is not.
        """
        db, category, partner, reviewer, _ = world
        pending = _submit(db, category, partner, "While suspended")

        partner.status = "SUSPENDED"
        db.commit()

        with pytest.raises(HTTPException) as excinfo:
            listing_service.approve(db, pending, reviewer_id=reviewer.id)
        assert excinfo.value.status_code == 409
        assert "suspended" in excinfo.value.detail.lower()

    def test_an_unlisted_partner_cannot_publish(self, world):
        db, category, partner, reviewer, _ = world
        pending = _submit(db, category, partner, "While unlisted")

        partner.is_listed = False
        db.commit()

        with pytest.raises(HTTPException) as excinfo:
            listing_service.approve(db, pending, reviewer_id=reviewer.id)
        assert excinfo.value.status_code == 409
        assert "not listed" in excinfo.value.detail.lower()

    def test_every_blocker_is_reported_at_once(self, world):
        """Not first-failure.

        Being told "the partner is suspended", fixing that, and only then being
        told "and they are at their limit" is two round trips for one decision —
        and the second one arrives after the reviewer thought they were done.
        """
        db, category, partner, reviewer, tiers = world
        partner.tier_id = tiers["one"].id
        db.commit()
        _publish(db, category, partner, reviewer, "The only slot")

        pending = _submit(db, category, partner, "Doomed twice over")
        partner.status = "SUSPENDED"
        partner.is_listed = False
        db.commit()

        blockers = listing_service.publish_blockers(db, pending)
        assert len(blockers) == 3, blockers
        joined = " ".join(blockers).lower()
        assert "suspended" in joined
        assert "not listed" in joined
        assert "published listings allowed" in joined


class TestTheBatchedCountTheQueueUses:
    """`published_counts` exists so the moderation queue is not an N+1.

    The risk in a batched count is not the query — it is a caller passing the
    wrong partner's number into `entitlement(published=...)`, which would report
    one partner's usage against another's allowance. That is invisible in a
    single-partner test, so both tests here use two.
    """

    def test_counts_are_grouped_per_partner(self, world):
        db, category, partner, reviewer, tiers = world

        other = Partner(
            id=str(uuid.uuid4()),
            name="Ent Other",
            slug=f"ent-other-{uuid.uuid4().hex[:8]}",
            status="ACTIVE",
            verification_level="VERIFIED",
            is_listed=True,
        )
        db.add(other)
        db.commit()
        try:
            _publish(db, category, partner, reviewer, "Mine one")
            _publish(db, category, partner, reviewer, "Mine two")
            _publish(db, category, other, reviewer, "Theirs one")

            counts = listing_service.published_counts(db, [partner.id, other.id])
            assert counts[partner.id] == 2
            assert counts[other.id] == 1

            # A partner with nothing published is absent from the grouped result
            # rather than present as 0 — callers must use `.get(id, 0)`, and the
            # queue endpoint does.
            third = str(uuid.uuid4())
            assert third not in listing_service.published_counts(db, [third])

            # And the batched result must agree with the single-row path, which
            # is what makes one a safe substitute for the other.
            assert listing_service.published_count(db, partner.id) == counts[partner.id]
        finally:
            db.execute(delete(ServiceListing).where(ServiceListing.partner_id == other.id))
            db.delete(other)
            db.commit()

    def test_an_empty_id_list_does_not_query(self, world):
        """The guard that stops `IN ()` — invalid SQL in some backends, and a
        full-table scan in others."""
        db, _category, _partner, _reviewer, _tiers = world
        assert listing_service.published_counts(db, []) == {}

    def test_a_passed_count_is_what_the_allowance_is_measured_against(self, world):
        """`entitlement(published=...)` must trust the caller's number.

        This is the seam the queue relies on. If it silently re-counted, the
        batching would be pointless; if it used the passed value for one field
        and a fresh count for another, the row would contradict itself.
        """
        db, category, partner, reviewer, tiers = world
        partner.tier_id = tiers["two"].id
        db.commit()
        _publish(db, category, partner, reviewer, "Actually one")

        # Truthful count: one of two used.
        ent = listing_service.entitlement(db, partner, published=1)
        assert (ent["published"], ent["remaining"], ent["at_limit"]) == (1, 1, False)

        # A caller claiming two used must be believed — same row, same tier.
        ent = listing_service.entitlement(db, partner, published=2)
        assert (ent["published"], ent["remaining"], ent["at_limit"]) == (2, 0, True)

        # And the blocker text must be built from the passed count too, not a
        # second look at the database.
        pending = _submit(db, category, partner, "Judged against the passed count")
        assert listing_service.publish_blockers(db, pending, published=0) == []
        blocked = listing_service.publish_blockers(db, pending, published=2)
        assert len(blocked) == 1
        assert "2 of 2" in blocked[0]
