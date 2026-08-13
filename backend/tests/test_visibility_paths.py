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
from app.main import app
from app.models.ai_conversation import AgentConversation
from app.models.permission import Permission
from app.models.role import Role
from app.models.user import User
from app.services import ai_service, invitation_service

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


def _somebody_else(db, not_id: str) -> User | None:
    return db.scalars(
        select(User).where(User.status == "ACTIVE", User.id != not_id)
    ).first()


class TestAnotherPersonsRecordIsNotFoundNotForbidden:
    """`GET /users/{id}` for a stranger's id must be a 404.

    A 403 would answer the question the caller was really asking — "does an
    account with this id exist?" — and a 200 would be the actual leak. The rule
    lives inline in the router (`api/users.py`), which is why no service-level
    test could cover it.
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
