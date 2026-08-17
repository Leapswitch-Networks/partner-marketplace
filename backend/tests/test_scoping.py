"""Row-level scoping — the suite `PARTNER_DIRECTORY_PLAN.md` § 11 asks for.

**This is the only subsystem in the repo whose failure mode is a headline.**
Every other bug shows the wrong number or a 500; this one shows one tenant
another tenant's rows, or shows the anonymous internet something unpublished.

Written against `scoping.py` and nothing else, deliberately. A test that went
through a router would prove the router; these prove the rule, and the rule is
what every future caller inherits.

## The four principals, and why each is here

| Principal | Must see | Because |
|---|---|---|
| admin-access human | everything | that is what `ADMIN_ACCESS_ROLES` means |
| human in an org | their org only | the tenant boundary |
| human with no org | **nothing** | scoping them on NULL would match every unowned row |
| anonymous / machine | only what is published, or nothing | § 7: the default must fail closed |

The third row is the one that looks wrong and is not. An internal account
without admin access has `organisation_id IS NULL`, and the naive filter
`owner == actor.organisation_id` becomes `owner IS NULL`, which matches every
row nobody owns. Returning nothing is the only safe reading.
"""

from __future__ import annotations

from dataclasses import dataclass

import pytest
from sqlalchemy import String, select
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.core.principal import ANONYMOUS, MachinePrincipal, UserPrincipal
from app.models.user import User
from app.services import scoping


class _TestBase(DeclarativeBase):
    """A metadata registry of its own — **not** `app.db.base.Base`.

    Declaring the fixture model on the application's Base adds a table to
    `Base.metadata` that exists in no migration, and
    `test_route_enforcement.py::test_the_database_matches_the_models` compares
    the two. It caught exactly that on the first run of this file. A separate
    base keeps a test fixture out of the application's schema, where it has no
    business being — and out of Alembic's autogenerate, which would otherwise
    offer to create it.
    """


class ScopedThing(_TestBase):
    """A throwaway model, so these tests do not depend on the partner directory.

    That independence is the point: scoping is core, and a second project's
    tables must be able to use it. If this file needed `Partner` to make its
    assertions, the rule would not be reusable.
    """

    __tablename__ = "_test_scoped_thing"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    organisation_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    is_public: Mapped[bool] = mapped_column(default=False)


@pytest.fixture
def isolated_registry():
    """Run against an empty registry, then put the real one back.

    **Not autouse.** `TestTheRealRegistrationsAreInPlace` has to see what the
    application actually registered at import, and an autouse fixture would hand
    it an empty registry and make its assertions meaningless.
    """
    saved = scoping.scoped_models()
    scoping.reset_for_tests()
    yield
    scoping.reset_for_tests()
    for model, scope in saved.items():
        scoping.register_scope(
            model,
            owner_column=scope.owner_column,
            public_predicate=scope.public_predicate,
        )


@dataclass
class StubUser:
    """The two attributes `apply_scope` reads off a human, and nothing else.

    **Not a `User` subclass, and that was the first attempt.** Subclassing a
    mapped class makes SQLAlchemy build a second mapper for it — single-table
    inheritance — which fails at instantiation and produced a `ValueError` far
    from the cause. `has_admin_access` is also a read-only property derived from
    `roles`, so it cannot simply be assigned on an instance.

    A stub is better than a real `User` plus a real `Role` here anyway: it keeps
    these tests free of the database, and it demonstrates that the scoping rule
    depends on two attributes rather than on this project's user model.
    """

    organisation_id: str | None
    has_admin_access: bool


def _user(*, org: str | None, admin: bool) -> UserPrincipal:
    """A human principal with a known `has_admin_access` and organisation."""
    return UserPrincipal(user=StubUser(organisation_id=org, has_admin_access=admin))


def _sql(stmt) -> str:
    return str(stmt.compile(compile_kwargs={"literal_binds": True}))


@pytest.mark.usefixtures("isolated_registry")
class TestRegistration:
    def test_an_unregistered_model_raises_rather_than_returning_everything(self):
        """**The most important failure mode in this file.** Returning `stmt`
        unchanged for an unregistered model would serve every row and look like
        it worked."""
        with pytest.raises(LookupError, match="no scope registered"):
            scoping.apply_scope(select(ScopedThing), ScopedThing, None)

    def test_registering_twice_raises(self):
        scoping.register_scope(ScopedThing, owner_column=ScopedThing.organisation_id)
        with pytest.raises(ValueError, match="already has a scope"):
            scoping.register_scope(ScopedThing, owner_column=ScopedThing.organisation_id)

    def test_public_predicate_defaults_to_none(self):
        """A model must OPT IN to being publicly visible. Forgetting to think
        about the anonymous case has to fail closed."""
        scoping.register_scope(ScopedThing, owner_column=ScopedThing.organisation_id)
        assert scoping.scope_for(ScopedThing).public_predicate is None


class TestApplyScope:
    @pytest.fixture(autouse=True)
    def _registered(self, isolated_registry):
        # Depends on `isolated_registry` rather than sitting beside it: pytest
        # runs autouse fixtures before explicitly-requested ones at the same
        # scope, so a class-level `usefixtures` would reset the registry AFTER
        # this registered into it. Declaring the dependency is what orders them.
        scoping.register_scope(
            ScopedThing,
            owner_column=ScopedThing.organisation_id,
            public_predicate=ScopedThing.is_public.is_(True),
        )

    def test_admin_access_sees_everything_unfiltered(self):
        stmt = scoping.apply_scope(select(ScopedThing), ScopedThing, _user(org=None, admin=True))
        assert "WHERE" not in _sql(stmt)

    def test_a_member_is_narrowed_to_their_own_organisation(self):
        stmt = scoping.apply_scope(
            select(ScopedThing), ScopedThing, _user(org="org-1", admin=False)
        )
        sql = _sql(stmt)
        assert "organisation_id = 'org-1'" in sql

    def test_a_member_of_another_organisation_gets_a_different_filter(self):
        """Two tenants must never compile to the same query."""
        a = _sql(scoping.apply_scope(select(ScopedThing), ScopedThing, _user(org="org-1", admin=False)))
        b = _sql(scoping.apply_scope(select(ScopedThing), ScopedThing, _user(org="org-2", admin=False)))
        assert a != b

    def test_a_human_with_no_organisation_sees_nothing(self):
        """**Not everything.** `owner == NULL` would match every unowned row."""
        stmt = scoping.apply_scope(select(ScopedThing), ScopedThing, _user(org=None, admin=False))
        sql = _sql(stmt).lower()
        assert "where false" in sql or "1 != 1" in sql or "where 0 = 1" in sql

    def test_anonymous_sees_only_the_public_predicate(self):
        stmt = scoping.apply_scope(select(ScopedThing), ScopedThing, ANONYMOUS)
        sql = _sql(stmt)
        assert "is_public" in sql
        assert "organisation_id" not in sql.split("WHERE", 1)[1]

    def test_anonymous_sees_nothing_when_no_public_predicate_is_registered(self):
        scoping.reset_for_tests()
        scoping.register_scope(ScopedThing, owner_column=ScopedThing.organisation_id)
        stmt = scoping.apply_scope(select(ScopedThing), ScopedThing, ANONYMOUS)
        sql = _sql(stmt).lower()
        assert "where false" in sql or "1 != 1" in sql or "where 0 = 1" in sql

    def test_none_is_treated_as_anonymous_not_as_unrestricted(self):
        """`PARTNER_DIRECTORY_PLAN.md` § 7 names this exact hazard: the obvious
        `if actor is None: return stmt` serves unfiltered rows to the internet."""
        assert _sql(scoping.apply_scope(select(ScopedThing), ScopedThing, None)) == _sql(
            scoping.apply_scope(select(ScopedThing), ScopedThing, ANONYMOUS)
        )

    def test_a_machine_token_is_not_a_member_of_anything(self):
        """A machine holds abilities, not membership. It gets the public
        allowance — never a human's."""
        machine = MachinePrincipal(
            consumer_id="c1", consumer_slug="billing", token_id="t1", token_prefix="pk_"
        )
        assert _sql(scoping.apply_scope(select(ScopedThing), ScopedThing, machine)) == _sql(
            scoping.apply_scope(select(ScopedThing), ScopedThing, ANONYMOUS)
        )

    def test_a_real_user_is_accepted_as_well_as_a_principal(self):
        """258 signatures still say `actor: User`, so the boundary normalises
        rather than demanding every caller wrap first.

        Uses a genuine `User` — not the stub — because this is the assertion
        about the `isinstance(actor, User)` branch in `_as_principal`. A real
        user with no roles has `has_admin_access` False, which is the scoped case.
        """
        user = User(email="member@example.com", organisation_id="org-1")
        user.roles = []
        assert _sql(scoping.apply_scope(select(ScopedThing), ScopedThing, user)) == _sql(
            scoping.apply_scope(select(ScopedThing), ScopedThing, _user(org="org-1", admin=False))
        )

    def test_the_filter_is_in_the_sql_not_applied_afterwards(self):
        """Post-filtering corrupts the count — the caller is told there are 40
        rows and handed 12 (`FASTAPI_STANDARDS.md` § 12)."""
        stmt = scoping.apply_scope(
            select(ScopedThing), ScopedThing, _user(org="org-1", admin=False)
        )
        assert "WHERE" in _sql(stmt)


class TestCanRead:
    @pytest.fixture(autouse=True)
    def _registered(self, isolated_registry):
        # Depends on `isolated_registry` rather than sitting beside it: pytest
        # runs autouse fixtures before explicitly-requested ones at the same
        # scope, so a class-level `usefixtures` would reset the registry AFTER
        # this registered into it. Declaring the dependency is what orders them.
        scoping.register_scope(
            ScopedThing,
            owner_column=ScopedThing.organisation_id,
            public_predicate=ScopedThing.is_public.is_(True),
        )

    def test_admin_reads_anything(self):
        row = ScopedThing(id="t1", organisation_id="org-9", is_public=False)
        assert scoping.can_read(row, ScopedThing, _user(org=None, admin=True)) is True

    def test_a_member_reads_their_own(self):
        row = ScopedThing(id="t1", organisation_id="org-1", is_public=False)
        assert scoping.can_read(row, ScopedThing, _user(org="org-1", admin=False)) is True

    def test_a_member_cannot_read_another_organisations_row(self):
        row = ScopedThing(id="t1", organisation_id="org-2", is_public=False)
        assert scoping.can_read(row, ScopedThing, _user(org="org-1", admin=False)) is False

    def test_a_human_with_no_organisation_reads_nothing(self):
        row = ScopedThing(id="t1", organisation_id=None, is_public=False)
        assert scoping.can_read(row, ScopedThing, _user(org=None, admin=False)) is False

    def test_anonymous_reads_nothing_through_this_path(self):
        """`can_read` answers the OWNERSHIP question. A public row is reachable
        through `apply_scope`'s predicate, not by handing anonymous a row and
        asking whether it owns it — which it never does."""
        row = ScopedThing(id="t1", organisation_id="org-1", is_public=True)
        assert scoping.can_read(row, ScopedThing, ANONYMOUS) is False


class TestAssertCanRead:
    @pytest.fixture(autouse=True)
    def _registered(self, isolated_registry):
        # Depends on `isolated_registry` rather than sitting beside it: pytest
        # runs autouse fixtures before explicitly-requested ones at the same
        # scope, so a class-level `usefixtures` would reset the registry AFTER
        # this registered into it. Declaring the dependency is what orders them.
        scoping.register_scope(ScopedThing, owner_column=ScopedThing.organisation_id)

    def test_a_foreign_row_is_404_never_403(self):
        """**403 confirms the row exists.** In a directory that tells one partner
        a competitor is on the platform before it is published."""
        row = ScopedThing(id="t1", organisation_id="org-2")
        with pytest.raises(Exception) as caught:
            scoping.assert_can_read(row, ScopedThing, _user(org="org-1", admin=False))
        assert caught.value.status_code == 404

    def test_the_message_says_nothing(self):
        row = ScopedThing(id="t1", organisation_id="org-2")
        with pytest.raises(Exception) as caught:
            scoping.assert_can_read(row, ScopedThing, _user(org="org-1", admin=False))
        assert caught.value.detail == "Not found"

    def test_an_owned_row_passes_silently(self):
        row = ScopedThing(id="t1", organisation_id="org-1")
        scoping.assert_can_read(row, ScopedThing, _user(org="org-1", admin=False))


class TestTheRealRegistrationsAreInPlace:
    """The registry has to actually be populated in the running application.

    These tests run against the real registrations rather than the fixture's
    empty one — a scoping module nobody registered against is the same as no
    scoping module.
    """

    def test_the_partner_directory_registered_its_scope(self):
        """`partner_service` registers on import. If this fails, the two `# PM-5`
        call sites it replaced are scoping against nothing."""
        from app.models.partner import Partner
        from app.services import partner_service  # noqa: F401  (registers on import)

        assert Partner in scoping.scoped_models()

    def test_a_partner_row_is_owned_by_its_own_id(self):
        """A partner IS the organisation, so its own primary key is the owner
        column. Not a special case — the organisation's row is owned by the
        organisation."""
        from app.models.partner import Partner
        from app.services import partner_service  # noqa: F401

        assert scoping.scope_for(Partner).owner_column.key == "id"

    def test_the_public_predicate_requires_both_listed_and_active(self):
        """**Either condition alone publishes the wrong rows.** `is_listed` on a
        SUSPENDED organisation would leave a row claiming to be published that is
        not; ACTIVE alone would publish every partner the moment they were
        activated."""
        from app.models.partner import Partner
        from app.services import partner_service  # noqa: F401

        predicate = str(scoping.scope_for(Partner).public_predicate)
        assert "is_listed" in predicate
        assert "status" in predicate
