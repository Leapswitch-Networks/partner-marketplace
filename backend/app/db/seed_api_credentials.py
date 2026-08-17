"""Seed the API credential VALUES for a fresh deployment.

The last hand-configuration step at go-live. `seed_api_providers` already writes
*which* providers exist and *what fields* each one declares; this fills those
fields in, so a deployment does not need somebody opening the Integrations screen
and pasting eleven secrets by hand.

Usage (from backend/):
    # environment variables — the normal way, works with Docker/K8s secrets
    SEED_CRED_ANTHROPIC_API_KEY=... python -m app.db.seed_api_credentials

    # or a JSON file you keep outside the repo
    SEED_API_CREDENTIALS_FILE=/run/secrets/creds.json python -m app.db.seed_api_credentials

    # see what would be written, touching nothing
    python -m app.db.seed_api_credentials --dry-run

## The one thing this file will never do

**It holds no credential, and it must never be changed to hold one.** The
reference's `ApiCredentialsSeeder.php` keeps every live secret inline — HostBill,
HubSpot, Google OAuth, four Slack integrations, SMTP, Google Calendar and Sheets,
Anthropic — which is defensible in a private repository. **This one is public.**

Copying those values here would republish working credentials for eleven
third-party systems into git history, forks and every secret-scanner that watches
public repositories, and the remedy afterwards is not `git rm` — it is rotating
all eleven. That is precisely the defect **PM-4** existed to remove ("seed
credentials in a public repo"), which was closed by taking `ROOT_PASSWORD` from
the environment and gitignoring the staff roster. `seed_users.py` carries the same
note for the same reason. Reintroducing it in a different file would reopen a
closed blocker.

So the shape is here and the values come from the deployment.

## Where values come from, in order

1. **`SEED_API_CREDENTIALS_FILE`** — a JSON object, if the variable is set:

       {"anthropic": {"api_key": "…"}, "slack": {"webhook_url": "…"}}

2. **Environment variables**, named `SEED_CRED_<SLUG>_<FIELD_KEY>` upper-cased:
   `SEED_CRED_GOOGLE_CLIENT_SECRET`, `SEED_CRED_MAIL_FROM_ADDRESS`, and so on.

Both may be used together; an environment variable wins over the file for the
same field, because that is the direction a deployment overrides a baked-in
default and never the reverse.

**A file inside this repository that git tracks is refused, not warned about.**
An operator who puts real secrets in `backend/creds.json` has done nothing wrong
until the next `git add -A`, and at that point a warning printed ten minutes ago
does not help. See `_reject_tracked_file`.

## What it writes, and what it leaves alone

Values go through `credential_service.create_credential` /
`update_credential` — never straight to the table. Those own encryption (per the
schema's `is_encrypted`), the uniqueness rule for one credential per provider per
environment, and the audit entry that records **which field keys** were set and
never their values. A seeder that reimplemented any of that would be a second
place for the encryption rule to live.

Three rules that make re-running safe:

* **A provider with no supplied values is skipped entirely** — no empty
  credential row, so the Integrations screen does not fill with half-configured
  providers nobody asked for.
* **A field not supplied is not touched.** Combined with the service's blank rule
  (a blank encrypted field means "leave the stored value alone"), re-running with
  only `SEED_CRED_SLACK_WEBHOOK_URL` set rotates the Slack webhook and leaves
  every other secret in place.
* **Placeholders are refused in production.** `settings.APP_ENV=production` plus a
  value that looks like `changeme` or `your-key-here` is a misconfiguration that
  would otherwise sit there looking configured. Rejected using the same
  `_looks_like_placeholder` rules `audit_environment` applies to `.env`.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.api_credential import ApiCredential, ApiServiceProvider
from app.models.user import User
from app.services import credential_service

#: Set this to a path OUTSIDE the repository to supply values as JSON.
#: Deliberately has no default: a default path inside `backend/` would invite
#: exactly the file this repository must never contain.
FILE_ENV = "SEED_API_CREDENTIALS_FILE"

#: `SEED_CRED_<SLUG>_<FIELD_KEY>`, upper-cased.
ENV_PREFIX = "SEED_CRED_"

#: Repository root, used only to decide whether a supplied file sits inside it.
_REPO_ROOT = Path(__file__).resolve().parents[3]


def _env_name(slug: str, field_key: str) -> str:
    """`("mail", "from_address")` -> `SEED_CRED_MAIL_FROM_ADDRESS`."""
    return f"{ENV_PREFIX}{slug.upper()}_{field_key.upper()}"


def _reject_tracked_file(path: Path) -> None:
    """Refuse a credentials file that git tracks. Raises `SystemExit`.

    The check is `git ls-files --error-unmatch`, which answers "is this path in
    the index" — the only question that matters. A file outside the repository, or
    inside it and untracked, is fine; a *tracked* one means the next commit
    publishes its contents.

    Failures to run git at all are ignored on purpose: this seeder must work in a
    container with no git binary and no `.git` directory, which is the normal
    production case. The guard exists for the developer machine where the mistake
    is actually made.
    """
    try:
        path.resolve().relative_to(_REPO_ROOT)
    except ValueError:
        return  # outside the repo — nothing git could do with it

    try:
        tracked = subprocess.run(
            ["git", "ls-files", "--error-unmatch", str(path.resolve())],
            cwd=_REPO_ROOT,
            capture_output=True,
            timeout=10,
        ).returncode == 0
    except (OSError, subprocess.SubprocessError):
        return

    if tracked:
        raise SystemExit(
            f"[seed] REFUSING to read {path}: git tracks it, and this repository is public.\n"
            "[seed] Move the file outside the repository, or add it to .gitignore and "
            "`git rm --cached` it first. If it has already been committed, the secrets "
            "in it must be rotated — removing the file does not unpublish them."
        )


def _load_file_values() -> dict[str, dict[str, str]]:
    """`{slug: {field_key: value}}` from `SEED_API_CREDENTIALS_FILE`, or empty."""
    raw = os.environ.get(FILE_ENV, "").strip()
    if not raw:
        return {}

    path = Path(raw)
    _reject_tracked_file(path)

    if not path.is_file():
        raise SystemExit(f"[seed] {FILE_ENV} points at {path}, which is not a file.")

    try:
        parsed = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        # The message deliberately carries the position and not the content: a
        # parse error quoting the offending line would print a secret.
        raise SystemExit(
            f"[seed] {path} is not valid JSON (line {exc.lineno}, column {exc.colno})."
        ) from None

    if not isinstance(parsed, dict):
        raise SystemExit(f"[seed] {path} must be a JSON object keyed by provider slug.")

    return {
        str(slug): {str(k): "" if v is None else str(v) for k, v in (fields or {}).items()}
        for slug, fields in parsed.items()
        if isinstance(fields, dict)
    }


def _looks_like_placeholder(value: str) -> bool:
    """Whether a supplied value is obviously not a real credential.

    Imported from `core.config` rather than re-listed, so the seeder and the
    startup environment audit cannot disagree about what a placeholder is.
    """
    from app.core.config import _PLACEHOLDER_EXACT, _PLACEHOLDER_SUBSTRINGS

    lowered = value.strip().lower()
    if not lowered:
        return False
    return lowered in _PLACEHOLDER_EXACT or any(
        marker in lowered for marker in _PLACEHOLDER_SUBSTRINGS
    )


def collect_values(
    provider: ApiServiceProvider, file_values: dict[str, dict[str, str]]
) -> dict[str, str]:
    """Supplied values for one provider's declared fields, env winning over file.

    Only *declared* fields are considered. A stray `SEED_CRED_GOOGLE_NONSENSE`
    is ignored rather than erroring, because the alternative is a deployment that
    refuses to seed over a leftover variable — but it is reported by `main` so a
    typo in a real field name is visible instead of silently doing nothing.
    """
    supplied: dict[str, str] = {}
    from_file = file_values.get(provider.slug, {})

    for schema in provider.schemas:
        key = schema.field_key
        if key in from_file:
            supplied[key] = from_file[key]
        env_value = os.environ.get(_env_name(provider.slug, key))
        if env_value is not None:
            supplied[key] = env_value

    return supplied


def unknown_field_names(
    provider: ApiServiceProvider, file_values: dict[str, dict[str, str]]
) -> list[str]:
    """Supplied names that this provider does not declare — almost always typos."""
    declared = {schema.field_key for schema in provider.schemas}
    seen = set(file_values.get(provider.slug, {}))

    prefix = f"{ENV_PREFIX}{provider.slug.upper()}_"
    for name in os.environ:
        if name.startswith(prefix):
            seen.add(name[len(prefix):].lower())

    return sorted(seen - declared)


def _seed_actor(db: Session) -> User:
    """Who the audit entry attributes the write to.

    The root account, which `seed_rbac` creates before this seeder can usefully
    run. Failing loudly is right: `create_credential` records an activity entry
    against an actor, and inventing a synthetic one would put a user id in the
    audit trail that no user has.
    """
    from app.core.roles import ROLE_ROOT
    from app.models.role import Role

    actor = db.scalars(
        select(User)
        .join(User.roles)
        .where(Role.name == ROLE_ROOT, User.deleted_at.is_(None))
        .limit(1)
    ).first()

    if actor is None:
        raise SystemExit(
            "[seed] no Root account exists yet. Run `python -m app.db.seed_rbac` first — "
            "credential writes are audited and need an actor to attribute them to."
        )
    return actor


def seed_credentials(
    db: Session,
    *,
    environment: str,
    dry_run: bool = False,
) -> tuple[int, int, list[str]]:
    """Write supplied values for every seeded provider.

    Returns `(providers_written, fields_written, notes)`. **`notes` never contains
    a value** — only slugs, field keys and outcomes.
    """
    file_values = _load_file_values()
    providers = db.scalars(select(ApiServiceProvider).order_by(ApiServiceProvider.display_order)).all()

    if not providers:
        raise SystemExit(
            "[seed] no providers are seeded. Run `python -m app.db.seed_api_providers` first."
        )

    notes: list[str] = []
    providers_written = 0
    fields_written = 0
    actor = None if dry_run else _seed_actor(db)

    for provider in providers:
        strays = unknown_field_names(provider, file_values)
        if strays:
            declared = sorted(s.field_key for s in provider.schemas)
            notes.append(
                f"{provider.slug}: ignored unknown field(s) {strays} — declared fields are {declared}"
            )

        supplied = collect_values(provider, file_values)
        if not supplied:
            notes.append(f"{provider.slug}: no values supplied, skipped")
            continue

        if settings.is_production:
            placeholders = sorted(k for k, v in supplied.items() if _looks_like_placeholder(v))
            if placeholders:
                raise SystemExit(
                    f"[seed] {provider.slug}: placeholder value(s) supplied for {placeholders} "
                    "with APP_ENV=production. A placeholder that seeds cleanly looks configured "
                    "and is not — supply the real value or omit the field."
                )

        existing = db.scalars(
            select(ApiCredential).where(
                ApiCredential.provider_id == provider.id,
                ApiCredential.environment == environment,
            )
        ).first()

        action = "update" if existing else "create"
        keys = sorted(supplied)

        if dry_run:
            notes.append(f"{provider.slug}: would {action} {environment} — fields {keys}")
            providers_written += 1
            fields_written += len(keys)
            continue

        if existing:
            credential_service.update_credential(
                db,
                existing.id,
                {
                    "environment": environment,
                    "name": existing.name,
                    "is_active": existing.is_active,
                    "notes": existing.notes,
                    "field_values": supplied,
                },
                actor,
            )
        else:
            credential_service.create_credential(
                db,
                {
                    "provider_id": provider.id,
                    "environment": environment,
                    "name": f"{provider.name} ({environment})",
                    "is_active": True,
                    "field_values": supplied,
                },
                actor,
            )

        notes.append(f"{provider.slug}: {action}d {environment} — fields {keys}")
        providers_written += 1
        fields_written += len(keys)

    return providers_written, fields_written, notes


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Seed API credential values from the environment. Never from this file."
    )
    parser.add_argument(
        "--environment",
        default=os.environ.get("SEED_CRED_ENVIRONMENT", "production"),
        help="Which credential set to write (default: production). One per provider per environment.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Report what would be written, by field KEY, and change nothing.",
    )
    args = parser.parse_args()

    db = SessionLocal()
    try:
        providers, fields, notes = seed_credentials(
            db, environment=args.environment, dry_run=args.dry_run
        )
    finally:
        db.close()

    for note in notes:
        print(f"[seed] {note}")

    prefix = "[seed] dry run:" if args.dry_run else "[seed] done —"
    print(f"{prefix} {providers} provider(s), {fields} field(s) for environment {args.environment!r}")

    if providers == 0:
        print(
            f"[seed] Nothing was supplied. Set {ENV_PREFIX}<SLUG>_<FIELD_KEY> variables, or point "
            f"{FILE_ENV} at a JSON file OUTSIDE this repository — it is public. "
            "See backend/seed_api_credentials.example.json for the shape."
        )


if __name__ == "__main__":
    sys.exit(main())
