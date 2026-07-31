# Scaffold Cleanup Plan

> **Status: Planning — do not execute yet.**
>
> The decision on 2026-07-30 was to **keep everything** and build the marketplace alongside the
> inherited test-platform code. This document is the eventual retirement plan, not a licence to start
> deleting.
>
> Planning docs are reference only. Check the code for current state.

---

## Principle

**Nothing is removed until its replacement is live.** The inherited domain is dead weight, not a
liability — it costs nothing to leave in place, and deleting it early risks removing something the
marketplace turns out to need (the `categories` table is the obvious candidate for reuse).

Split into three tiers by risk:

| Tier | What | When |
|------|------|------|
| **1. Free** | Renames and doc fixes that touch no behaviour | Any time |
| **2. Safe** | Removing code nothing references | Once the marketplace domain exists |
| **3. Destructive** | Dropping tables and data | Only after Tier 2, with a backup |

---

## Tier 1 — Free (any time)

No behaviour change, no risk. **Mostly executed on 2026-07-30** — remaining items are marked.

### 1.1 Product naming ✅ DONE (2 items deferred)

Executed 2026-07-30. A verification sweep found **18 occurrences across 14 files**, three times what
this plan originally listed — including user-visible brand text in the sidebar and navbar. Full
before/after table in [`TECH_DEBT.md`](./TECH_DEBT.md) PM-21.

Still outstanding, deliberately — these are not string edits:

| File | Change | Why deferred |
|------|--------|--------------|
| `docker-compose.yml` | `networks.default.name: test-platform` → `partner-marketplace` | Recreates the Docker network; containers must be stopped first |
| `.env` + `DATABASE_URL` | `test_platformDB` → `partner_marketplace` | See § 3.3 — dump-and-restore, not a rename. Low value, real risk. |

### 1.2 Rewrite the root `README.md` ✅ DONE

Executed 2026-07-30. It was wrong in twelve places (historical table in `../ONBOARDING.md` § 12).
Replaced with a short overview that:

- states the project status honestly (foundation only, marketplace domain not built)
- **carries no version table** — points at `frontend/package.json` and `backend/requirements.txt`
  instead, because a hardcoded table goes stale silently
- gives a quick start that defers to `documentation/ONBOARDING.md`
- links `documentation/INDEX.md` as the doc map
- warns that the app is not deployable as-is, linking the blocker list

Deleted outright: the fabricated `docker/` folder tree, the `docker-compose up --build` instructions,
the `seed.py` reference, the credentials block, the "Application Flow" diagram (it described the test
engine), and the stray `uvicorn` line at the bottom of the file.

### 1.3 Retire the superseded docs index ✅ DONE

Executed 2026-07-30. `documentation/README.md` was **deleted** rather than reduced to a pointer —
the project keeps exactly **one** README, at the root. Its two rows were already covered by
`INDEX.md`, and the content remains in git history.

At the same time the root was cleared of all other markdown, per the same decision: **only
`README.md`, `CLAUDE.md` and `AGENTS.md` live outside `documentation/`.**

| File | Action |
|------|--------|
| `phases.md` (root) | Deleted — byte-identical duplicate of `documentation/phases.md` |
| `instruction.md` | `git mv` → `documentation/instruction.md` |
| `planning.md` | `git mv` → `documentation/planning.md` |

### 1.4 Delete the dead virtualenvs

```bash
rm -rf .venv backend/.venv
```

Both are gitignored and both are unusable (`../ONBOARDING.md` § 2). ~186 MB recovered.

### 1.5 Remove the unused Tailwind v4 package

`@tailwindcss/postcss` in `frontend/devDependencies` is not referenced by `postcss.config.mjs`
(TECH_DEBT PM-22). Removing it is safe; installing v4 is not.

---

## Tier 2 — Safe removals (after the marketplace domain exists)

Code that nothing else references once the replacement is live. Do these **one commit per item**, so a
regression is easy to bisect.

### 2.1 Frontend

| Item | Path | Notes |
|------|------|-------|
| Test-taking state | `lib/store/testSlice.ts` | Also remove from `store/index.ts` reducers |
| Test API module | `lib/api/testApi.ts` | |
| Candidate API module | `lib/api/candidateApi.ts` | Only if candidates aren't repurposed |
| Test card components | `components/dashboard/TestCard.tsx`, `TestCardSkeleton.tsx` | `TestCardSkeleton` is a useful skeleton reference — consider generalising rather than deleting |
| Rules modal | `components/dashboard/RulesModal.tsx` | A marketplace may want a terms-acceptance modal — read it before discarding |
| Admin question forms | `components/admin/AddQuestionForm.tsx`, `SelectQuestionType.tsx`, `AddTestSectionForm.tsx`, `AddJobRoleForm.tsx` | |
| Candidate components | `components/admin/Candidate.tsx`, `app/dashboard/candidates/page.tsx` | |
| Middleware paths | `middleware.ts` | Remove `/test` and `/result` from **both** `PROTECTED` and `matcher` |
| Types | `types/index.ts` | Remove test/question/candidate types |

⚠️ `middleware.ts` keeps two lists that must be edited together — `PROTECTED` and `config.matcher`.
Editing one silently changes protection.

### 2.2 Backend

| Item | Path |
|------|------|
| Candidate router | `app/api/candidate.py` + its `include_router` line in `main.py` |
| Candidate service | `app/services/candidate_service.py` |
| Candidate schema | `app/schemas/candidate.py` |
| Models | `app/models/test.py`, `question.py`, `option.py`, `test_session.py`, `session_answer.py`, `candidate.py` |
| Model registrations | The matching `import` lines in `app/db/migrations/env.py` |

⚠️ **Remove the model file and its `env.py` import in the same commit.** A model file deleted while its
import remains breaks Alembic entirely (`ImportError` on every command). A model still imported after
deletion is impossible — but the inverse (importing a model whose table you dropped) makes autogenerate
try to recreate it.

### 2.3 The four inherited planning documents

All now live in `documentation/` (moved there in § 1.3): `architecture.md`, `instruction.md`,
`phases.md`, `planning.md`. The root/`documentation` duplication of `phases.md` is already gone.

Each describes the retired test platform in detail — `instruction.md` is its coding standards,
`planning.md` its module breakdown and UX decisions, `phases.md` its build plan, `architecture.md` its
system design. All four are superseded by `core/` and `system-design/`.

Options, in order of preference:

1. **Delete them.** They're in git history if ever needed, and this is a **public** repo where a stale
   product spec is actively confusing to a reader.
2. Move them to `documentation/legacy/` with a header stating they describe a retired product.
3. Leave them, as `INDEX.md` already lists them under "Inherited — Do Not Trust".

Don't do this while they are still the only written record of how the scaffold was built —
`architecture.md` in particular documents intent that the new `core/ARCHITECTURE.md` describes only as
it now stands.

---

## Tier 3 — Destructive (last, with a backup)

### 3.1 Drop the inherited tables

Five tables belong solely to the retired product:

`session_answers` → `test_sessions` → `options` → `questions` → `tests`

**Drop in that order** — it is reverse-dependency order. Dropping `tests` first will fail on foreign
keys (or, worse, cascade).

Requires a **real forward migration**:

```bash
cd backend
alembic revision -m "drop inherited test-platform tables"
```

Write `upgrade()` with explicit `op.drop_table()` calls in dependency order. For `downgrade()`, either
recreate the tables faithfully or raise `NotImplementedError` with an explanation — see
`../system-design/DATABASE_MIGRATIONS.md` § 6. **Do not** let autogenerate write this: it will emit the
drops in arbitrary order.

**Before running it:**

```bash
docker compose exec db pg_dump -U <user> <db> > ~/pm-backup-$(date +%F).sql
alembic upgrade head --sql        # review the SQL first
```

### 3.2 Decide on `candidates` and `categories`

Neither is obviously test-platform-specific:

| Table | Consideration |
|-------|---------------|
| `categories` | A generic taxonomy — **likely reusable** for listing categories. Inspect before dropping. |
| `candidates` | Recruitment-specific in name, but the shape (a person record with contact details) may map onto a partner contact. Read `models/candidate.py` before deciding. |

Do not drop either without checking against
[`MARKETPLACE_DOMAIN_PLAN.md`](./MARKETPLACE_DOMAIN_PLAN.md).

### 3.3 Rename the database

`.env` currently has `POSTGRES_DB=test_platformDB` and a matching `DATABASE_URL`. Renaming touches
three coupled things:

1. `POSTGRES_DB` in the root `.env`
2. The database name inside `DATABASE_URL` in **both** `.env` files
3. The existing `./data/db` cluster, which contains a database under the old name

The cleanest path is a dump-and-restore into a new database rather than an in-place rename, because the
Compose bind-mount ties the cluster to the host directory:

```bash
docker compose exec db pg_dump -U <user> test_platformDB > /tmp/dump.sql
docker compose exec db createdb -U <user> partner_marketplace
docker compose exec -T db psql -U <user> partner_marketplace < /tmp/dump.sql
# update both .env files, then restart
```

**Low value, non-trivial risk.** Leaving the database name alone is a perfectly reasonable decision —
it's invisible to users.

---

## What Not to Touch

| Keep | Why |
|------|-----|
| `users`, `admin_users` | The account foundation the marketplace builds on |
| All of `app/core/` | Config, security, dependencies — stack infrastructure, not domain |
| `app/api/auth.py`, `app/api/admin.py` | Auth and admin management are being kept |
| `components/common/*` | Domain-neutral primitives |
| `components/auth/*` | Sign-in/up, being kept |
| `lib/api/axiosInstance.ts` | The refresh interceptor is genuinely good work |
| `lib/hooks/*`, `useTheme` | Reusable |
| `next.config.mjs`, `tailwind.config.ts` | Tuned already |
| `docker-compose.yml` | Local database setup works |
| Migrations 1–7 | **Never edit or delete an applied migration.** Fix forward. |

---

## Execution Checklist

When the time comes:

- [ ] Marketplace domain model exists and is reviewed ([`MARKETPLACE_DOMAIN_PLAN.md`](./MARKETPLACE_DOMAIN_PLAN.md))
- [ ] Replacement features are live, not merely designed
- [x] Tier 1 done (free, no risk) — § 1.1 (except 2 deferred renames), § 1.2, § 1.3 complete 2026-07-30; § 1.4 and § 1.5 still open
- [ ] `pg_dump` backup taken and **restore verified**
- [ ] Tier 2 done, one commit per item
- [ ] Nothing references the code being dropped: `grep -rn "candidate\|testSlice" --exclude-dir=node_modules`
- [ ] Tier 3 migration hand-written, drop order verified, `downgrade()` decided
- [ ] `alembic upgrade head --sql` reviewed before applying
- [ ] App verified end to end after each tier
- [ ] Entries in [`../DAILY_CHANGES.md`](../DAILY_CHANGES.md)
- [ ] `INDEX.md` "Inherited — Do Not Trust" section updated or removed

---

## Related Documentation

- [`MARKETPLACE_DOMAIN_PLAN.md`](./MARKETPLACE_DOMAIN_PLAN.md) — what replaces this
- [`TECH_DEBT.md`](./TECH_DEBT.md) — PM-12, PM-21, PM-22, PM-23 overlap with Tier 1
- [`../system-design/DATABASE_MIGRATIONS.md`](../system-design/DATABASE_MIGRATIONS.md) — writing the Tier 3 migration
- [`../ONBOARDING.md`](../ONBOARDING.md) § 12 — the README's specific errors
- [`../core/ARCHITECTURE.md`](../core/ARCHITECTURE.md) — which tables are inherited
