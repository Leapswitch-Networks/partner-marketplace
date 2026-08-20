"""The visibility rules nobody had probed — § 8.2's data-visibility sweep.

The 2026-08-13 sweep of "every data-visibility path has a recorded verification"
found ten paths with none. Three of them are refusals a green suite could lose
without noticing, so they get tests here; the rest are recorded (with reasoning,
not just assertion) in `DAILY_CHANGES.md` the same day:

* the Users detail rule — without admin access, another person's record is a
  **404, not a 403**, so the response cannot confirm the account exists
* the Invitations narrowing — no admin access means you see only the
  invitations you sent
* assistant-thread ownership — someone else's conversation id is a 404, for
  the same enumeration reason as Users

Marked `db` throughout, and every fixture cleans up by id rather than by
rollback — the lesson the Data Access audit paid for: `create_grant` and
friends commit, so a rollback in the test body undoes nothing.
"""

from __future__ import annotations

import uuid

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.permissions import USER_VIEW
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.domain.partners.permissions import ORGANISATION_MANAGE, PARTNER_VIEW
from app.main import app
from app.models.ai_conversation import AgentConversation
from app.models.data_access_grant import DataAccessGrant
from app.models.permission import Permission
from app.models.role import Role
from app.models.user import User
from app.schemas.rbac import UpdateUserRequest
from app.services import ai_service, invitation_service, user_service

pytestmark = pytest.mark.db

PASSWORD = "TestOnly@12345"


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def viewer():
    """An ACTIVE account that holds `user-view` and nothing admin-shaped.

    The point of building it this way: `has_admin_access` is derived from role
    *names*, so a custom role carrying real permissions still scopes like a
    non-admin — which is exactly the account shape the visibility rules exist
    for, and exactly the shape a seeded roster never contains.
    """
    db = SessionLocal()
    perm = db.scalar(select(Permission).where(Permission.name == USER_VIEW))
    if perm is None:
        db.close()
        pytest.skip("permissions are not seeded")

    suffix = uuid.uuid4().hex[:8]
    role = Role(name=f"ZZTestViewer{suffix}", display_name="Test viewer", is_system=False)
    role.permissions = [perm]
    user = User(
        email=f"zz-viewer-{suffix}@example.com",
        password=hash_password(PASSWORD),
        first_name="Vera",
        last_name="Viewer",
        account_type="internal",
        status="ACTIVE",
        auth_provider="password",
    )
    db.add(role)
    db.flush()
    user.roles.append(role)
    db.add(user)
    db.commit()
    db.refresh(user)
    email, user_id, role_id = user.email, user.id, role.id
    db.close()

    yield {"email": email, "id": user_id}

    db = SessionLocal()
    target = db.get(User, user_id)
    if target:
        target.roles = []
        db.delete(target)
    role_row = db.get(Role, role_id)
    if role_row:
        db.delete(role_row)
    db.commit()
    db.close()


def _somebody_else(db, not_id: str) -> User | None:
    return db.scalars(
        select(User).where(User.status == "ACTIVE", User.id != not_id)
    ).first()


class TestAnotherPersonsRecordIsNotFoundNotForbidden:
    """`GET /users/{id}` for a stranger's id must be a 404.

    A 403 would answer the question the caller was really asking — "does an
    account with this id exist?" — and a 200 would be the actual leak.

    The rule used to live inline in the router and now lives in
    `user_service.get_visible_user_or_404`, which is what the write paths were
    missing entirely. This test stays at the HTTP level regardless: it is the one
    that proves the route is actually wired to the rule.
    """

    def test_stranger_404_own_200(self, client, viewer):
        db = SessionLocal()
        other = _somebody_else(db, viewer["id"])
        db.close()
        if other is None:
            pytest.skip("needs at least one other active account")

        login = client.post(
            "/api/v1/auth/login",
            json={"email": viewer["email"], "password": PASSWORD},
        )
        assert login.status_code == 200, login.text
        try:
            stranger = client.get(f"/api/v1/users/{other.id}")
            assert stranger.status_code == 404, (
                f"expected 404, got {stranger.status_code}: a non-admin just "
                "read (or was told about) someone else's record"
            )
            own = client.get(f"/api/v1/users/{viewer['id']}")
            assert own.status_code == 200, own.text
        finally:
            client.post("/api/v1/auth/logout")


class TestInvitationsAreNarrowedToTheirSender:
    """No admin access → only the invitations you sent yourself."""

    def test_foreign_invitations_are_invisible(self, viewer):
        db = SessionLocal()
        try:
            actor = db.get(User, viewer["id"])
            rows, total = invitation_service.list_invitations(db, actor)
            foreign = [r for r in rows if r.invited_by != actor.id]
            assert foreign == [], (
                f"{len(foreign)} invitation(s) sent by other people were "
                f"visible to a non-admin (of {total} total)"
            )
        finally:
            db.close()


class TestAssistantThreadsBelongToWhoStartedThem:
    """Someone else's conversation id is a 404 — reading it back would tell you
    what colleagues have been asking, the same hole the tool denylist closes."""

    def test_foreign_conversation_404(self, viewer):
        db = SessionLocal()
        other = _somebody_else(db, viewer["id"])
        if other is None:
            db.close()
            pytest.skip("needs at least one other active account")

        conversation = AgentConversation(user_id=other.id)
        db.add(conversation)
        db.commit()
        conversation_id = conversation.id
        try:
            actor = db.get(User, viewer["id"])
            with pytest.raises(HTTPException) as excinfo:
                ai_service.get_messages(db, actor, conversation_id)
            assert excinfo.value.status_code == 404

            # The owner still reaches it — the refusal above is scoping, not
            # a broken lookup.
            owner_rows = ai_service.get_messages(db, other, conversation_id)
            assert owner_rows == []
        finally:
            row = db.get(AgentConversation, conversation_id)
            if row:
                db.delete(row)
            db.commit()
            db.close()


# ---------------------------------------------------------------------------
# The write paths — added 2026-08-17, BACKEND_CORE_PUNCHLIST T3/T4.
#
# Everything above tests reads. The sweep that wrote it stopped there, and the
# gap that left was the more dangerous half: `list_users` was scoped, the detail
# route was scoped, and **every write path loaded its target with no visibility
# check at all** — `get_user_or_404` plus `can_edit`, which is
# `has_permission("user-update")` and the super-admin protection.
#
# So an account that could not see a row in the list could still PATCH it by id.
# The tests below are written from the attacker's side first (the 404s), then the
# legitimate paths they must not break.
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def editor():
    """A non-admin who really can edit users: `user-view` + `user-update`.

    The shape that makes the escalation reachable. `has_admin_access` is derived
    from role *names* while these permissions come from the Roles screen, so this
    account holds genuine write authority and scopes like a stranger — and no
    seeded roster contains it, which is why nothing had probed it.
    """
    db = SessionLocal()
    perms = db.scalars(
        select(Permission).where(Permission.name.in_([USER_VIEW, "user-update"]))
    ).all()
    if len(perms) < 2:
        db.close()
        pytest.skip("permissions are not seeded")

    suffix = uuid.uuid4().hex[:8]
    role = Role(name=f"ZZTestEditor{suffix}", display_name="Test editor", is_system=False)
    role.permissions = list(perms)
    user = User(
        email=f"zz-editor-{suffix}@example.com",
        password=hash_password(PASSWORD),
        first_name="Eddie",
        last_name="Editor",
        account_type="internal",
        status="ACTIVE",
        auth_provider="password",
    )
    db.add(role)
    db.flush()
    user.roles.append(role)
    db.add(user)
    db.commit()
    email, user_id, role_id = user.email, user.id, role.id
    db.close()

    yield {"email": email, "id": user_id}

    db = SessionLocal()
    target = db.get(User, user_id)
    if target:
        target.roles = []
        db.delete(target)
    role_row = db.get(Role, role_id)
    if role_row:
        db.delete(role_row)
    db.commit()
    db.close()


@pytest.fixture
def bystander():
    """A plain account the editor has no relationship to whatsoever."""
    db = SessionLocal()
    suffix = uuid.uuid4().hex[:8]
    user = User(
        email=f"zz-bystander-{suffix}@example.com",
        password=hash_password(PASSWORD),
        first_name="Bea",
        last_name="Bystander",
        account_type="internal",
        status="ACTIVE",
        auth_provider="password",
    )
    db.add(user)
    db.commit()
    user_id = user.id
    db.close()

    yield user_id

    db = SessionLocal()
    row = db.get(User, user_id)
    if row:
        db.delete(row)
    db.commit()
    db.close()


@pytest.fixture
def grant_factory():
    """Insert grants directly and remove them afterwards.

    Direct rows rather than `create_grant`: that function carries the
    self-elevation guard this file is not testing, and going through it would
    make every setup here depend on a rule that is deliberately restrictive.
    """
    created: list[str] = []

    def _make(grantee_id: str, subject_id: str, level: str) -> str:
        db = SessionLocal()
        row = DataAccessGrant(
            grantee_id=grantee_id,
            subject_id=subject_id,
            scope="*",
            access_level=level,
        )
        db.add(row)
        db.commit()
        created.append(row.id)
        db.close()
        return row.id

    yield _make

    db = SessionLocal()
    for grant_id in created:
        row = db.get(DataAccessGrant, grant_id)
        if row:
            db.delete(row)
    db.commit()
    db.close()


class TestAWriteCannotReachARowTheActorCannotSee:
    """**The privilege-escalation path, from the attacker's side.**

    An editor who sees only themselves in the list must not be able to write
    anybody else. The dangerous field is `email`: `status`, `role_ids` and
    `account_type` are all admin-gated, and `email` is not — so changing a
    stranger's address and then driving a password reset to it was a takeover
    that needed no admin role at any point.
    """

    def test_patching_a_bystander_is_404_not_403(self, editor, bystander):
        db = SessionLocal()
        try:
            actor = db.get(User, editor["id"])
            with pytest.raises(HTTPException) as excinfo:
                user_service.update_user(
                    db, bystander, UpdateUserRequest(first_name="Owned"), actor
                )
            assert excinfo.value.status_code == 404, (
                "a non-admin just wrote (or was told about) an account it cannot see"
            )
        finally:
            db.close()

    def test_the_bystander_row_is_untouched(self, editor, bystander):
        """The refusal has to happen before any mutation, not after."""
        db = SessionLocal()
        try:
            actor = db.get(User, editor["id"])
            with pytest.raises(HTTPException):
                user_service.update_user(
                    db, bystander, UpdateUserRequest(first_name="Owned"), actor
                )
            db.rollback()
            assert db.get(User, bystander).first_name == "Bea"
        finally:
            db.close()

    def test_editing_your_own_record_still_works(self, editor):
        """The guard must not lock an ordinary account out of itself.

        This is why `get_writable_user_or_404` names `self` explicitly rather than
        leaning on `manageable_user_ids`, which returns `[]` for a non-delegate.
        """
        db = SessionLocal()
        try:
            actor = db.get(User, editor["id"])
            updated = user_service.update_user(
                db, editor["id"], UpdateUserRequest(first_name="Edwina"), actor
            )
            assert updated.first_name == "Edwina"
        finally:
            db.rollback()
            db.close()

    def test_a_bulk_operation_cannot_reach_it_either(self, editor, bystander):
        """Bulk paths loaded targets through their own query, so fixing the
        single-target paths alone would have left the same hole with an `s`."""
        db = SessionLocal()
        try:
            actor = db.get(User, editor["id"])
            affected, skipped, reasons = user_service.bulk_set_status(
                db, [bystander], "INACTIVE", actor
            )
            assert affected == 0
            assert skipped == 1
            assert reasons and "not found" in reasons[0], reasons
            assert db.get(User, bystander).status == "ACTIVE"
        finally:
            db.rollback()
            db.close()


class TestViewAndManageGrantsDifferOnWrites:
    """A `manage` grant has to mean something more than a `view` grant.

    Both helpers exercised here — `manageable_user_ids` and `can_manage_data_of`
    — were written, tested against the reference, and called by **nothing** until
    this change, which meant the two access levels were indistinguishable
    wherever it counted. An administrator could create a manage grant, see it
    listed as active, and it changed nothing.
    """

    def test_a_view_grant_opens_the_detail_but_not_the_write(
        self, editor, bystander, grant_factory
    ):
        grant_factory(editor["id"], bystander, "view")
        db = SessionLocal()
        try:
            actor = db.get(User, editor["id"])

            # Readable — and this is a fix in its own right. The detail route
            # used to refuse any id but your own, so a granted subject appeared
            # in the list and 404'd the moment it was clicked.
            assert user_service.get_visible_user_or_404(db, bystander, actor).id == bystander

            # Not writable: `view` is not `manage`.
            with pytest.raises(HTTPException) as excinfo:
                user_service.update_user(
                    db, bystander, UpdateUserRequest(first_name="Nope"), actor
                )
            assert excinfo.value.status_code == 403, (
                "403 rather than 404 here on purpose — the actor can already see "
                "this row, so refusing with 404 would be a lie rather than a "
                "non-disclosure"
            )
        finally:
            db.rollback()
            db.close()

    def test_a_manage_grant_permits_the_write(self, editor, bystander, grant_factory):
        grant_factory(editor["id"], bystander, "manage")
        db = SessionLocal()
        try:
            actor = db.get(User, editor["id"])
            updated = user_service.update_user(
                db, bystander, UpdateUserRequest(first_name="Managed"), actor
            )
            assert updated.first_name == "Managed"
        finally:
            db.rollback()
            db.close()


class TestTheTenantWallBeatsAGrant:
    """**A grant may widen visibility within a tenant, never across one.**

    `data_access_service`'s docstring has stated that rule since the module
    shipped and nothing enforced it: `accessible_user_ids` never consults the
    organisation, and `create_grant` checks self-elevation but not tenancy. So one
    admin-written grant spanning two organisations produced a genuine cross-tenant
    read — the exact disclosure the directory's 404 rule exists to prevent.
    """

    @pytest.fixture
    def two_organisations(self):
        from app.models.partner import Partner

        db = SessionLocal()
        suffix = uuid.uuid4().hex[:8]
        orgs = []
        for label in ("alpha", "beta"):
            org = Partner(
                name=f"ZZ Test {label} {suffix}",
                slug=f"zz-test-{label}-{suffix}",
                status="ACTIVE",
            )
            db.add(org)
            orgs.append(org)
        db.flush()

        members = []
        for org, label in zip(orgs, ("alpha", "beta")):
            member = User(
                email=f"zz-{label}-{suffix}@example.com",
                password=hash_password(PASSWORD),
                first_name=label.title(),
                last_name="Member",
                account_type="external",
                status="ACTIVE",
                auth_provider="password",
                organisation_id=org.id,
            )
            db.add(member)
            members.append(member)
        db.commit()

        ids = {
            "alpha_user": members[0].id,
            "beta_user": members[1].id,
            "org_ids": [orgs[0].id, orgs[1].id],
        }
        db.close()

        yield ids

        db = SessionLocal()
        for key in ("alpha_user", "beta_user"):
            row = db.get(User, ids[key])
            if row:
                row.roles = []
                db.delete(row)
        db.commit()
        for org_id in ids["org_ids"]:
            row = db.get(Partner, org_id)
            if row:
                db.delete(row)
        db.commit()
        db.close()

    def test_a_cross_organisation_grant_does_not_expose_the_row(
        self, two_organisations, grant_factory
    ):
        grant_factory(
            two_organisations["alpha_user"], two_organisations["beta_user"], "view"
        )
        db = SessionLocal()
        try:
            actor = db.get(User, two_organisations["alpha_user"])
            with pytest.raises(HTTPException) as excinfo:
                user_service.get_visible_user_or_404(
                    db, two_organisations["beta_user"], actor
                )
            assert excinfo.value.status_code == 404
        finally:
            db.close()

    def test_the_list_excludes_it_too(self, two_organisations, grant_factory):
        """The detail refusal and the list filter must agree, or the count is a
        disclosure of its own."""
        grant_factory(
            two_organisations["alpha_user"], two_organisations["beta_user"], "view"
        )
        db = SessionLocal()
        try:
            actor = db.get(User, two_organisations["alpha_user"])
            rows, _total = user_service.list_users(db, actor)
            assert two_organisations["beta_user"] not in {row.id for row in rows}
        finally:
            db.close()

    def test_the_grant_still_works_inside_one_organisation(
        self, two_organisations, grant_factory
    ):
        """The wall must narrow across tenants and not break delegation within
        one — otherwise this would be a feature switched off rather than fixed."""
        db = SessionLocal()
        suffix = uuid.uuid4().hex[:8]
        colleague = User(
            email=f"zz-colleague-{suffix}@example.com",
            password=hash_password(PASSWORD),
            first_name="Cass",
            last_name="Colleague",
            account_type="external",
            status="ACTIVE",
            auth_provider="password",
            organisation_id=db.get(User, two_organisations["alpha_user"]).organisation_id,
        )
        db.add(colleague)
        db.commit()
        colleague_id = colleague.id
        db.close()

        grant_factory(two_organisations["alpha_user"], colleague_id, "view")
        db = SessionLocal()
        try:
            actor = db.get(User, two_organisations["alpha_user"])
            found = user_service.get_visible_user_or_404(db, colleague_id, actor)
            assert found.id == colleague_id
        finally:
            row = db.get(User, colleague_id)
            if row:
                db.delete(row)
            db.commit()
            db.close()

    def test_a_member_of_one_organisation_cannot_read_another(self, two_organisations):
        """The other half of T4: `users` is not the only scoped table.

        `Partner` is the canonical tenant row — a partner *is* the organisation —
        and `partner_service.get_partner_for` goes through
        `scoping.assert_can_read`. This exercises it with a genuinely
        authenticated wrong-tenant caller, which is the case
        `test_route_enforcement.py` does not cover: that suite proves a
        *stranger* is refused, not a valid session from the wrong organisation.
        """
        from app.services import partner_service

        db = SessionLocal()
        try:
            actor = db.get(User, two_organisations["alpha_user"])
            own, other = two_organisations["org_ids"]

            assert partner_service.get_partner_for(db, own, actor).id == own

            with pytest.raises(HTTPException) as excinfo:
                partner_service.get_partner_for(db, other, actor)
            assert excinfo.value.status_code == 404, (
                "a partner user reached another organisation's row — or was told "
                "it exists, which is the disclosure the 404 rule prevents"
            )
        finally:
            db.close()


class TestTheDelegationGraphIsNotPublicToStaff:
    """`list_grants` returned every grant to any `data-access-view` holder.

    **Staff holds that permission**, so an ordinary internal role could read who
    has been given access to whom across the whole installation — an
    organisational chart of trust. Faithful to the reference, which is why it was
    flagged (2026-08-13) rather than silently changed, and closed here.
    """

    def test_a_non_admin_sees_only_grants_it_is_a_party_to(
        self, viewer, bystander, grant_factory
    ):
        from app.services import data_access_service as das

        # One grant the viewer is party to, one entirely unrelated to it.
        grant_factory(viewer["id"], bystander, "view")

        db = SessionLocal()
        suffix = uuid.uuid4().hex[:8]
        third = User(
            email=f"zz-third-{suffix}@example.com",
            password=hash_password(PASSWORD),
            first_name="Thea",
            last_name="Third",
            account_type="internal",
            status="ACTIVE",
            auth_provider="password",
        )
        db.add(third)
        db.commit()
        third_id = third.id
        db.close()

        grant_factory(third_id, bystander, "view")

        db = SessionLocal()
        try:
            actor = db.get(User, viewer["id"])
            rows, _total = das.list_grants(db, actor)
            outsiders = [
                g for g in rows
                if actor.id not in (g.grantee_id, g.subject_id)
            ]
            assert outsiders == [], (
                f"{len(outsiders)} grant(s) between other people were visible to "
                "a non-admin — that is the delegation graph leaking"
            )
            assert rows, "the viewer's own grant should still be listed"
        finally:
            row = db.get(User, third_id)
            if row:
                db.delete(row)
            db.commit()
            db.close()

    def test_being_the_subject_counts_as_being_a_party(self, viewer, grant_factory):
        """"Who can see my records" is a question you should be able to answer
        about yourself; hiding it would make delegation feel like surveillance."""
        from app.services import data_access_service as das

        db = SessionLocal()
        suffix = uuid.uuid4().hex[:8]
        grantee = User(
            email=f"zz-grantee-{suffix}@example.com",
            password=hash_password(PASSWORD),
            first_name="Gary",
            last_name="Grantee",
            account_type="internal",
            status="ACTIVE",
            auth_provider="password",
        )
        db.add(grantee)
        db.commit()
        grantee_id = grantee.id
        db.close()

        grant_factory(grantee_id, viewer["id"], "view")

        db = SessionLocal()
        try:
            actor = db.get(User, viewer["id"])
            rows, _total = das.list_grants(db, actor)
            assert any(g.subject_id == actor.id for g in rows), (
                "a grant OVER the actor's own records was hidden from them"
            )
        finally:
            row = db.get(User, grantee_id)
            if row:
                db.delete(row)
            db.commit()
            db.close()


@pytest.fixture(scope="module")
def two_organisations_with_logins():
    """Two organisations, each with a member who can actually call the API.

    Distinct from `TestTheTenantWallBeatsAGrant.two_organisations`, which builds
    members with **no roles**. That is right for a service-level test, where the
    permission gate is not in the path — but over HTTP a member with no
    permissions is refused by `require_permission` before scoping is ever
    consulted, and a 403 from the wrong layer would make this suite pass while
    proving nothing.

    So each member here holds a **custom role** carrying exactly what the shipped
    `Partner` role holds of these: `partner-view` and `organisation-manage`.
    Custom on purpose: `has_admin_access` is derived from role *names*, so a role
    with real permissions and an unrecognised name still scopes like a
    non-admin — which is the account shape the tenant wall exists for, and the
    shape a seeded roster never contains.

    ⚠️ **`partner-update` is deliberately NOT granted here.** An earlier draft of
    this fixture did grant it, to drive a cross-tenant *write* test, and that
    turned out to be testing a configuration that does not exist: `partner-update`
    means "staff may edit **any** partner", it is reachable only through the four
    wildcard admin roles, and no account holding it belongs to an organisation.
    Granting it to an in-organisation account invented the vulnerability the test
    then found. The real contract is asserted below instead, and the invariant
    that keeps it true is pinned in `test_partner_write_permissions.py`.
    """
    from app.models.partner import Partner

    db = SessionLocal()
    wanted = [PARTNER_VIEW, ORGANISATION_MANAGE]
    perms = db.scalars(select(Permission).where(Permission.name.in_(wanted))).all()
    if len(perms) != len(wanted):
        db.close()
        pytest.skip(f"{', '.join(wanted)} are not seeded")

    suffix = uuid.uuid4().hex[:8]
    orgs, members, roles = [], [], []
    for label in ("alpha", "beta"):
        org = Partner(
            name=f"ZZ Wall {label} {suffix}",
            slug=f"zz-wall-{label}-{suffix}",
            status="ACTIVE",
        )
        db.add(org)
        orgs.append(org)
    db.flush()

    for org, label in zip(orgs, ("alpha", "beta")):
        role = Role(
            name=f"ZZWall{label.title()}{suffix}",
            display_name=f"Test {label} member",
            is_system=False,
        )
        role.permissions = list(perms)
        db.add(role)
        db.flush()
        roles.append(role)

        member = User(
            email=f"zz-wall-{label}-{suffix}@example.com",
            password=hash_password(PASSWORD),
            first_name=label.title(),
            last_name="Member",
            account_type="external",
            status="ACTIVE",
            auth_provider="password",
            organisation_id=org.id,
        )
        member.roles.append(role)
        db.add(member)
        members.append(member)
    db.commit()

    ids = {
        "alpha_email": members[0].email,
        "alpha_org": orgs[0].id,
        "beta_org": orgs[1].id,
        "user_ids": [members[0].id, members[1].id],
        "role_ids": [roles[0].id, roles[1].id],
    }
    db.close()

    yield ids

    db = SessionLocal()
    for user_id in ids["user_ids"]:
        row = db.get(User, user_id)
        if row:
            row.roles = []
            db.delete(row)
    db.commit()
    for role_id in ids["role_ids"]:
        row = db.get(Role, role_id)
        if row:
            db.delete(row)
    for org_id in (ids["alpha_org"], ids["beta_org"]):
        row = db.get(Partner, org_id)
        if row:
            db.delete(row)
    db.commit()
    db.close()


class TestTheTenantWallHoldsOverHTTP:
    """**The suite PM-11 names as missing** — `CORE_EXTRACTION_PLAN.md` § 3.7.

    `test_route_enforcement.py` proves a **stranger** is refused: it calls every
    route unauthenticated and expects 401/403. Its own docstring says what it
    does not cover, and this is it — *a valid session from the wrong
    organisation*. That caller passes authentication, passes the permission
    check, and is stopped only by row scoping. Nothing exercised that over HTTP.

    The service layer was already covered (`get_partner_for` through
    `assert_can_read`, above). The gap was the route: a handler that forgot to
    pass `actor` through, or a response model that leaked a field before scoping
    ran, would not have been caught by either suite.

    **404 and never 403.** A 403 confirms the organisation exists, which is the
    enumeration leak the whole "not found, not forbidden" rule exists to close —
    and it is the assertion most likely to be quietly relaxed by someone
    debugging a permissions problem, which is why the reason is written here.
    """

    def _login_as_alpha(self, client, ids):
        login = client.post(
            "/api/v1/auth/login",
            json={"email": ids["alpha_email"], "password": PASSWORD},
        )
        assert login.status_code == 200, login.text

    def test_reading_another_organisation_is_404_and_your_own_is_200(
        self, client, two_organisations_with_logins
    ):
        ids = two_organisations_with_logins
        self._login_as_alpha(client, ids)
        try:
            other = client.get(f"/api/v1/partners/{ids['beta_org']}")
            assert other.status_code == 404, (
                f"expected 404, got {other.status_code}: an authenticated member "
                "of one organisation just read another organisation's record "
                "over HTTP"
            )

            # The positive half matters as much: a route that 404s for everyone
            # would pass the assertion above while being completely broken.
            own = client.get(f"/api/v1/partners/{ids['alpha_org']}")
            assert own.status_code == 200, own.text
            assert own.json()["id"] == ids["alpha_org"]
        finally:
            client.post("/api/v1/auth/logout")

    def test_the_index_does_not_list_the_other_organisation(
        self, client, two_organisations_with_logins
    ):
        """Scoping has to hold on the *list* as well as the detail.

        A detail route that refuses correctly while the index leaks the same row
        is a common shape, because the two go through different code paths — and
        the index is the one that leaks names and slugs in bulk.
        """
        ids = two_organisations_with_logins
        self._login_as_alpha(client, ids)
        try:
            listed = client.get("/api/v1/partners", params={"per_page": 100})
            assert listed.status_code == 200, listed.text
            returned = {row["id"] for row in listed.json()["items"]}
            assert ids["beta_org"] not in returned, (
                "the partners index returned another organisation's row to a "
                "non-admin member"
            )
            assert ids["alpha_org"] in returned, (
                "the member cannot see their own organisation, so this test is "
                "asserting nothing"
            )
        finally:
            client.post("/api/v1/auth/logout")

    def test_the_id_taking_write_is_closed_to_a_partner_by_permission(
        self, client, two_organisations_with_logins
    ):
        """The write surface is closed one layer earlier than the read surface.

        `PATCH /partners/{id}` requires `partner-update`, which means "staff may
        edit any partner" and which **no in-organisation role holds** — so a
        partner account is refused at the permission gate, before scoping is
        reached. Hence 403 here and 404 above: the read is a row this actor may
        not *see*, the write is a capability this actor does not *have*.

        That asymmetry is the finding this suite produced, and it is worth
        stating rather than smoothing over: `can_edit()` applies **no tenancy
        narrowing at all** — unlike `can_delete`, `can_change_status` and
        `can_verify`, which each refuse the actor's own organisation. Today that
        is safe, because the permission is admin-only by design. It stops being
        safe the moment `partner-update` is granted to any role whose members sit
        inside an organisation, and at that point the read path would refuse what
        the write path allowed. `test_partner_write_permissions.py` fails if that
        grant is ever added; see TECH_DEBT PM-46.

        The partner's own editing route is `PATCH /partners/me`, which resolves
        the organisation from the session and takes no id — so there is no
        cross-tenant write to test there, by design.
        """
        from app.models.partner import Partner

        ids = two_organisations_with_logins

        db = SessionLocal()
        before = db.get(Partner, ids["beta_org"]).name
        db.close()

        self._login_as_alpha(client, ids)
        try:
            written = client.patch(
                f"/api/v1/partners/{ids['beta_org']}",
                json={"name": "Renamed by the wrong tenant"},
            )
            assert written.status_code == 403, (
                f"expected 403 (no partner-update), got {written.status_code}. "
                "A 200 would mean a partner account can edit another "
                "organisation; a 404 would mean the permission gate moved and "
                "this test no longer proves what it claims."
            )
        finally:
            client.post("/api/v1/auth/logout")

        # The status code and the database are separate claims: a handler could
        # refuse *after* committing, so the row is re-read rather than inferred.
        db = SessionLocal()
        after = db.get(Partner, ids["beta_org"]).name
        db.close()
        assert after == before, "the refused write still changed the row"
