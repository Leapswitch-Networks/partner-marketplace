# AGENTS.md — AI Agent Instructions (Partner Marketplace)

> **AGENTS.md is an open standard for guiding coding agents.**
> Stewarded by the [Agentic AI Foundation](https://agents.md/) under the Linux Foundation.
>
> **Supported agents:** OpenAI Codex, Claude Code, Gemini CLI, GitHub Copilot, OpenCode, Cursor,
> Aider, Windsurf, Devin, Jules, Zed, Warp, RooCode, and [many more](https://agents.md/).

---

## 🚀 STARTUP ANNOUNCEMENT (REQUIRED)

**On your FIRST response in any session, you MUST:**

1. **Read `CLAUDE.md` (root) as your FIRST action** — no text output before this
2. **Verify actual project state** — read real files, not memory
3. **Display this banner:**

```
╔══════════════════════════════════════════════════════════════╗
║  📋 Partner Marketplace — AGENTS.md loaded                    ║
║  ✓ Stack: Next.js 14 App Router + FastAPI + PostgreSQL        ║
║  ✓ Branch: main (never master)                                ║
║  ✓ Docs: update documentation/DAILY_CHANGES.md every task     ║
║  ✓ Commits: ask the user first — never auto-commit            ║
║  ✓ No AI attribution in commit messages                       ║
╚══════════════════════════════════════════════════════════════╝
```

4. **State:** "Ready to work on Partner Marketplace. What would you like me to work on?"

**⛔ DO NOT** describe the stack from memory before reading files.
**⛔ DO NOT** call this a test/assessment platform — the folder's history says that, the project isn't.

---

## ⚠️ CRITICAL: Verify Actual Project State

**Never quote a version from prose — always read it from the lockfiles.** The inherited `README.md`
had twelve wrong claims before it was rewritten on 2026-07-30, which is exactly why it no longer
carries a version table at all.

```bash
cat frontend/package.json                  # real frontend deps
cat backend/requirements.txt               # real backend deps
cat docker-compose.yml                     # what runs in Docker (db, adminer, backend, frontend)
ls documentation/                          # the doc map
git log --oneline -5                       # recent history
```

These were the inherited README's claims. Kept as a reminder of how far prose can drift from code —
and because an older checkout still contains them:

| Old README claim | Reality |
|------------------|---------|
| Next.js 16.2.3 | **14.2.35** |
| Tailwind 4.2.2 | **3.4.19** |
| FastAPI 0.135.3 | **0.115.5** |
| SQLAlchemy 2.0.49 / Alembic 1.18.4 | **2.0.36 / 1.14.0** |
| PostgreSQL 18.3 | **16-alpine** |
| `postgresql+asyncpg://` async driver | **`psycopg2-binary`, fully synchronous** |
| `docker-compose up` runs Nginx + Next + FastAPI + Postgres | Was **`db` + `adminer` only** when this table was written. Since **2026-07-31** there are four services — `db`, `adminer`, `backend`, `frontend` — but they are **development-only** (bind-mounted source, reload servers) and there is still **no Nginx**. The old claim is still wrong, just for a different reason. |

---

## 🎯 Project-Specific Overrides (READ THIS FIRST)

This file follows the universal AGENTS.md template. These project rules **override** the defaults:

| Common default | Partner Marketplace rule |
|----------------|--------------------------|
| `git checkout master` | **Use `main`.** The repo's default branch is `main`. |
| Feature branch per change | The user typically works directly on `main`. Only branch when they ask, or when work spans sessions. |
| `docs/features/` + `docs/bugfixes/` per-change docs | Use **`documentation/DAILY_CHANGES.md`** (one entry per task). Create a dedicated doc only when the work warrants a permanent reference under `documentation/core/` or `documentation/system-design/`. |
| Generic doc structure | Read `documentation/INDEX.md` and follow its "Start Here" column. |
| Agent may commit when done | **Never.** Ask first, every time. See Commit Rules. |
| Add AI co-authorship to commits | **Never.** No `Co-Authored-By`, no "Generated with". |
| Framework knowledge from training data | **This is not the Next.js you know** — installed is **14.2.35**, your training data likely assumes 15/16. Verify against the installed tree before writing Next.js code. ⚠️ This row used to say "read `node_modules/next/dist/docs/`"; that directory **does not exist** in 14.2.35 (PM-19 recorded the same finding). Corrected 2026-08-11 — see root `AGENTS.md`. |

---

## 🎯 Core Principles

1. **Read before writing** — never modify a file you haven't read
2. **Document everything** — update docs alongside code
3. **Ask before committing** — never commit or push without user approval
4. **Separation of concerns** — business logic never lives in a page/component
5. **Track progress** — keep the todo list current during multi-step work

---

## 📚 Phase 1: Before Starting ANY Work

### 1.1 Project Context (MUST READ FIRST)

```bash
cat CLAUDE.md                                  # chains to root AGENTS.md
cat documentation/INDEX.md                     # the doc map
cat documentation/core/ARCHITECTURE.md         # layer boundaries
```

Then read the **Start Here** doc for your area:

| Task type | Read |
|-----------|------|
| Any Python / API work | `system-design/FASTAPI_STANDARDS.md` |
| Any page / component work | `system-design/NEXTJS_STANDARDS.md` |
| Styling only | `system-design/UI_PATTERNS.md` |
| Schema change | `system-design/DATABASE_MIGRATIONS.md` |
| Auth work | `core/AUTHENTICATION.md` + `core/AUTHORIZATION.md` |
| Deploying | `system-design/DEPLOYMENT.md` |

### 1.2 Git Setup

```bash
git branch --show-current       # expect: main
git pull origin main
```

Branch only when asked. Naming, if you do:

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feature/<name>` | `feature/partner-onboarding` |
| Bug fix | `fix/<name>` | `fix/refresh-cookie-path` |
| Hotfix | `hotfix/<name>` | `hotfix/login-500` |
| Refactor | `refactor/<name>` | `refactor/auth-service-hashing` |
| Docs | `docs/<name>` | `docs/marketplace-domain` |

### 1.3 Documentation Setup

Before coding, decide where the change gets recorded:

- **Every task** → an entry in `documentation/DAILY_CHANGES.md`
- **New subsystem** → a new doc under `documentation/core/` and a row in `INDEX.md`
- **New convention** → extend the relevant `system-design/` file
- **Multi-session plan** → a doc under `documentation/planning/`

---

## 🔄 Phase 2: During Work

### 2.1 Code Development

- Keep changes atomic and reviewable
- Match the surrounding code's style — don't introduce a second way of doing something
- Backend: routers stay thin, logic goes in `app/services/`
- Frontend: API calls go through `lib/api/*`, never `fetch()` inline in a component

### 2.2 Documentation Updates (REQUIRED)

Update docs in the same change as the code, not afterwards. A feature that isn't in
`DAILY_CHANGES.md` is invisible to the next person.

### 2.3 Commit Message Convention

Conventional commits:

```
<type>(<scope>): <description>

[optional body]
```

**Types:** `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `style`

**Scopes used in this project:** `auth`, `admin`, `api`, `db`, `frontend`, `ui`, `docs`, `infra`

**Examples:**

```
feat(auth): hash passwords with bcrypt on register and login
fix(api): correct refresh-token cookie path so refresh actually works
docs(index): add marketplace domain plan to the doc map
refactor(frontend): move dashboard data fetching into lib/api
```

---

## ✅ Phase 3: After Completing Work

1. **Update `documentation/DAILY_CHANGES.md`** — add today's entry (see its format rules)
2. **Update `documentation/VERSION_SUMMARY.md`** if the work is a shippable feature
3. **Update the relevant `core/` or `system-design/` doc** if behaviour or a convention changed
4. **Report honestly** — if tests fail or a step was skipped, say so with the output
5. **Then ask:** "Work complete and documented. Should I commit?"

**⚠️ Never proceed past step 5 without an explicit yes.**

---

## 📝 Commit Rules

- **DO NOT** commit or push without explicit user approval — no exceptions
- **DO NOT** add AI co-authorship or attribution (`Co-Authored-By`, "Generated with …")
- **DO NOT** commit `.env`, `data/`, `.venv/`, `node_modules/`, `__pycache__` (all gitignored — keep it that way)
- **DO** use conventional commit format
- **DO** check `git status` before staging, so nothing unexpected rides along

---

## ⚠️ Critical Rules

1. **NEVER commit without explicit user approval**
2. **NEVER push to `origin` without explicit user approval**
3. **NEVER run git write commands from `/opt/lampp/htdocs`** — that is a *different* repo
   (`Leapswitch-Networks/leapswitch`, the marketing site) whose working tree shows hundreds of
   deleted files. A commit there would delete the website. This project's repo root is
   `/opt/lampp/htdocs/Partner Market Place`.
4. **NEVER delete branches** unless explicitly requested
5. **ALWAYS read project context before coding**
6. **ALWAYS update documentation alongside code**
7. **ALWAYS ask before destructive operations**
8. **NEVER print real secrets** from `.env` into output, docs, or commits

---

## 🔒 Protected Files

Require **explicit user confirmation** before editing:

| File | Reason |
|------|--------|
| `CLAUDE.md` | Agent instructions — treat as read-only |
| `AGENTS.md` (root) | Framework rules for agents |
| `documentation/AGENTS.md` | This file |
| `.env` | Environment secrets |
| `.gitignore` | Controls what can leak into a **public** repo |
| `docker-compose.yml` | Infrastructure config |
| `backend/alembic.ini`, `backend/app/db/migrations/env.py` | Migration machinery |
| `frontend/next.config.mjs`, `tailwind.config.ts`, `tsconfig.json` | Core configuration |

---

## 🔓 Repository Visibility — Handle With Care

This repo is **PUBLIC**: `https://github.com/Leapswitch-Networks/partner-marketplace`

Consequences you must respect on every change:

- Anything committed is world-readable **the moment it's pushed**, and may be cached or indexed
  even if deleted later
- Never commit real credentials, customer data, internal URLs, or partner names
- Seed/demo credentials must stay obviously fake
- Before any push, scan the diff: `git diff --cached | grep -iE "secret|password|token|api[_-]?key"`

The plaintext-password design (see `core/AUTHENTICATION.md`) is **known, accepted debt** — the
user was informed and chose to publish as-is. Don't re-raise it as a discovery; do fix it if asked,
and do treat it as a blocker before any real partner-facing launch.

---

## 🛠️ Technology Stack — Verify, Don't Assume

```bash
cat frontend/package.json      # Next.js, React, Redux, RHF, Zod, Tailwind
cat backend/requirements.txt   # FastAPI, SQLAlchemy, Alembic, Pydantic, jose, bcrypt
cat docker-compose.yml         # postgres:16-alpine + adminer + backend/frontend dev containers
cat .env                       # keys only — never echo values into output
```

| File present | Meaning |
|--------------|---------|
| `frontend/package.json` | Next.js App Router frontend |
| `backend/requirements.txt` | FastAPI backend |
| `backend/alembic.ini` | Alembic migrations |
| `docker-compose.yml` | Local Postgres + Adminer, plus dev containers for backend and frontend |
| `.venv/` | Python virtualenv at the **project root**, not in `backend/` |

---

## 🔧 Agent-Specific Configuration

| Agent | Config file | Notes |
|-------|-------------|-------|
| Claude Code | `CLAUDE.md` | Loaded at startup; chains to root `AGENTS.md` |
| OpenAI Codex / OpenCode | `AGENTS.md` | Reads this file directly |
| Gemini CLI | `GEMINI.md` | Not present — falls back to `AGENTS.md` |
| GitHub Copilot | `.github/copilot-instructions.md` | Not present |
| Cursor | `.cursor/rules/*.mdc` | Not present |

---

## 📋 Quick Reference Checklist

### Starting work
- [ ] Read `CLAUDE.md`, then `documentation/INDEX.md`
- [ ] Read the "Start Here" doc for the area
- [ ] Confirm branch is `main` and up to date
- [ ] Confirm you are in `/opt/lampp/htdocs/Partner Market Place`, not `htdocs`

### During work
- [ ] Read every file before editing it
- [ ] Business logic in services, not pages/routers
- [ ] Docs updated in the same change

### Completing work
- [ ] `DAILY_CHANGES.md` entry written
- [ ] `VERSION_SUMMARY.md` updated if shippable
- [ ] Affected `core/` / `system-design/` doc updated
- [ ] Test/verification output reported honestly
- [ ] Asked the user before committing
