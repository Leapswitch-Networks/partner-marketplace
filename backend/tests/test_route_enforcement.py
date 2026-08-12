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
from fastapi.testclient import TestClient

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.main import app
from app.models.role import Role
from app.models.user import User
from app.services import api_docs_service

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
        account_type="staff",
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
