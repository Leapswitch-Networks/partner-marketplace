"""The CRUD matrix — every entity, every operation.

`DIRECTORY_BUILD_PUNCHLIST.md` § 6.4 asks for this to be executed by hand and
recorded pass/fail. It is a test for the same reason § 6.3 is: a matrix walked
once records that the code worked that afternoon.

**This is deliberately boring.** It asserts that create, read, update and delete
do what their names say, plus the refusals that protect each one. The
interesting rules — the state machine, the tenant boundary, response timing —
live in `test_directory_lifecycle.py`; this is the floor beneath them.

Every row cleans up after itself.
"""

from __future__ import annotations

import uuid

import pytest
from fastapi import HTTPException
from sqlalchemy import select

from app.models.enquiry import Enquiry
from app.models.partner import Partner
from app.models.service_category import ServiceCategory
from app.models.service_listing import ServiceListing
from app.models.user import User
from app.services import category_service, enquiry_service, listing_service


@pytest.fixture
def env():
    from app.db.session import SessionLocal

    db = SessionLocal()
    actor = db.scalars(select(User).where(User.status == "ACTIVE")).first()
    if actor is None:
        db.close()
        pytest.skip("needs one active user")

    tag = uuid.uuid4().hex[:8]
    partner = Partner(
        id=str(uuid.uuid4()),
        name=f"CRUD Partner {tag}",
        slug=f"crud-partner-{tag}",
        status="ACTIVE",
        verification_level="VERIFIED",
        is_listed=True,
    )
    db.add(partner)
    db.commit()

    created_categories: list[int] = []
    yield db, partner, actor, tag, created_categories

    for listing in db.scalars(
        select(ServiceListing).where(ServiceListing.partner_id == partner.id)
    ).all():
        db.delete(listing)
    for enquiry in db.scalars(select(Enquiry).where(Enquiry.partner_id == partner.id)).all():
        db.delete(enquiry)
    db.flush()
    for category_id in created_categories:
        category = db.get(ServiceCategory, category_id)
        if category is not None:
            db.delete(category)
    db.delete(partner)
    db.commit()
    db.close()


class TestCategories:
    def test_create_read_update_delete(self, env):
        db, _partner, _actor, tag, created = env

        category = category_service.create_category(db, name=f"CRUD Cat {tag}")
        created.append(category.id)
        db.commit()
        assert category.slug.startswith("crud-cat")

        assert category_service.get_or_404(db, category.id).id == category.id
        assert category_service.get_by_slug(db, category.slug) is not None

        category_service.update_category(db, category, name=f"CRUD Cat {tag} renamed")
        db.commit()
        assert "renamed" in category.name
        # The slug is deliberately NOT updatable — it is a published URL.
        assert category.slug.startswith("crud-cat")

        category_service.delete_category(db, category)
        db.commit()
        created.remove(category.id)
        assert db.get(ServiceCategory, category.id) is None

    def test_a_third_level_is_refused(self, env):
        """§ 19.12 — a 409, not a silent flattening."""
        db, _partner, _actor, tag, created = env
        parent = category_service.create_category(db, name=f"P {tag}")
        created.append(parent.id)
        child = category_service.create_category(db, name=f"C {tag}", parent_id=parent.id)
        created.append(child.id)
        db.commit()

        with pytest.raises(HTTPException) as exc:
            category_service.create_category(db, name=f"GC {tag}", parent_id=child.id)
        assert exc.value.status_code == 409

    def test_deleting_a_category_with_listings_is_refused(self, env):
        """The FK is RESTRICT; this turns it into a sentence rather than a 500."""
        db, partner, _actor, tag, created = env
        category = category_service.create_category(db, name=f"Busy {tag}")
        created.append(category.id)
        listing_service.create_listing(
            db,
            partner_id=partner.id,
            title=f"Blocker {tag}",
            summary="A summary long enough to pass validation.",
            category_id=category.id,
        )
        db.commit()

        with pytest.raises(HTTPException) as exc:
            category_service.delete_category(db, category)
        assert exc.value.status_code == 409
        assert "listings" in exc.value.detail

    def test_deleting_a_parent_with_children_is_refused(self, env):
        db, _partner, _actor, tag, created = env
        parent = category_service.create_category(db, name=f"Par {tag}")
        created.append(parent.id)
        child = category_service.create_category(db, name=f"Chi {tag}", parent_id=parent.id)
        created.append(child.id)
        db.commit()

        with pytest.raises(HTTPException) as exc:
            category_service.delete_category(db, parent)
        assert exc.value.status_code == 409


class TestListings:
    def test_create_read_update_delete(self, env):
        db, partner, _actor, tag, created = env
        category = category_service.create_category(db, name=f"L {tag}")
        created.append(category.id)
        db.commit()

        listing = listing_service.create_listing(
            db,
            partner_id=partner.id,
            title=f"CRUD Listing {tag}",
            summary="A summary long enough to pass validation.",
            category_id=category.id,
        )
        db.commit()
        assert listing.status == "DRAFT"

        assert listing_service.get_or_404(db, listing.id).id == listing.id

        listing_service.update_listing(db, listing, summary="An updated summary, still long enough.")
        db.commit()
        assert listing.summary.startswith("An updated")

        listing_service.soft_delete(db, listing)
        db.commit()
        # Soft delete: the row survives, the getter refuses it.
        assert db.get(ServiceListing, listing.id) is not None
        with pytest.raises(HTTPException) as exc:
            listing_service.get_or_404(db, listing.id)
        assert exc.value.status_code == 404

    def test_a_priced_model_without_a_price_is_refused(self, env):
        """§ 20.2 rule 9 — never render a price we do not have."""
        db, partner, _actor, tag, created = env
        category = category_service.create_category(db, name=f"P {tag}")
        created.append(category.id)
        db.commit()

        with pytest.raises(HTTPException) as exc:
            listing_service.create_listing(
                db,
                partner_id=partner.id,
                title=f"Priced {tag}",
                summary="A summary long enough to pass validation.",
                category_id=category.id,
                pricing_model="FIXED",
                price=None,
            )
        assert exc.value.status_code == 422

    def test_an_impossible_transition_is_refused(self, env):
        """A DRAFT cannot jump straight to PUBLISHED."""
        db, partner, actor, tag, created = env
        category = category_service.create_category(db, name=f"T {tag}")
        created.append(category.id)
        listing = listing_service.create_listing(
            db,
            partner_id=partner.id,
            title=f"Jump {tag}",
            summary="A summary long enough to pass validation.",
            category_id=category.id,
        )
        db.commit()

        with pytest.raises(HTTPException) as exc:
            listing_service.approve(db, listing, reviewer_id=actor.id)
        assert exc.value.status_code == 409

    def test_publishing_maintains_the_category_count(self, env):
        """The count drives § 8's threshold, so it must follow the state."""
        db, partner, actor, tag, created = env
        category = category_service.create_category(db, name=f"Cnt {tag}")
        created.append(category.id)
        listing = listing_service.create_listing(
            db,
            partner_id=partner.id,
            title=f"Counted {tag}",
            summary="A summary long enough to pass validation.",
            category_id=category.id,
        )
        db.commit()
        assert category.listing_count == 0

        listing_service.submit_for_review(db, listing)
        listing_service.approve(db, listing, reviewer_id=actor.id)
        db.commit()
        assert category.listing_count == 1

        listing_service.unpublish(db, listing)
        db.commit()
        assert category.listing_count == 0, "unpublishing must decrement the count"


class TestEnquiries:
    def test_create_read_reply_and_status(self, env):
        db, partner, actor, tag, _created = env

        enquiry = enquiry_service.create_enquiry(
            db,
            partner_id=partner.id,
            buyer_name=f"Buyer {tag}",
            buyer_email=f"buyer-{tag}@example.com",
            message="A message long enough to pass validation.",
        )
        db.commit()

        assert enquiry_service.get_or_404(db, enquiry.id).id == enquiry.id
        assert enquiry_service.get_by_reference(db, enquiry.reference) is not None
        assert enquiry_service.get_by_reference(db, "ENQ-nonexistent") is None

        enquiry_service.reply(db, enquiry, author_user_id=actor.id, body="Answering.")
        db.commit()
        assert len(enquiry.messages) == 2

        enquiry_service.set_status(db, enquiry, "WON")
        db.commit()
        assert enquiry.status == "WON"

        with pytest.raises(HTTPException) as exc:
            enquiry_service.set_status(db, enquiry, "NOT_A_STATUS")
        assert exc.value.status_code == 422

    def test_an_empty_reply_is_refused(self, env):
        db, partner, actor, tag, _created = env
        enquiry = enquiry_service.create_enquiry(
            db,
            partner_id=partner.id,
            buyer_name=f"Buyer {tag}",
            buyer_email=f"empty-{tag}@example.com",
            message="A message long enough to pass validation.",
        )
        db.commit()

        with pytest.raises(HTTPException) as exc:
            enquiry_service.reply(db, enquiry, author_user_id=actor.id, body="   ")
        assert exc.value.status_code == 422

    def test_a_buyer_follow_up_does_not_count_as_a_response(self, env):
        """Otherwise an impatient buyer could make their own enquiry look answered."""
        db, partner, _actor, tag, _created = env
        enquiry = enquiry_service.create_enquiry(
            db,
            partner_id=partner.id,
            buyer_name=f"Buyer {tag}",
            buyer_email=f"followup-{tag}@example.com",
            message="A message long enough to pass validation.",
        )
        db.commit()

        enquiry_service.add_buyer_message(db, enquiry, body="Any update?")
        db.commit()
        assert enquiry.first_responded_at is None
        assert enquiry.status == "NEW"

    def test_metrics_count_answered_and_unanswered(self, env):
        db, partner, actor, tag, _created = env
        answered = enquiry_service.create_enquiry(
            db, partner_id=partner.id, buyer_name="A", buyer_email=f"a-{tag}@example.com",
            message="A message long enough to pass validation.",
        )
        enquiry_service.create_enquiry(
            db, partner_id=partner.id, buyer_name="B", buyer_email=f"b-{tag}@example.com",
            message="A message long enough to pass validation.",
        )
        enquiry_service.reply(db, answered, author_user_id=actor.id, body="Yes.")
        db.commit()

        metrics = enquiry_service.partner_metrics(db, partner.id)
        assert metrics["total"] == 2
        assert metrics["answered"] == 1
        assert metrics["unanswered"] == 1
