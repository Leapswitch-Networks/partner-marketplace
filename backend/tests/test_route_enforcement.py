"""Every route is gated, a session round trip works, and the chain has one head.

`DEPLOYMENT.md` § 0 blocker 2 names exactly what the suite did not cover and what
*"a deploy most needs proven"*: **RBAC enforcement across the routes, a login
round trip, and migrations.** Everything else here is a unit test of a rule; this
is the app answering an HTTP request.

Marked `db` — these need a real database, which is what `pytest -m "not db"`
exists to skip and what the CI postgres service now provides.

## Why the first test walks every route rather than a chosen few

A hand-picked list only ever covers the routes someone remembered. This asks the
running application for its own route table and checks all of them, so an
endpoint added next week is covered the moment it exists — including the case
that matters, which is the one nobody thought to add to a list.
"""

import uuid

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.core.permissions import all_permission_names
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.main import app
from app.models.role import Role
from app.models.user import User
from app.models.user_invitation import UserInvitation
from app.schemas.rbac import CreateInvitationRequest
from app.services import api_docs_service, invitation_service

pytestmark = pytest.mark.db

PASSWORD = "TestOnly@12345"

#: Substituted into `{param}` segments. The value never resolves to a real
#: record, which is the point: an unauthenticated caller must be refused before
#: the handler ever looks anything up, so a 404 here would mean the lookup ran.
DUMMY = "00000000-0000-0000-0000-000000000000"


def concrete(path: str) -> str:
    """`/users/{user_id}` -> `/users/00000000-…`."""
    out = []
    for segment in path.split("/"):
        out.append(DUMMY if segment.startswith("{") and segment.endswith("}") else segment)
    return "/".join(out)


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def plain_user():
    """A real, active account holding a role with **no permissions at all**.

    Created rather than looked up: CI starts from an empty database, and a test
    that depends on a seeded roster passes locally and fails on the runner.
    """
    db = SessionLocal()
    suffix = uuid.uuid4().hex[:8]
    role = Role(name=f"ZZTestNoPerms{suffix}", display_name="Test role", is_system=False)
    user = User(
        email=f"zz-test-{suffix}@example.com",
        password=hash_password(PASSWORD),
        first_name="Zed",
        last_name="Tester",
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


class TestNoRouteIsOpenByAccident:
    """The blocker in one assertion: nothing permission-gated answers a stranger."""

    def test_every_gated_route_refuses_an_unauthenticated_caller(self, client):
        """**The test DEPLOYMENT § 0 asked for.**

        Walks the application's own route table and calls every route that
        declares a permission, with no credentials. Any 2xx is a route serving
        data to the internet.

        A 404 or 422 is a *failure* here too, not a pass: both mean the request
        reached the handler and it looked something up or validated a body before
        anyone checked who was asking.
        """
        catalogue = api_docs_service.build_catalogue(app)
        gated = [op for op in catalogue if op.permissions]
        assert len(gated) > 80, "the catalogue looks wrong, not the routes"

        leaked = []
        for op in gated:
            response = client.request(op.method, concrete(op.path), json={})
            if response.status_code not in (401, 403):
                leaked.append(f"{op.method} {op.path} -> {response.status_code}")

        assert leaked == [], "these answered without credentials: " + ", ".join(leaked[:10])

    def test_authenticated_but_unprivileged_is_refused(self, client, plain_user):
        """Being signed in is not being allowed.

        The account holds a role with no permissions, so every gated route must
        answer 403 — the check that separates authentication from authorization,
        and the one a "just make it work" change quietly removes.
        """
        login = client.post(
            "/api/v1/auth/login",
            json={"email": plain_user["email"], "password": PASSWORD},
        )
        assert login.status_code == 200, login.text

        catalogue = api_docs_service.build_catalogue(app)
        # A read-only sample: this test signs in, so a DELETE that slipped
        # through would delete something.
        sample = [
            op for op in catalogue if op.permissions and op.method == "GET"
        ][:25]
        assert sample, "no gated GET routes found"

        allowed = []
        for op in sample:
            response = client.request(op.method, concrete(op.path))
            if response.status_code == 200:
                allowed.append(f"{op.method} {op.path}")

        client.post("/api/v1/auth/logout")
        assert allowed == [], "a role with no permissions reached: " + ", ".join(allowed)


class TestTheLoginRoundTrip:
    """Sign in, be recognised, sign out, stop being recognised."""

    def test_the_whole_cycle(self, client, plain_user):
        # Anonymous
        assert client.get("/api/v1/auth/me").status_code == 401

        # Sign in — the cookie is httpOnly, so the client jar is the only proof
        # it exists, which is exactly how the browser sees it.
        login = client.post(
            "/api/v1/auth/login",
            json={"email": plain_user["email"], "password": PASSWORD},
        )
        assert login.status_code == 200, login.text

        me = client.get("/api/v1/auth/me")
        assert me.status_code == 200
        assert me.json()["email"] == plain_user["email"]

        # Sign out
        assert client.post("/api/v1/auth/logout").status_code in (200, 204)
        assert client.get("/api/v1/auth/me").status_code == 401

    def test_a_wrong_password_is_refused_and_says_nothing_useful(self, client, plain_user):
        response = client.post(
            "/api/v1/auth/login",
            json={"email": plain_user["email"], "password": "definitely-not-it"},
        )
        assert response.status_code in (401, 422)
        body = response.text.lower()
        # Must not distinguish "no such account" from "wrong password": that
        # difference is an account-enumeration oracle.
        assert "not found" not in body and "no such" not in body

    def test_an_unknown_address_answers_the_same_way(self, client):
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "nobody-here@example.com", "password": PASSWORD},
        )
        assert response.status_code in (401, 422)


class TestTheMigrationChain:
    def test_there_is_exactly_one_head(self):
        """Two heads is the failure mode of parallel work on Alembic, and it is
        silent until someone runs `upgrade` — which, on a deploy, is the worst
        possible moment to find out."""
        from alembic.config import Config
        from alembic.script import ScriptDirectory

        config = Config("alembic.ini")
        heads = ScriptDirectory.from_config(config).get_heads()
        assert len(heads) == 1, f"the chain has branched: {heads}"

    def test_the_database_matches_the_models(self):
        """Every mapped table exists in the database it is pointed at.

        Not a full autogenerate diff — that reports pre-existing column drift
        this project already knows about. This is the coarser question a deploy
        actually asks: did a migration for this model ever run?
        """
        from sqlalchemy import inspect

        import app.models  # noqa: F401 - registers every mapper
        from app.db.base import Base

        db = SessionLocal()
        try:
            present = set(inspect(db.get_bind()).get_table_names())
        finally:
            db.close()

        missing = sorted(set(Base.metadata.tables) - present)
        assert missing == [], f"models with no table: {missing}"


class TestAnInvitationCannotOutrankItsSender:
    """The privilege ceiling, applied to invitations.

    Found by the parity audit on 2026-08-12, by probing rather than reading:
    **Staff holds `invitation-create` and could invite a new Admin** — every
    permission in the catalogue — because the super-admin guard covered RootUser
    and SuperAdmin and nothing covered the rest.

    `rbac_service` had already written the rule down for editing a role: *"the
    escalation is in the payload"*, which a route guard cannot catch because the
    actor legitimately holds the permission the route requires. An invitation is
    that same escalation with a delay on it — whoever accepts arrives holding
    whatever `role_id` said.
    """

    @pytest.fixture
    def staff_actor(self):
        db = SessionLocal()
        suffix = uuid.uuid4().hex[:8]
        staff_role = db.scalar(select(Role).where(Role.name == "Staff"))
        user = User(
            email=f"zz-ceiling-{suffix}@example.com",
            password=hash_password(PASSWORD),
            first_name="Ceil",
            last_name="Tester",
            account_type="internal",
            status="ACTIVE",
            auth_provider="password",
        )
        user.roles.append(staff_role)
        db.add(user)
        db.commit()
        db.refresh(user)
        yield db, user
        db.execute(delete(UserInvitation).where(UserInvitation.email.like("zz-ceiling-%")))
        user.roles = []
        db.delete(user)
        db.commit()
        db.close()

    @pytest.mark.parametrize("role_name", ["Admin", "SuperAdmin", "RootUser"])
    def test_staff_cannot_invite_a_role_it_does_not_hold(self, staff_actor, role_name):
        db, actor = staff_actor
        role = db.scalar(select(Role).where(Role.name == role_name))
        with pytest.raises(HTTPException) as exc:
            invitation_service.create_invitation(
                db,
                CreateInvitationRequest(
                    email=f"zz-ceiling-target-{role_name}@example.com", role_id=role.id
                ),
                actor,
            )
        assert exc.value.status_code == 403

    @pytest.mark.parametrize("role_name", ["Staff", "User"])
    def test_staff_can_still_invite_within_its_own_privilege(self, staff_actor, role_name):
        """The ceiling must not turn into "nobody may invite anyone" — Staff is
        described as a role that invites users, and it still can."""
        db, actor = staff_actor
        role = db.scalar(select(Role).where(Role.name == role_name))
        invitation, _url = invitation_service.create_invitation(
            db,
            CreateInvitationRequest(
                email=f"zz-ceiling-ok-{role_name}@example.com", role_id=role.id
            ),
            actor,
        )
        assert invitation.id
        db.execute(delete(UserInvitation).where(UserInvitation.id == invitation.id))
        db.commit()

    def test_a_super_admin_is_unaffected(self):
        """`has_permission` returns True for a super admin, so the ceiling
        narrows nobody who could already grant the same access directly."""
        db = SessionLocal()
        try:
            root = db.scalars(
                select(User).join(User.roles).where(Role.name == "RootUser")
            ).first()
            if root is None:
                pytest.skip("no RootUser account seeded in this database")
            admin_role = db.scalar(select(Role).where(Role.name == "Admin"))
            invitation, _ = invitation_service.create_invitation(
                db,
                CreateInvitationRequest(
                    email=f"zz-ceiling-root-{uuid.uuid4().hex[:6]}@example.com",
                    role_id=admin_role.id,
                ),
                root,
            )
            assert invitation.id
            db.execute(delete(UserInvitation).where(UserInvitation.id == invitation.id))
            db.commit()
        finally:
            db.close()


class TestTheEnforcementMatrixIsPinned:
    """**Which routes are ungated is a decision, so it is written down.**

    `TestNoRouteIsOpenByAccident` proves that everything *declaring* a permission
    refuses a stranger. It cannot see the failure that matters more: a route
    shipped with **no guard at all**. That route declares no permission, so it is
    not in that test's sample, and the suite stays green while the endpoint answers
    the internet.

    This closes it by inverting the question. Rather than testing the gated
    routes, it pins the ungated ones. Adding a public endpoint now means editing a
    list in a test file with `SECURITY` in the assertion message, which is a
    conversation; forgetting a guard means a red build.

    Two tiers, because "ungated" is two different decisions:

    | Tier | Means | Example |
    |---|---|---|
    | `PUBLIC` | no credentials at all | `POST /auth/login`, `GET /settings/branding` |
    | `AUTH_ONLY` | signed in, no specific permission | `GET /auth/me` — the subject is the caller |

    `AUTH_ONLY` is legitimate for two shapes and no others: routes acting on the
    caller's **own** account (`/auth/me/…`, where a permission would be asking
    whether you may administer yourself), and routes whose authority is checked in
    the body rather than declared — the branding writes are gated on
    `require_super_admin`, which `api_docs_service.ENFORCED_ELSEWHERE` records and
    verifies. Anything else appearing here is a missing `require_permission`.
    """

    #: No credentials required. Every entry is either the login/recovery surface
    #: (which cannot require a session to obtain one) or deliberately public
    #: branding read for the sign-in screen.
    PUBLIC: frozenset[tuple[str, str]] = frozenset({
        ("POST", "/api/v1/auth/accept-invitation"),
        ("POST", "/api/v1/auth/forgot-password"),
        ("GET", "/api/v1/auth/google/authorize"),
        ("GET", "/api/v1/auth/google/callback"),
        ("GET", "/api/v1/auth/google/redirect"),
        ("POST", "/api/v1/auth/login"),
        ("POST", "/api/v1/auth/logout"),
        ("POST", "/api/v1/auth/refresh"),
        ("POST", "/api/v1/auth/register"),
        ("POST", "/api/v1/auth/resend-verification"),
        ("POST", "/api/v1/auth/reset-password"),
        ("POST", "/api/v1/auth/two-factor-challenge"),
        ("POST", "/api/v1/auth/verify-email"),
        # Reads an invitation by TOKEN, which is the credential. An invitee has no
        # account yet, so requiring one would make the link unusable.
        ("GET", "/api/v1/invitations/preview"),
        # ── The public directory — DIRECTORY_BUILD_PUNCHLIST Phase 2 ─────────
        #
        # SECURITY: these are the anonymous surface, and they are public on
        # purpose. What makes that safe is not the absence of a guard — it is
        # that every one returns a `Public*` response model from
        # `schemas/directory.py`, and those models **do not have** the internal
        # fields. A router here cannot leak `notes`, `gst_number`, `pan_number`
        # or `status` because its response type has no such attribute.
        #
        # Each read is additionally filtered to `is_listed AND ACTIVE` partners
        # and `PUBLISHED` listings, written into the query rather than delegated
        # to `apply_scope` — there is no principal here to scope against, so a
        # forgotten filter would serve everything.
        ("GET", "/api/v1/public/categories"),
        ("GET", "/api/v1/public/partners"),
        ("GET", "/api/v1/public/partners/{slug}"),
        ("GET", "/api/v1/public/listings"),
        ("GET", "/api/v1/public/listings/{slug}"),
        # SECURITY: the only unauthenticated WRITE in the application. Rate
        # limited in `core/rate_limit.py` (6/min per address) — that is the real
        # control, because the honeypot and the client throttle are both skipped
        # by anyone posting directly.
        ("POST", "/api/v1/public/enquiries"),
        # SECURITY: a capability URL. The unguessable reference IS the
        # credential — the buyer has no account, so requiring one would make
        # their own thread unreachable. Generated with `secrets`, `noindex`, and
        # excluded from the sitemap. There is deliberately no id-based variant.
        ("GET", "/api/v1/public/enquiries/{reference}"),

        # The sign-in screen renders branding before anybody is signed in.
        ("GET", "/api/v1/settings/branding"),
        ("GET", "/api/v1/settings/branding/themes"),
        ("GET", "/api/v1/settings/branding/{asset}"),
        ("GET", "/health"),
        ("GET", "/health/ready"),
    })

    #: Signed in, no declared permission. Everything under `/auth/me` acts on the
    #: caller's own account; the branding writes are gated on
    #: `require_super_admin` (see `ENFORCED_ELSEWHERE`); navigation and search
    #: return only what the caller may already see.
    AUTH_ONLY: frozenset[tuple[str, str]] = frozenset({
        ("GET", "/api/v1/auth/me"),
        ("PATCH", "/api/v1/auth/me"),
        ("POST", "/api/v1/auth/me/change-password"),
        ("POST", "/api/v1/auth/me/confirm-password"),
        ("POST", "/api/v1/auth/me/password-otp/send"),
        ("POST", "/api/v1/auth/me/password-otp/verify"),
        ("GET", "/api/v1/auth/me/sessions"),
        ("POST", "/api/v1/auth/me/sessions/revoke-others"),
        ("DELETE", "/api/v1/auth/me/sessions/{session_id}"),
        ("DELETE", "/api/v1/auth/me/two-factor"),
        ("GET", "/api/v1/auth/me/two-factor"),
        ("POST", "/api/v1/auth/me/two-factor"),
        ("POST", "/api/v1/auth/me/two-factor/confirm"),
        ("POST", "/api/v1/auth/me/two-factor/recovery-codes"),
        ("GET", "/api/v1/navigation"),
        ("GET", "/api/v1/search"),
        ("PUT", "/api/v1/settings/branding"),
        ("POST", "/api/v1/settings/branding/theme-preview"),
        ("DELETE", "/api/v1/settings/branding/{asset}"),
        ("POST", "/api/v1/settings/branding/{asset}"),
    })

    @pytest.fixture(scope="class")
    def catalogue(self):
        return api_docs_service.build_catalogue(app)

    def test_no_route_became_public_without_a_decision(self, catalogue):
        found = {(op.method, op.path) for op in catalogue if op.is_public}
        unexpected = sorted(found - self.PUBLIC)
        assert not unexpected, (
            "SECURITY: these routes require no credentials and are not on the "
            f"reviewed list: {unexpected}. Add `require_permission(...)`, or — if "
            "being public is genuinely intended — add it to PUBLIC here with the "
            "reason, so the decision is reviewable."
        )

    def test_no_route_became_auth_only_without_a_decision(self, catalogue):
        found = {
            (op.method, op.path)
            for op in catalogue
            if op.requires_auth and not op.permissions
        }
        unexpected = sorted(found - self.AUTH_ONLY)
        assert not unexpected, (
            "SECURITY: these routes are reachable by ANY signed-in account with no "
            f"permission check: {unexpected}. Unless the route acts on the caller's "
            "own record, or enforces its authority in the body (record it in "
            "`api_docs_service.ENFORCED_ELSEWHERE`), it needs a permission."
        )

    def test_the_pinned_lists_have_no_stale_entries(self, catalogue):
        """A pin for a route that no longer exists is a hole waiting to be reused.

        Delete an endpoint, add a different one at the same path later, and the
        stale pin silently exempts it.
        """
        live = {(op.method, op.path) for op in catalogue}
        stale = sorted((self.PUBLIC | self.AUTH_ONLY) - live)
        assert not stale, (
            f"pinned routes that no longer exist: {stale}. Remove them — a pin "
            "outliving its route exempts whatever is added at that path next."
        )

    def test_every_declared_permission_exists_in_the_catalog(self, catalogue):
        """A typo'd permission name is an ungated route with a guard on it.

        `has_permission("user-updat")` is False for everybody, so the route is
        merely broken — but the mirror case is the dangerous one, and both are
        caught by requiring every declared name to be a real one.
        """
        known = set(all_permission_names())
        unknown = sorted({
            perm
            for op in catalogue
            for perm in op.permissions
            if perm not in known
        })
        assert not unknown, f"routes declare permissions that do not exist: {unknown}"

    def test_the_three_tiers_account_for_every_route(self, catalogue):
        """No route falls between the categories, and the totals are stated so a
        large jump in either direction is visible in the diff."""
        gated = [op for op in catalogue if op.permissions]
        public = [op for op in catalogue if op.is_public]
        auth_only = [op for op in catalogue if op.requires_auth and not op.permissions]

        assert len(gated) + len(public) + len(auth_only) == len(catalogue)
        assert len(public) == len(self.PUBLIC)
        assert len(auth_only) == len(self.AUTH_ONLY)
        assert len(gated) > 100, (
            f"only {len(gated)} routes declare a permission, of {len(catalogue)} — "
            "that is a suspicious drop, not a refactor"
        )
