"""`service_categories.listing_count` must match what the public site shows.

The count is rendered on the public home page and the services index, so a wrong
one is a visible lie — "12 services" above a list of eleven. It is *recomputed*
rather than incremented, which is the right design and rules out the usual
drifting-counter bug; both defects found on 2026-08-20 were instead **paths that
never recomputed at all**.

Each test here fails against the code as it was before that date. That matters:
a regression test that passes either way documents an intention rather than
protecting a fix.
"""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy import delete, select

from app.models.partner import Partner
from app.models.service_category import ServiceCategory
from app.models.service_listing import ServiceListing
from app.models.user import User
from app.services import category_service, listing_service

pytestmark = pytest.mark.db


@pytest.fixture
def world():
    """Two categories — the bug only appears when a listing can move between them."""
    from app.db.session import SessionLocal

    db = SessionLocal()
    reviewer = db.scalars(select(User).where(User.status == "ACTIVE")).first()
    if reviewer is None:
        db.close()
        pytest.skip("needs one active user to act as the reviewer")

    tag = uuid.uuid4().hex[:8]
    first = ServiceCategory(name=f"Count A {tag}", slug=f"count-a-{tag}", sort_order=97)
    second = ServiceCategory(name=f"Count B {tag}", slug=f"count-b-{tag}", sort_order=96)
    db.add_all([first, second])

    partner = Partner(
        id=str(uuid.uuid4()),
        name=f"Count Partner {tag}",
        slug=f"count-partner-{tag}",
        status="ACTIVE",
        verification_level="VERIFIED",
        is_listed=True,
    )
    db.add(partner)
    db.commit()

    yield db, first, second, partner, reviewer

    db.execute(delete(ServiceListing).where(ServiceListing.partner_id == partner.id))
    db.delete(partner)
    db.commit()
    for category in (first, second):
        row = db.get(ServiceCategory, category.id)
        if row:
            db.delete(row)
    db.commit()
    db.close()


def _published(db, category, partner, reviewer, title: str) -> ServiceListing:
    listing = listing_service.create_listing(
        db,
        partner_id=partner.id,
        title=title,
        summary="A service somebody might buy.",
        category_id=category.id,
    )
    listing_service.submit_for_review(db, listing)
    listing_service.approve(db, listing, reviewer_id=reviewer.id)
    db.commit()
    return listing


def _count(db, category) -> int:
    db.refresh(category)
    return category.listing_count


def _actual_published(db, category) -> int:
    """The truth, counted directly — what the stored number should equal."""
    return len(
        db.scalars(
            select(ServiceListing).where(
                ServiceListing.category_id == category.id,
                ServiceListing.status == "PUBLISHED",
                ServiceListing.deleted_at.is_(None),
            )
        ).all()
    )


class TestPublishingAndUnpublishing:
    def test_approving_and_archiving_keep_the_count_true(self, world):
        """The paths that already worked. First, so a blanket break is obvious."""
        db, first, _second, partner, reviewer = world
        assert _count(db, first) == 0

        listing = _published(db, first, partner, reviewer, "Counted")
        assert _count(db, first) == 1

        listing_service.soft_delete(db, listing)
        db.commit()
        assert _count(db, first) == 0


class TestTheTwoPathsThatNeverRecomputed:
    def test_moving_a_published_listing_between_categories(self, world):
        """**Bug one.** The old category kept counting it for ever.

        `category_id` is a material field, so editing it sends the listing back to
        review — and the recount that follows read `listing.category_id`, which the
        update loop had already changed to the *destination*. So the destination
        was recomputed correctly (excluding the now-unpublished listing) and the
        origin was never touched.

        Against the pre-fix code the first assertion below reads 1.
        """
        db, first, second, partner, reviewer = world
        _published(db, first, partner, reviewer, "About to move")
        assert _count(db, first) == 1

        listing = db.scalars(
            select(ServiceListing).where(ServiceListing.partner_id == partner.id)
        ).first()
        listing_service.update_listing(db, listing, category_id=second.id)
        db.commit()

        # It left the public site (back to review), so neither category counts it.
        assert listing.status == "PENDING_REVIEW"
        assert _count(db, first) == 0, "the category it left is still counting it"
        assert _count(db, second) == 0

        # And both stored numbers agree with a direct count.
        assert _count(db, first) == _actual_published(db, first)
        assert _count(db, second) == _actual_published(db, second)

    def test_submitting_an_already_published_listing(self, world):
        """**Bug two.** `PUBLISHED → PENDING_REVIEW` via submit never recomputed.

        It is a legal transition and `POST /listings/{id}/submit` reaches it, so a
        partner re-submitting a live listing took it off the public site while the
        category went on advertising it. The rule existed in `update_listing` and
        had simply not been written here.

        Against the pre-fix code the assertion below reads 1.
        """
        db, first, _second, partner, reviewer = world
        listing = _published(db, first, partner, reviewer, "Re-submitted")
        assert _count(db, first) == 1

        listing_service.submit_for_review(db, listing)
        db.commit()

        assert listing.status == "PENDING_REVIEW"
        assert _count(db, first) == 0, "a re-submitted listing is still being counted"
        assert _count(db, first) == _actual_published(db, first)

    def test_a_non_material_edit_changes_no_count(self, world):
        """The other direction: the fix must not recompute when nothing moved.

        A published listing edited in a way that does not touch a material field
        stays published, so the count must not change — and must certainly not
        drop, which is what a recount fired unconditionally outside the
        `changed_material` branch would have done.
        """
        db, first, _second, partner, reviewer = world
        listing = _published(db, first, partner, reviewer, "Untouched")
        assert _count(db, first) == 1

        # Re-writing the same values is the case `update_listing`'s comparison
        # exists for — a form that submits every field unchanged.
        listing_service.update_listing(db, listing, title="Untouched")
        db.commit()

        assert listing.status == "PUBLISHED"
        assert _count(db, first) == 1
        assert _count(db, first) == _actual_published(db, first)


class TestTheRecountIsAuthoritative:
    def test_it_repairs_a_deliberately_corrupted_count(self, world):
        """Recomputed, not incremented — so it heals rather than compounding.

        This is the property that makes the two fixes above sufficient. Any path
        that *does* call the recount lands on the truth regardless of what the
        stored number was, so a historical drift is repaired the next time
        anything touches that category rather than persisting for ever.
        """
        db, first, _second, partner, reviewer = world
        _published(db, first, partner, reviewer, "Real")

        first.listing_count = 99
        db.commit()
        assert _count(db, first) == 99

        assert category_service.recount_listings(db, first.id) == 1
        db.commit()
        assert _count(db, first) == 1
