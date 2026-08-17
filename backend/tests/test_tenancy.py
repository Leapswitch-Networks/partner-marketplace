"""The tenant boundary: the organisation gate, and the write path that fills it.

`CORE_EXTRACTION_PLAN.md` phase 2. Two things are pinned here, and the second
one is the reason this file exists at all.

**1. The gate's semantics.** `core/tenancy.is_active` decides whether a user's
organisation permits them to sign in, and it runs on *every authenticated
request*. Its one asymmetry — `None` means "no organisation to gate", so it
answers True — is the kind of rule that reads like a bug and gets "fixed" into
locking out every internal account.

**2. The gate governed nobody until 2026-08-17.** Measured that day: no service
set `users.partner_id`, neither user schema carried it, and `user_invitations`
had no such column. An organisation could be onboarded, activated, verified and
published while remaining permanently empty, so a guard that ran on every
request had zero rows to act on. The write path added in phase 2 is what makes
the gate real, and `TestTheWritePathExists` is what stops it silently
disappearing again — a regression that would be invisible, because nothing would
error and every test about the *gate* would still pass.

These are pure-logic tests. The organisation is a stub satisfying
`core.tenancy.Organisation`, which is the entire point of that Protocol: the
guard can be tested without the partner directory, and so can a second project's.
"""

from __future__ import annotations

from dataclasses import dataclass

import pytest
from fastapi import HTTPException

from app.core import tenancy
from app.core.dependencies import _assert_organisation_active
from app.models.user import User
from app.schemas.rbac import CreateInvitationRequest, CreateUserRequest, UpdateUserRequest


@dataclass
class StubOrganisation:
    """Satisfies `tenancy.Organisation` with no database and no domain model.

    If this stops satisfying the Protocol, the Protocol grew a member — and that
    is a change every future project inherits, so it should be deliberate.
    """

    id: str
    status: str


@dataclass
class StubUser:
    """Just enough of a user for the gate: the one attribute it reads.

    **Not a real `User`.** Assigning a plain object to `User.organisation` fails
    — SQLAlchemy instruments the relationship and demands a mapped instance
    (`AttributeError: 'StubOrganisation' object has no attribute
    '_sa_instance_state'`), which is what the first version of this file hit.

    Duck-typing here is not a workaround, it is the assertion: the guard is
    annotated `user: User` but touches exactly `user.organisation`, so it works
    against anything with that attribute. A guard that needed a real ORM instance
    could not be reused by a project with a different user model, and that is the
    property phase 2 was about.
    """

    organisation: StubOrganisation | None


class TestTheProtocolStaysMinimal:
    def test_a_two_field_stub_satisfies_it(self):
        """`Organisation` must stay small enough that a second project can
        implement it without adopting this one's schema."""
        assert isinstance(StubOrganisation(id="o1", status="ACTIVE"), tenancy.Organisation)

    def test_the_status_vocabulary_is_the_cores(self):
        """The guard branches on these, so the core defines them. A guard
        branching on values it does not own is a rule split across two files."""
        assert {"PENDING", "ACTIVE", "SUSPENDED"} == tenancy.ORG_STATUSES


class TestIsActive:
    def test_no_organisation_is_active(self):
        """**The asymmetry that must not be 'fixed'.** `organisation_id IS NULL`
        is an internal, first-party account with nothing to gate. Answering False
        here would lock out every staff member the moment the gate was wired in.
        """
        assert tenancy.is_active(None) is True

    def test_active_is_active(self):
        assert tenancy.is_active(StubOrganisation(id="o1", status="ACTIVE")) is True

    @pytest.mark.parametrize("status", ["PENDING", "SUSPENDED"])
    def test_everything_else_is_refused(self, status: str):
        assert tenancy.is_active(StubOrganisation(id="o1", status=status)) is False

    def test_an_unknown_status_fails_closed(self):
        """Written as a comparison against ACTIVE rather than against the two
        refusals, so a fourth status added later is refused rather than admitted.
        """
        assert tenancy.is_active(StubOrganisation(id="o1", status="ARCHIVED")) is False


class TestTheGate:
    """`_assert_organisation_active` — what a caller actually experiences."""

    def _user(self, organisation: StubOrganisation | None) -> StubUser:
        return StubUser(organisation=organisation)

    def test_an_internal_account_passes_straight_through(self):
        _assert_organisation_active(self._user(None))

    def test_an_active_organisation_passes(self):
        _assert_organisation_active(self._user(StubOrganisation(id="o1", status="ACTIVE")))

    def test_pending_says_awaiting_activation(self):
        """PENDING and SUSPENDED are different things to read at a login screen:
        'we have not activated you yet' versus 'we switched you off'."""
        with pytest.raises(HTTPException) as caught:
            _assert_organisation_active(self._user(StubOrganisation(id="o1", status="PENDING")))
        assert caught.value.status_code == 403
        assert "awaiting activation" in caught.value.detail

    def test_suspended_says_suspended(self):
        with pytest.raises(HTTPException) as caught:
            _assert_organisation_active(self._user(StubOrganisation(id="o1", status="SUSPENDED")))
        assert caught.value.status_code == 403
        assert "suspended" in caught.value.detail.lower()

    def test_it_is_403_not_401(self):
        """The caller IS authenticated — their organisation is the problem. A 401
        would make the client sign them out and invite an endless retry loop
        against a gate that will not open."""
        with pytest.raises(HTTPException) as caught:
            _assert_organisation_active(self._user(StubOrganisation(id="o1", status="SUSPENDED")))
        assert caught.value.status_code != 401


class TestTheWritePathExists:
    """**The regression guard for the hole phase 2 closed.**

    Until 2026-08-17 nothing in the application could attach a person to an
    organisation. These assertions are deliberately about the *contract* rather
    than about behaviour, because the failure mode was an absence: no error, no
    failing test, just a column nobody could fill.
    """

    def test_creating_a_user_can_name_an_organisation(self):
        request = CreateUserRequest(
            first_name="Ada",
            last_name="Lovelace",
            email="ada@example.com",
            organisation_id="org-123",
        )
        assert request.organisation_id == "org-123"

    def test_creating_a_user_without_one_is_internal(self):
        request = CreateUserRequest(first_name="Ada", last_name="Lovelace", email="ada@example.com")
        assert request.organisation_id is None

    def test_updating_a_user_can_move_them(self):
        assert UpdateUserRequest(organisation_id="org-456").organisation_id == "org-456"

    def test_an_invitation_carries_the_organisation(self):
        """Inviting somebody INTO an organisation is how a tenant gets its second
        user. Without this the only route was a manual database edit."""
        request = CreateInvitationRequest(email="new@example.com", organisation_id="org-123")
        assert request.organisation_id == "org-123"

    def test_the_user_model_exposes_the_neutral_names(self):
        """Named for the concept, not for this project's domain. A second project
        swaps what the relationship points at and every core guard follows."""
        assert hasattr(User, "organisation_id")
        assert hasattr(User, "organisation")
        assert not hasattr(User, "partner_id")
        assert not hasattr(User, "partner")

    def test_the_relationship_still_reaches_a_real_table(self):
        """`user_service._resolve_organisation` reads the target class off this
        relationship rather than importing the domain model — so if the mapper
        stops resolving, organisation validation breaks with an AttributeError
        somewhere far away from the cause."""
        assert User.organisation.property.mapper.class_.__tablename__ == "partners"


class TestTheAccountTypeVocabulary:
    def test_it_names_the_account_class_not_the_domain(self):
        """`staff | partner` became `internal | external` in migration
        `c9a71f4e2b60`. "Partner" is this project's word for an external account;
        the enum is core and has to outlive it."""
        from app.models.user import AccountTypeEnum

        assert set(AccountTypeEnum.enums) == {"internal", "external"}

    def test_the_invitation_enum_matches_the_user_enum(self):
        """`accept_invitation` copies one into the other, so a drift here lands
        as an invalid enum value on the users table."""
        from app.models.user import AccountTypeEnum
        from app.models.user_invitation import InvitationAccountTypeEnum

        assert set(AccountTypeEnum.enums) == set(InvitationAccountTypeEnum.enums)
