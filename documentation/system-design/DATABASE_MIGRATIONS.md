# Database Migrations — Alembic Runbook

> **Every Alembic command runs from `backend/`.** `script_location` is relative, and `.env`
> discovery is working-directory dependent. Running from the repo root fails in confusing ways.

---

## Table of Contents

1. [How It's Wired](#1-how-its-wired)
2. [Current Revision Chain](#2-current-revision-chain)
3. [Daily Commands](#3-daily-commands)
4. [Creating a Migration](#4-creating-a-migration)
5. [What Autogenerate Misses](#5-what-autogenerate-misses)
6. [Writing Migrations by Hand](#6-writing-migrations-by-hand)
7. [Conventions](#7-conventions)
8. [Recovery](#8-recovery)
9. [Known Issues in the Existing Chain](#9-known-issues-in-the-existing-chain)

---

## 1. How It's Wired

| Piece | Path | Role |
|-------|------|------|
| Config | `backend/alembic.ini` | `script_location = app/db/migrations` (**relative**) |
| Environment | `backend/app/db/migrations/env.py` | Overrides the DB URL, registers metadata |
| Revisions | `backend/app/db/migrations/versions/*.py` | The chain |
| Metadata | `backend/app/db/base.py` | `class Base(DeclarativeBase)` |

### The URL override

`alembic.ini` ships a placeholder:

```ini
sqlalchemy.url = driver://user:pass@localhost/dbname
```

**That value is never used.** `env.py` replaces it at runtime so `.env` is the single source of truth:

```python
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL.replace("%", "%%"))
```

The `%` → `%%` escape matters: ConfigParser treats `%` as interpolation, so a password containing `%`
would otherwise crash Alembic. **Don't remove it.**

### Model registration — the critical part

`env.py` imports every model explicitly:

```python
from app.db.base import Base

# Core identity + RBAC
import app.models.associations      # noqa: F401
import app.models.permission        # noqa: F401
import app.models.permission_group  # noqa: F401
import app.models.role              # noqa: F401
import app.models.user              # noqa: F401
import app.models.user_invitation   # noqa: F401
import app.models.user_session      # noqa: F401
import app.models.activity_log      # noqa: F401

# Installation settings
import app.models.app_settings      # noqa: F401

target_metadata = Base.metadata
```

⚠️ **A model missing from this list is invisible to `--autogenerate`.** Worse, autogenerate compares
metadata to the database — an unregistered model whose table already exists will make Alembic think
the table is *extraneous* and it may emit a `drop_table`. **Always add the import in the same commit
as the model, and always read the generated file.**

Two further warnings, both learned the hard way:

- **`env.py` is a protected file** (`../AGENTS.md` § Protected Files) and it is **excluded from
  linting** in `backend/pyproject.toml`. On 2026-08-06 a `ruff --fix` import sort hoisted an import
  *above* the comment quoted here, detaching the warning from the list it governs. Do not narrow that
  exclude back to `versions/` only.
- **Nothing verifies the list is complete.** A test comparing `Base.metadata.tables` against these
  imports would make the most dangerous omission in this workflow impossible to make silently. It does
  not exist yet — tracked in this file's § Pending.

---

## 2. Current Revision Chain

Linear, **19 revisions**. **Head is `d8c31f60a927`.**

Taken from `alembic history`, not maintained by hand — regenerate it rather than editing rows. This
section was **eleven revisions behind** on 2026-08-06, still naming `e7b41c9a2d10` as head, which is
the most actively misleading thing a migration doc can do: anyone comparing `alembic current` against
it concludes their database is ahead of the code.

| # | Revision | What it did |
|---|----------|-------------|
| 1 | `003f7590e39b` | Create `users` and `admin_users` |
| 2 | `a1ebf7c66c45` | Fix `failed_login_attempts` to integer |
| 3 | `b818194d8e23` | Add `tests`, `questions`, `options`, `test_sessions`, `session_answers` — *dropped by 14* |
| 4 | `c4a2f81d9e10` | Add `role` to `admin_users` |
| 5 | `d9e3f1a2b4c5` | Create `candidates` — *dropped by 14* |
| 6 | `cc12bb0fb8fb` | Rename `password_hash` → `password` — see the callout below |
| 7 | `3ab496a7c5b7` | Create `categories` — *dropped by 14* |
| 8 | `e7b41c9a2d10` | **Unify `users`/`admin_users`, add RBAC, bcrypt every existing password in place** |
| 9 | `f3c81a5be204` | Add `user_sessions`, so tokens can be revoked |
| 10 | `a7d92c4f1b83` | Align user columns with LeapDesk's names |
| 11 | `b6e15d3a9f27` | Add `activity_log` for the audit trail |
| 12 | `c8f42e7b91d5` | Add two-factor auth and password confirmation |
| 13 | `d4a71f6c8e93` | Add refresh-token rotation with reuse detection |
| 14 | `e2b8d5c31f47` | Add password-OTP recovery |
| 15 | `f5a3c81b7d29` | Add per-role sidebar navigation preferences |
| 16 | `c1e70a5d94b2` | **Drop the 7 inherited test-platform tables.** Hand-written — autogenerate emits drops in arbitrary order and they fail on foreign keys |
| 17 | `a4f19c72e8d3` | Create `app_settings` (single-row, `CHECK (id = 1)`) |
| 18 | `b7e42d19f0c5` | Add `theme_preset` to `app_settings` |
| 19 | `d8c31f60a927` | Add brand assets (`logo_*`, `favicon_*`) ← **head** |

**Not every revision is reversible, and that matters before an incident.** `e7b41c9a2d10` and
`c1e70a5d94b2` both raise `NotImplementedError` in `downgrade()` — the first would need the original
plaintext passwords, which are gone by design; the second would recreate a retired product's schema
without being able to restore its data. So `alembic downgrade -1 && alembic upgrade head` is **not** a
usable smoke test across the whole chain. Restore a backup instead.

Verify at any time:

```bash
cd backend
alembic current      # what the DB is at
alembic heads        # what the code's newest revision is
alembic history      # the full chain
```

### ⚠️ Revision 6 is the plaintext-password migration

`cc12bb0fb8fb` renamed the column and backfilled it:

```python
op.execute('UPDATE admin_users SET password = password_hash WHERE password IS NULL')
op.execute('UPDATE users SET password = password_hash WHERE password IS NULL')
```

This is the schema half of the accepted plaintext-password debt (see
`../core/AUTHENTICATION.md` § Known Debt). When hashing is implemented, the fix is a **new forward
migration** — do not edit or revert this one.

---

## 3. Daily Commands

All from `backend/` with the venv active.

| Task | Command |
|------|---------|
| Apply everything | `alembic upgrade head` |
| Apply one step | `alembic upgrade +1` |
| Roll back one step | `alembic downgrade -1` |
| Roll back to a revision | `alembic downgrade <revision>` |
| Current DB revision | `alembic current` |
| Newest code revision | `alembic heads` |
| Full history | `alembic history --verbose` |
| Generate from models | `alembic revision --autogenerate -m "<message>"` |
| Empty migration | `alembic revision -m "<message>"` |
| Preview SQL without running | `alembic upgrade head --sql` |

`--sql` is the safest way to review a migration's real effect before touching data.

---

## 4. Creating a Migration

```bash
cd backend
source .venv/bin/activate

# 1. Write/modify the model in app/models/
# 2. Register it in app/db/migrations/env.py  ← do not skip
# 3. Generate
alembic revision --autogenerate -m "create listings table"

# 4. READ the generated file in app/db/migrations/versions/
#    Check: correct tables, correct nullability, enums created, no accidental drops
# 5. Preview the SQL
alembic upgrade head --sql

# 6. Apply
alembic upgrade head

# 7. Confirm
alembic current
```

**Step 4 is not optional.** Autogenerate is a first draft.

---

## 5. What Autogenerate Misses

| Miss | Consequence | Do instead |
|------|-------------|------------|
| **Enum type changes** | Adding a value to `Enum("a","b", name="x")` produces **no** DDL. The DB type is unchanged and inserts fail. | Hand-write `ALTER TYPE x ADD VALUE 'c'` |
| **Column renames** | Detected as drop + add — **data loss** | Hand-write `op.alter_column(..., new_column_name=...)` |
| **`comment=` changes** | Often not detected | Add `op.alter_column(..., comment=...)` manually |
| **Server defaults** | `default=` is Python-side only; nothing lands in the DB | Use `server_default=` if the DB must supply it |
| **Table/index renames** | Drop + create | Hand-write the rename |
| **Data migrations** | Never generated | Add `op.execute(...)` |
| **CHECK constraints** | Not detected | Declare explicitly |
| **Unregistered models** | May emit a spurious `drop_table` | Register in `env.py` |

Because every timestamp here uses a Python-side `default=lambda: datetime.now(timezone.utc)`, rows
inserted by raw SQL (including `op.execute` in a migration) get **no** timestamp. Set them explicitly
in data migrations.

---

## 6. Writing Migrations by Hand

Every revision needs a working `downgrade()`. Template:

```python
"""create listings table

Revision ID: abc123def456
Revises: d8c31f60a927
Create Date: 2026-07-30 …
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "abc123def456"
down_revision: Union[str, None] = "d8c31f60a927"  # ← the CURRENT head
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "listings",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_listings_title"), "listings", ["title"])


def downgrade() -> None:
    op.drop_index(op.f("ix_listings_title"), table_name="listings")
    op.drop_table("listings")
```

### Rules

1. **`downgrade()` must actually reverse `upgrade()`** — in reverse order (indexes before tables).
2. **Never leave `downgrade()` as `pass`.** If a step is genuinely irreversible, raise with an
   explanation:
   ```python
   raise NotImplementedError("Irreversible: original password hashes were discarded")
   ```
3. **Match the model exactly** — column type, length, nullability, index. A drift between model and
   migration means autogenerate will keep trying to "fix" it on every future run.
4. **`DateTime(timezone=True)`** for every timestamp, matching the models.
5. **Guard data migrations** — `WHERE x IS NULL` so a re-run is a no-op.
6. **One logical change per revision.** Don't bundle a table create with an unrelated column rename.

---

## 7. Conventions

| Concern | Convention |
|---------|------------|
| Message | Imperative and specific: `"create listings table"`, `"add status to orders"` |
| Revision ID | Alembic-generated hex — don't hand-pick |
| Chain | Strictly linear. No branches, no merge revisions. |
| Enum naming | `name="thing_kind"` snake_case, matching the model's `Enum(..., name=...)` |
| PK type | `sa.String(length=36)` — UUID as string |
| Index naming | `op.f("ix_<table>_<column>")` |
| Applying | Manual. **Nothing runs migrations automatically** — not on app start, not in Docker. |

⚠️ The inherited root `README.md` claims "The backend runs `alembic upgrade head` automatically on
startup." **It does not.** `main.py` has no startup hook.

---

## 8. Recovery

| Situation | Fix |
|-----------|-----|
| `Can't locate revision identified by '<rev>'` | The DB references a revision absent from `versions/`. Someone deleted a file or you switched branches. Restore the file, or hand-edit `alembic_version.version_num` to a revision you have. |
| `Target database is not up to date` | Pending migrations exist. `alembic upgrade head`. |
| Multiple heads | Two revisions share a `down_revision`. `alembic heads` to see them, then `alembic merge -m "merge heads" <rev1> <rev2>`. Better: keep the chain linear. |
| Migration failed halfway | Postgres DDL is transactional, so a failed migration rolls back — but `alembic_version` may not have advanced. Check `alembic current`, fix the migration, re-run. |
| Model and DB have drifted | `alembic revision --autogenerate -m "sync"` and **read** it. It shows the delta. Discard it if it's not what you want. |
| Need a clean slate (local only) | `docker compose down -v` then `docker compose up -d`, `alembic upgrade head`, `python -m app.db.seed_rbac`. **Destroys all local data.** |
| `alembic: command not found` | Venv not active, or you're using the broken inherited venv — see `../ONBOARDING.md` § 2. |
| `FAILED: No config file 'alembic.ini' found` | You're not in `backend/`. |

### Never do these

- ❌ **Edit an applied migration.** Anyone who already ran it won't get the change. Write a new one.
- ❌ **Delete a migration file that's been applied anywhere** — breaks the chain.
- ❌ **`Base.metadata.create_all()`** — bypasses Alembic and leaves `alembic_version` stale.
- ❌ **Hand-edit the schema in Adminer** — the next autogenerate will fight you.

---

## 9. Known Issues in the Existing Chain

| Issue | Detail |
|-------|--------|
| Revision 2 fixes revision 1 | `a1ebf7c66c45` corrects `failed_login_attempts` to integer — a type bug shipped then patched. The column is dead anyway (`../core/USERS.md`). |
| Revision 6 institutionalises plaintext passwords | `cc12bb0fb8fb` renames `password_hash` → `password` and backfills. Accepted debt; fix forward. |
| Five inherited domain tables | `tests`, `questions`, `options`, `test_sessions`, `session_answers` belong to the retired product. Dropping them is `../planning/SCAFFOLD_CLEANUP_PLAN.md`, and needs a real migration — not a metadata edit. |
| Dead columns are still in the schema | `admin_users` lockout/audit/reset columns. Harmless, but they misrepresent capability. |
| Database is named `test_platformDB` | Inherited. Renaming touches `DATABASE_URL`, `POSTGRES_DB`, and the existing `data/db` volume — plan it, don't improvise. |
| No migration tests | Nothing verifies `downgrade()` works. Test manually: `alembic downgrade -1 && alembic upgrade head`. |

---

## Related Documentation

- [`FASTAPI_STANDARDS.md`](./FASTAPI_STANDARDS.md) § 4 — model conventions migrations must match
- [`../core/USERS.md`](../core/USERS.md) — the tables these revisions built
- [`../core/AUTHENTICATION.md`](../core/AUTHENTICATION.md) — context for revision 6
- [`../ONBOARDING.md`](../ONBOARDING.md) — first-time setup including `alembic upgrade head`
- [`../planning/SCAFFOLD_CLEANUP_PLAN.md`](../planning/SCAFFOLD_CLEANUP_PLAN.md) — retiring inherited tables

---

## Pending

> **Migration work still outstanding.** Last audited **2026-08-06**. The chain is healthy — 16 revisions,
> **one head** (`c1e70a5d94b2`), verified with `alembic heads`. § 2 and § 9 are both out of date after the
> 2026-08-06 domain deletion.

### 🔴 Protect `env.py` from tooling

- [ ] **`env.py`'s import block is load-bearing and a linter already damaged it.** The comment reads
      *"EVERY model must be imported here or --autogenerate cannot see it, and may emit a migration that
      **drops its table**"* — and on 2026-08-06 a `ruff --fix` import sort **hoisted an import above that
      comment**, detaching the warning from the list it governs. `app/db/migrations` is now excluded from
      linting in `backend/pyproject.toml` with that reason recorded. **Do not narrow the exclude back to
      `versions/` only.** § 1 *Model registration — the critical part* should carry the same warning.
- [ ] **⚠️ `env.py` had an uncommitted change discarded on 2026-08-06** while reverting that lint fix
      (`git checkout` — unstaged working-tree content is not recoverable). The file now matches `HEAD`
      and is functionally correct: all 8 model imports resolve, no deleted model is referenced, single
      head confirmed. The lost change appears to have been import ordering only, but that is an inference.
      **Review the file before the next commit.**
- [ ] **Nothing verifies that every model is registered.** The consequence of forgetting is not an error
      — it is an autogenerated migration that **drops the unregistered table**. A test that compares
      `Base.metadata.tables` against the modules imported by `env.py` would make the most dangerous
      omission in this workflow impossible to make silently. This is the highest-value test in the
      backend and it does not exist.

### 🟠 Correctness of the chain

- [ ] **No migration is tested, in either direction (§ 9 already notes this).** Several
      `downgrade()`s **raise `NotImplementedError` by design** — `e7b41c9a2d10` (reversal would need
      plaintext passwords that are gone) and `c1e70a5d94b2` (recreating a retired product's schema
      could not restore its data). Both choices are sound, and together they mean
      `alembic downgrade -1 && alembic upgrade head` is **not** a usable smoke test across the whole
      chain. Write down which revisions are reversible and which are not, so nobody discovers it during
      an incident.
- [ ] **No autogenerate-drift check.** Nothing catches a model changed without a migration. A CI step
      running `alembic upgrade head` then `alembic check` against a scratch database would — and it is
      the one step that needs a real Postgres, which is why `.github/workflows/ci.yml` has no
      `services: postgres` block yet. Add both together.
- [ ] **Migrations are applied by hand, and § 3 is the only record of that.** No deploy step runs them.
      This is listed as an undecided infrastructure question in
      [`DEPLOYMENT.md`](./DEPLOYMENT.md) § 1 — "manual step, or automated pre-start".

### 🟡 Schema debt

- [ ] **§ 3.3 — the database is still named `test_platformDB`.** Renaming touches `DATABASE_URL`,
      `POSTGRES_DB` and the existing `data/db` cluster: **dump-and-restore, not an in-place rename.**
      Low value, non-trivial risk — deliberately deferred, not forgotten. The Docker network is still
      named `test-platform` for the same reason (renaming recreates it, so containers must be stopped).
- [ ] **No `updated_at` trigger; `onupdate` is Python-side only, on 5 models** (`user`, `role`,
      `permission`, `permission_group`, `user_invitation`). Any Core-level `update()` statement bypasses
      it. **Nothing is wrong today** — the one bulk Core UPDATE, `session_service._revoke_where`, targets
      `user_sessions`, which has no `updated_at` at all — but the next bulk update written against a table
      that *does* have one will silently leave the timestamp stale. Either add a database trigger or state
      in § 7 *Conventions* that `updated_at` is only trustworthy for ORM writes.
- [ ] **`activity_log.causer_id` / `subject_id` have no foreign key**, and cannot: one column holds both
      a user UUID and a role integer. Deleting a user therefore leaves audit rows pointing at an id that
      no longer resolves. Correct for an audit trail — worth stating explicitly so nobody "fixes" it with
      a constraint.
- [ ] **PM-43 — no retention or purge migration path.** `session_service.purge_expired` and
      `activity_service.purge_older_than` exist and nothing calls them. `user_sessions` grows by one row
      per sign-in, forever.

### Documentation accuracy
> **✅ The *Documentation accuracy* items below were cleared on 2026-08-06.** The API-path sweep
> (`/api/…` → `/api/v1/…`, 110 references across 13 current-state docs) and every stale section named
> here have been corrected. They are kept, struck through, as the record of what had drifted and why —
> deleting them would lose the more useful lesson, which is that all of it accumulated in under two
> weeks while the code was being actively improved.
>
> Historical documents were deliberately **not** rewritten: `DAILY_CHANGES.md` and `TECH_DEBT.md`'s
> dated entries still say `/api/…` because that is what was true when they were written, and both now
> carry a note saying so. The four inherited test-platform docs were left alone too — `INDEX.md`
> already marks them untrustworthy.

- [ ] **§ 2 *Current Revision Chain* is ELEVEN revisions behind.** It says *"Linear, eight revisions.
      **Head is `e7b41c9a2d10`**"* — there are **19**, and the head is **`d8c31f60a927`** (confirmed with
      `alembic heads`, single head). This is the most actively misleading paragraph in the file: anyone
      checking `alembic current` against it concludes their database is ahead of the code. Missing:
      `a7d92c4f1b83` (align user columns with LeapDesk), `f3c81a5be204` (sessions), `d4a71f6c8e93`
      (refresh rotation), `c8f42e7b91d5` (2FA + password confirmation), `b6e15d3a9f27` (activity log),
      `e2b8d5c31f47` (password OTP), `f5a3c81b7d29` (role nav preferences), `c1e70a5d94b2` (drops the 7 inherited
      tables), `a4f19c72e8d3` (app_settings), `b7e42d19f0c5` (theme_preset) and `d8c31f60a927`
      (brand assets).
- [ ] **§ 9 is stale in two rows.** *"Five inherited domain tables"* — dropped by `c1e70a5d94b2` on
      2026-08-06, along with `candidates` and `categories`; **7 tables, not 5**, and the migration was
      written by hand because autogenerate emits drops in arbitrary order and they fail on foreign keys.
      *"Dead columns are still in the schema — `admin_users` lockout/audit/reset columns"* — the
      **table** has not existed since `e7b41c9a2d10`, and on the unified `users` table every one of
      those columns is now written (PM-6).
- [ ] **§ 9's *"Revision 6 institutionalises plaintext passwords"* needs its resolution noted.**
      `cc12bb0fb8fb` did rename `password_hash` → `password`, and the column name is still that — but the
      contents are bcrypt digests as of `e7b41c9a2d10`. As written it reads as a live problem.
      Same for the § 2 callout *"⚠️ Revision 6 is the plaintext-password migration"*.
