"""Delegated visibility: who can see, and who can be talked into granting.

Written by the § 8.1 parity audit on 2026-08-12, which found the module had **no
test file at all** — notable because this is the one core module where ours
refuses something the reference permits, and an unguarded guard is a guard that
gets removed by the next refactor with a green suite.

The scope tests are pure and run everywhere. The guard tests need a database and
are marked `db`, because `create_grant` commits: a rollback in the test body
would not undo it, so they clean up by id instead.
"""

from __future__ import annotations

import pytest
from fastapi import HTTPException
from sqlalchemy import select

from app.services import data_access_service as das


class TestTheScopeRuleIsAsymmetricOnPurpose:
    """A wildcard grant answers any question; a specific grant answers only its own.

    The case worth pinning is the last one. `accessible_user_ids(scope=None)`
    means *"whose records can I see anywhere"*, and a grant scoped to one module
    does **not** count — the reference's `grantScopeApplies` returns false when
    the requested scope is null and the grant is not the wildcard. Read quickly,
    that looks like a bug; it is the rule, and inverting it would silently widen
    every unscoped call site.
    """

    @pytest.mark.parametrize(
        "grant_scope,requested,expected",
        [
            ("*", None, True),
            ("*", "qmas", True),
            ("qmas", "qmas", True),
            ("qmas", "other", False),
            ("qmas", None, False),
        ],
    )
    def test_it_matches_the_reference(self, grant_scope, requested, expected):
        assert das._scope_applies(grant_scope, requested) is expected


@pytest.mark.db
class TestAGrantCannotBeTurnedIntoSelfElevation:
    """**The check the reference does not have.**

    The reference blocks `grantee_id === subject_id` — a user being given access
    to their own records, which is merely pointless. It leaves the dangerous
    shape open: set `grantee_id` to your *own* id, `subject_id` to anyone,
    `scope='*'`, `access_level='manage'`, and one request makes you able to see
    and write every user's records.

    "Only administrators hold `data-access-manage`" is not a defence. That
    permission is grantable from the Roles screen, while `has_admin_access` is
    derived from role *names* — so the two sets diverge the moment someone builds
    a custom role, which is what the Roles screen is for.
    """

    @pytest.fixture
    def actors(self):
        from app.db.session import SessionLocal
        from app.models.data_access_grant import DataAccessGrant
        from app.models.role import Role
        from app.models.user import User

        db = SessionLocal()
        root = db.scalars(select(User).join(User.roles).where(Role.name == "RootUser")).first()
        others = db.scalars(
            select(User).where(User.status == "ACTIVE", User.id != (root.id if root else ""))
        ).all()
        if root is None or len(others) < 2:
            db.close()
            pytest.skip("needs a RootUser and two other active accounts")

        before = {g.id for g in db.scalars(select(DataAccessGrant))}
        yield db, root, others[0], others[1]

        # `create_grant` commits, so anything a test made is really there.
        for grant in db.scalars(select(DataAccessGrant)):
            if grant.id not in before:
                db.delete(grant)
        db.commit()
        db.close()

    def test_granting_someone_access_to_their_own_records_is_refused(self, actors):
        db, root, a, _b = actors
        with pytest.raises(HTTPException) as exc:
            das.create_grant(
                db, grantee_id=a.id, subject_id=a.id, scope="*", access_level="manage", actor=root
            )
        assert exc.value.status_code == 422

    def test_granting_yourself_access_to_someone_else_is_refused(self, actors):
        """The escalation proper. Refused for administrators too — they already
        see everything, so the exception would buy nothing and weaken the rule."""
        db, root, _a, b = actors
        with pytest.raises(HTTPException) as exc:
            das.create_grant(
                db,
                grantee_id=root.id,
                subject_id=b.id,
                scope="*",
                access_level="manage",
                actor=root,
            )
        assert exc.value.status_code == 403

    @pytest.mark.parametrize("level", ["root", "admin", "", "VIEW"])
    def test_only_view_and_manage_are_accepted(self, actors, level):
        db, root, a, b = actors
        with pytest.raises(HTTPException) as exc:
            das.create_grant(
                db, grantee_id=a.id, subject_id=b.id, scope="*", access_level=level, actor=root
            )
        assert exc.value.status_code == 422

    def test_a_legitimate_grant_widens_view_but_not_manage(self, actors):
        """A `view` grant must not satisfy a `manage` question.

        The whole delegation model rests on this one comparison, and it is a
        single `!=` in the loop — exactly the kind of line that survives a
        refactor in the wrong form.
        """
        db, root, a, b = actors
        das.create_grant(
            db, grantee_id=a.id, subject_id=b.id, scope="*", access_level="view", actor=root
        )

        visible = das.accessible_user_ids(db, a)
        assert b.id in visible, "the view grant did not take effect"

        assert b.id not in das.accessible_user_ids(db, a, None, das.LEVEL_MANAGE)
        assert das.can_manage_data_of(db, a, b.id) is False

    def test_someone_with_no_grants_sees_only_themselves(self, actors):
        db, _root, a, _b = actors
        assert das.accessible_user_ids(db, a) == [a.id]
        # Empty rather than `[self]`: holding no delegation is not the same as
        # being allowed to manage your own records, which each module decides.
        assert das.manageable_user_ids(db, a) == []
        assert das.can_manage_data_of(db, a, None) is False
