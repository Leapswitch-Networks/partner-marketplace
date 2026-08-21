"""`GET /partners/me/overview` — the partner landing page's figures.

Written with the endpoint, because the thing it replaced was wrong in a way that
rendered perfectly. `PartnerOverview.tsx` used to fetch a page of listings and a
page of enquiries and reduce them in the browser:

* `items.length` was reported as the total, so a partner with more listings than
  the page size was told they had exactly the page size;
* `unanswered` was recomputed from `first_responded_at`, which stopped matching
  the server the moment PM-47 excluded spam from that measure.

The second one is why this file exists. A number computed in two places drifts,
and the drift here would have gone on penalising partners for spam *after* the
fix that was supposed to stop it — with the server and the screen each internally
consistent and disagreeing with one another.
"""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy import delete, select

from app.core.security import hash_password
from app.models.enquiry import Enquiry
from app.models.partner import Partner
from app.models.service_category import ServiceCategory
from app.models.service_listing import ServiceListing
from app.models.user import User
from app.services import enquiry_service, listing_service, partner_service

pytestmark = pytest.mark.db


@pytest.fixture
def org_with_member():
    """One partner, one member of it, one category — and a staff reviewer.

    The member carries an `organisation_id`, which is what every `/me` route
    resolves from. No role is attached: `own_overview` is reached through
    `require_permission(ORGANISATION_MANAGE)` at the router, so the service-level
    tests here do not need the grant, and adding one would test the router twice.
    """
    from app.db.session import SessionLocal

    db = SessionLocal()
    reviewer = db.scalars(
        select(User).where(User.status == "ACTIVE", User.organisation_id.is_(None))
    ).first()
    if reviewer is None:
        db.close()
        pytest.skip("needs one active internal user to act as the reviewer")

    tag = uuid.uuid4().hex[:8]
    category = ServiceCategory(name=f"Ovw {tag}", slug=f"ovw-{tag}", sort_order=95)
    partner = Partner(
        id=str(uuid.uuid4()),
        name=f"Overview Partner {tag}",
        slug=f"overview-partner-{tag}",
        status="ACTIVE",
        verification_level="VERIFIED",
        is_listed=True,
    )
    db.add_all([category, partner])
    db.flush()

    member = User(
        email=f"ovw-{tag}@example.com",
        password=hash_password("not-a-real-password"),
        first_name="Overview",
        last_name="Member",
        account_type="external",
        status="ACTIVE",
        auth_provider="password",
        organisation_id=partner.id,
    )
    db.add(member)
    db.commit()

    yield db, partner, member, category, reviewer

    db.execute(delete(Enquiry).where(Enquiry.partner_id == partner.id))
    db.execute(delete(ServiceListing).where(ServiceListing.partner_id == partner.id))
    db.commit()
    for row in (db.get(User, member.id), db.get(Partner, partner.id)):
        if row:
            db.delete(row)
    db.commit()
    row = db.get(ServiceCategory, category.id)
    if row:
        db.delete(row)
    db.commit()
    db.close()


def _listing(db, partner, category, title: str) -> ServiceListing:
    return listing_service.create_listing(
        db,
        partner_id=partner.id,
        title=title,
        summary="A service somebody might buy.",
        category_id=category.id,
    )


def _enquiry(db, partner, name: str) -> Enquiry:
    return enquiry_service.create_enquiry(
        db,
        partner_id=partner.id,
        buyer_name=name,
        buyer_email=f"{name.lower().replace(' ', '-')}@example.com",
        message="A message long enough to pass validation.",
    )


class TestTheShape:
    def test_a_new_organisation_reports_honest_zeros(self, org_with_member):
        """Every key present, all zero. § 20.4's honest zero.

        A missing key would read as "no data" at the call site and render as
        `undefined`; a zero says "none of these", which is true and is what a
        partner who has just signed up should see.
        """
        db, partner, member, _category, _reviewer = org_with_member
        overview = partner_service.own_overview(db, member)

        assert overview["organisation_name"] == partner.name
        assert overview["status"] == "ACTIVE"
        assert overview["is_listed"] is True
        assert overview["listings"] == {
            "draft": 0,
            "pending_review": 0,
            "published": 0,
            "rejected": 0,
        }
        assert overview["enquiries"] == {
            "total": 0,
            "unanswered": 0,
            "answered": 0,
            "spam": 0,
        }

    def test_a_partner_on_no_tier_is_unlimited(self, org_with_member):
        """The shipped state: every partner has `tier_id` NULL.

        Worth pinning rather than assuming — the UI hides the entitlement block
        entirely when `unlimited` is true, so if this ever returned a cap by
        default, a limit would appear on screen that nothing had configured.
        """
        db, _partner, member, _category, _reviewer = org_with_member
        entitlement = partner_service.own_overview(db, member)["entitlement"]

        assert entitlement["unlimited"] is True
        assert entitlement["max_listings"] is None
        assert entitlement["remaining"] is None
        assert entitlement["at_limit"] is False

    def test_staff_have_no_overview(self, org_with_member):
        """404, from `get_own_organisation`, not an empty shape.

        A staff account has no organisation. Returning zeros would be a lie that
        renders as a real dashboard for somebody it does not describe.
        """
        from fastapi import HTTPException

        db, _partner, _member, _category, reviewer = org_with_member
        with pytest.raises(HTTPException) as exc:
            partner_service.own_overview(db, reviewer)
        assert exc.value.status_code == 404


class TestTheCountsMatchTheDatabaseNotAPage:
    def test_listings_are_counted_by_status(self, org_with_member):
        """One of each state, so a mix-up between two of them is visible.

        The old code derived these from a page of rows; a partner with more
        listings than the page size was silently told the page size.
        """
        db, partner, member, category, reviewer = org_with_member

        _listing(db, partner, category, "Still a draft")

        submitted = _listing(db, partner, category, "Waiting for review")
        listing_service.submit_for_review(db, submitted)

        published = _listing(db, partner, category, "Live")
        listing_service.submit_for_review(db, published)
        listing_service.approve(db, published, reviewer_id=reviewer.id)

        rejected = _listing(db, partner, category, "Sent back")
        listing_service.submit_for_review(db, rejected)
        listing_service.reject(db, rejected, reviewer_id=reviewer.id, reason="Needs detail.")
        db.commit()

        assert partner_service.own_overview(db, member)["listings"] == {
            "draft": 1,
            "pending_review": 1,
            "published": 1,
            "rejected": 1,
        }

    def test_a_soft_deleted_listing_stops_counting(self, org_with_member):
        """Consistent with `published_counts`, which entitlement is computed from.

        If the two disagreed, a partner could be at their limit according to the
        publish gate while this page said they had a slot free.
        """
        db, partner, member, category, reviewer = org_with_member
        listing = _listing(db, partner, category, "Here then gone")
        listing_service.submit_for_review(db, listing)
        listing_service.approve(db, listing, reviewer_id=reviewer.id)
        db.commit()
        assert partner_service.own_overview(db, member)["listings"]["published"] == 1

        listing_service.soft_delete(db, listing)
        db.commit()

        overview = partner_service.own_overview(db, member)
        assert overview["listings"]["published"] == 0
        assert overview["entitlement"]["published"] == 0, (
            "the entitlement count and the status count must agree, or the "
            "publish gate and this page tell the partner different things"
        )


class TestSpamNeverReachesTheseNumbers:
    """The reason the reduction had to move to the server — TECH_DEBT PM-47."""

    def test_spam_leaves_the_totals_and_is_reported_separately(self, org_with_member):
        """The drift the old page would have had, made a failing assertion.

        The browser counted `!first_responded_at` as unanswered. A spam enquiry is
        never replied to, so it satisfied that test for ever — while the server,
        since PM-47, excludes it from both halves. Two internally consistent
        numbers, disagreeing.
        """
        db, partner, member, _category, reviewer = org_with_member
        answered = _enquiry(db, partner, "Real Buyer")
        enquiry_service.reply(db, answered, author_user_id=reviewer.id, body="On it.")
        junk = _enquiry(db, partner, "Junk Sender")
        db.commit()

        assert partner_service.own_overview(db, member)["enquiries"] == {
            "total": 2,
            "unanswered": 1,
            "answered": 1,
            "spam": 0,
        }

        enquiry_service.set_status(db, junk, "SPAM")
        db.commit()

        assert partner_service.own_overview(db, member)["enquiries"] == {
            "total": 1,
            "unanswered": 0,
            "answered": 1,
            "spam": 1,
        }, "spam must leave both halves and still be visible as its own count"

    def test_opening_an_enquiry_does_not_make_it_answered(self, org_with_member):
        """`VIEWED` is not progress, and this page must not present it as such.

        § 16.2's measure is the *unanswered* share. If opening an enquiry moved it
        out of that count, a partner could clear the number without replying to
        anyone.
        """
        db, partner, member, _category, _reviewer = org_with_member
        enquiry = _enquiry(db, partner, "Waiting Buyer")
        db.commit()

        assert enquiry_service.mark_viewed(db, enquiry, member) is True
        db.commit()
        assert enquiry.status == "VIEWED"

        assert partner_service.own_overview(db, member)["enquiries"] == {
            "total": 1,
            "unanswered": 1,
            "answered": 0,
            "spam": 0,
        }


class TestTheIdentityPayloadCarriesOrganisationMembership:
    """The field the whole partner UI hangs off — TECH_DEBT PM-49.

    `DashboardHome` decides whether an account is a partner from exactly one
    value: `auth.user.organisation_id`. Nothing else. So if the identity payload
    does not carry it, `PartnerOverview` never renders — for anybody — and there
    is no error anywhere to say so.

    That is what happened. `CurrentUserResponse` declared the field on 2026-08-17
    with `= None`, and `rbac_service.current_user_payload` was never given the key.
    A default on a field the payload builder is responsible for turns a missing key
    into a **wrong answer**, and a wrong answer that is also a plausible one — most
    accounts genuinely have no organisation — is invisible.

    The field is required now, so a missing key is a 500 on the first request. This
    suite is the cheaper signal: it fails in CI on the code alone.
    """

    def test_a_partner_member_reports_their_organisation(self, org_with_member):
        """Against the pre-fix code this returns None and the assertion fails."""
        from app.services import rbac_service

        db, partner, member, _category, _reviewer = org_with_member
        payload = rbac_service.current_user_payload(db, member)

        assert "organisation_id" in payload, (
            "the identity payload has no organisation_id key. `CurrentUserResponse` "
            "requires it, so this is a 500 in production — and if somebody 'fixes' "
            "that by restoring a default, the partner dashboard silently dies again."
        )
        assert payload["organisation_id"] == partner.id

    def test_an_internal_account_reports_none(self, org_with_member):
        """The other half. `None` must mean staff, not 'we forgot to send it'.

        Both were indistinguishable before the fix, which is precisely why the
        defect survived: the value the bug produced was the value most accounts
        should legitimately have.
        """
        from app.services import rbac_service

        db, _partner, _member, _category, reviewer = org_with_member
        payload = rbac_service.current_user_payload(db, reviewer)

        assert "organisation_id" in payload
        assert payload["organisation_id"] is None

    def test_the_response_model_refuses_a_payload_without_it(self, org_with_member):
        """The guard that keeps the two in step.

        If someone restores `= None` on the schema, this test still passes — so it
        asserts the *absence of a default* directly rather than inferring it.
        """
        from app.schemas.auth import CurrentUserResponse

        field = CurrentUserResponse.model_fields["organisation_id"]
        assert field.is_required(), (
            "organisation_id has regained a default. A default here silently "
            "converts a missing payload key into `null`, which reads as 'this is a "
            "staff account' — see this class's docstring."
        )
