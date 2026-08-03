"""Seed a roster of team accounts with their roles.

The FastAPI equivalent of LeapDesk's `PermissionSeeder::createUsers()` — get the
team able to sign in on a fresh deployment without anyone editing the database by
hand.

Usage (from backend/):
    python -m app.db.seed_users                 # reads backend/seed_users.json
    SEED_USERS_FILE=/path/roster.json python -m app.db.seed_users

**One deliberate difference from LeapDesk, and it is not cosmetic.** Its seeder
holds the roster *in the source file*, including plaintext passwords
(`Root@123`, `Ayush@123`) and bcrypt digests of real people's passwords, next to
seven real `@leapswitch.com` addresses. That is defensible in a private
repository. **This repository is public** — committing it would publish working
credentials, offline-crackable hashes, and staff PII, which is the defect PM-4
existed to remove. So the *structure* lives here and the *values* live in a
gitignored JSON file.

**Second difference: an existing user's password is never touched.** LeapDesk
assigns `$user->password` on every run, so re-seeding silently resets everybody to
the hardcoded value — including anyone who had changed theirs. Here a pre-existing
account has its roles and profile synced and its credential left alone. Re-running
a seeder should be safe, and quietly resetting passwords is not.

Roster format — a JSON array:

    [
      {
        "first_name": "Ada",
        "last_name": "Lovelace",
        "email": "ada@example.com",
        "roles": ["Admin"],
        "status": "ACTIVE",              // optional, defaults to ACTIVE
        "account_type": "staff",         // optional, inferred from the domain
        "password": "..."                // optional; generated if omitted
      }
    ]

Omit `password` and one is generated and **printed once**. Supplying passwords in
the file is supported for a scripted bootstrap, but the file must stay out of git.
"""

from __future__ import annotations

import json
import os
import secrets
import sys
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.role import Role
from app.models.user import User

#: Where the roster lives. Gitignored — see `seed_users.example.json` for the shape.
ROSTER_ENV = "SEED_USERS_FILE"
DEFAULT_ROSTER = Path(__file__).resolve().parents[2] / "seed_users.json"

#: Length of a generated password, in bytes of entropy before base64 encoding.
_GENERATED_PASSWORD_BYTES = 12


def _load_roster(path: Path) -> list[dict]:
    if not path.exists():
        return []
    try:
        data = json.loads(path.read_text())
    except ValueError as exc:
        raise SystemExit(f"[seed] {path} is not valid JSON: {exc}")
    if not isinstance(data, list):
        raise SystemExit(f"[seed] {path} must contain a JSON array of user objects")
    return data


def _validate(entry: dict, index: int) -> None:
    """Fail loudly on a malformed entry rather than half-creating an account."""
    for field in ("first_name", "last_name", "email", "roles"):
        if not entry.get(field):
            raise SystemExit(f"[seed] roster entry #{index + 1} is missing {field!r}")
    if not isinstance(entry["roles"], list) or not entry["roles"]:
        raise SystemExit(f"[seed] roster entry #{index + 1}: 'roles' must be a non-empty array")


def seed_users(db: Session, roster: list[dict]) -> None:
    """Create or update the roster. Idempotent; never resets an existing password."""
    known_roles = {r.name: r for r in db.scalars(select(Role))}

    created: list[tuple[str, str]] = []   # (email, generated password)
    updated: list[str] = []

    for index, entry in enumerate(roster):
        _validate(entry, index)

        email = entry["email"].strip().lower()
        requested = entry["roles"]

        # Every named role must exist. Ported from LeapDesk's createRoles(), which
        # throws on a missing permission — the same reasoning applies to a missing
        # role: silently assigning fewer roles than asked for produces an account
        # that looks seeded and cannot do its job, and nobody notices until someone
        # reports a 403.
        missing = [name for name in requested if name not in known_roles]
        if missing:
            raise SystemExit(
                f"[seed] {email}: unknown role(s) {', '.join(missing)}. "
                f"Known roles: {', '.join(sorted(known_roles))}. "
                "Run `python -m app.db.seed_rbac` first."
            )

        user = db.scalar(select(User).where(User.email == email))

        if user is None:
            supplied = entry.get("password")
            password = supplied or secrets.token_urlsafe(_GENERATED_PASSWORD_BYTES)
            user = User(
                email=email,
                password=hash_password(password),
                first_name=entry["first_name"].strip(),
                last_name=entry["last_name"].strip(),
                account_type=entry.get(
                    "account_type",
                    "staff" if settings.is_staff_email(email) else "partner",
                ),
                status=entry.get("status", "ACTIVE"),
                # Seeded accounts are vouched for by whoever wrote the roster, so
                # they skip verification — the same call `create_user` makes for an
                # admin-created account.
                email_verified_at=datetime.now(timezone.utc),
                auth_provider="password",
            )
            db.add(user)
            if not supplied:
                created.append((email, password))
            else:
                created.append((email, "(from roster file)"))
        else:
            user.first_name = entry["first_name"].strip()
            user.last_name = entry["last_name"].strip()
            if entry.get("status"):
                user.status = entry["status"]
            # Password deliberately untouched. See the module docstring.
            updated.append(email)

        # Roles are SET, not appended, so removing a role from the roster actually
        # removes it. Permissions are never assigned directly to a user — this
        # schema has no user-permission table, so role-based access cannot be
        # bypassed the way LeapDesk warns about in its own seeder.
        user.roles = [known_roles[name] for name in requested]

    db.commit()

    for email, password in created:
        print(f"[seed] created {email}")
        if password != "(from roster file)":
            print(f"[seed]   GENERATED PASSWORD: {password}")
    for email in updated:
        print(f"[seed] updated {email} (roles and profile synced; password unchanged)")

    if created:
        print(
            "[seed] Generated passwords are shown ONCE and are not recoverable. "
            "Rotate them after first sign-in."
        )


def main() -> None:
    path = Path(os.environ.get(ROSTER_ENV, DEFAULT_ROSTER))
    roster = _load_roster(path)

    if not roster:
        print(f"[seed] no roster at {path} — nothing to do.")
        print(
            "[seed] Copy seed_users.example.json to seed_users.json and edit it. "
            "The real file is gitignored: this repository is public."
        )
        return

    db = SessionLocal()
    try:
        seed_users(db, roster)
        print(f"[seed] done — {len(roster)} roster entr{'y' if len(roster) == 1 else 'ies'} processed")
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
