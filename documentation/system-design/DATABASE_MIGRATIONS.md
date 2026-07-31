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
import app.models.user          # noqa: F401
import app.models.admin_user    # noqa: F401
import app.models.test          # noqa: F401
import app.models.question      # noqa: F401
import app.models.option        # noqa: F401
import app.models.test_session  # noqa: F401
import app.models.session_answer# noqa: F401
import app.models.candidate     # noqa: F401
import app.models.category      # noqa: F401

target_metadata = Base.metadata
```

⚠️ **A model missing from this list is invisible to `--autogenerate`.** Worse, autogenerate compares
metadata to the database — an unregistered model whose table already exists will make Alembic think
the table is *extraneous* and it may emit a `drop_table`. **Always add the import in the same commit
as the model, and always read the generated file.**

---

## 2. Current Revision Chain

Linear, seven revisions. **Head is `3ab496a7c5b7`.**

| # | Revision | Down revision | What it did |
|---|----------|---------------|-------------|
| 1 | `003f7590e39b` | `None` (base) | Create `users` and `admin_users` |
| 2 | `a1ebf7c66c45` | `003f7590e39b` | Fix `failed_login_attempts` to integer |
| 3 | `b818194d8e23` | `a1ebf7c66c45` | Add `tests`, `questions`, `options`, `test_sessions`, `session_answers` |
| 4 | `c4a2f81d9e10` | `b818194d8e23` | Add `role` to `admin_users` |
| 5 | `d9e3f1a2b4c5` | `c4a2f81d9e10` | Create `candidates` |
| 6 | `cc12bb0fb8fb` | `d9e3f1a2b4c5` | Rename `password_hash` → `password` ⚠️ |
| 7 | `3ab496a7c5b7` | `cc12bb0fb8fb` | Create `categories` ← **head** |

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
Revises: 3ab496a7c5b7
Create Date: 2026-07-30 …
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "abc123def456"
down_revision: Union[str, None] = "3ab496a7c5b7"
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
| Need a clean slate (local only) | `docker compose down -v` then `docker compose up -d`, `alembic upgrade head`, `python -m app.db.seed_admin`. **Destroys all local data.** |
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
