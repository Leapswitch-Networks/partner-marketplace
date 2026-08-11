<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

**Installed: Next.js 14.2.35, App Router, React 18.3.1.** Your training data likely assumes 15 or 16.
Anything you "remember" about `cacheComponents`, `use cache`, async `params`/`searchParams`, or the
Next 16 defaults **does not apply here** and will not compile.

Verify against the installed tree before writing Next.js code — never from memory:

```bash
node -e "console.log(require('./frontend/node_modules/next/package.json').version)"
```

> This block used to say "read the relevant guide in `node_modules/next/dist/docs/`". **That
> directory does not exist** — not on the host, not in the container. Next ships bundled agent docs
> from 16.x; 14.2.35 does not. Corrected 2026-08-11 after checking both trees. If this project ever
> upgrades to a Next that ships `dist/docs/`, restore the original instruction.
<!-- END:nextjs-agent-rules -->

---

# Partner Marketplace — Operating Contract

Everything below is **always in context**. It is the short list you may not violate. The full
process — startup banner, phases, conventional-commit scopes, checklists — lives in
[`documentation/AGENTS.md`](documentation/AGENTS.md), which is **deliberately not imported here**:
imports load eagerly into every session, and 300 lines of process is not worth that on every turn.
Read it when you start real work.

## 0. First response in any session

Read `CLAUDE.md` → this file before emitting any text. Then display the banner in
`documentation/AGENTS.md` § Startup Announcement and state
"Ready to work on Partner Marketplace. What would you like me to work on?"

Never describe the stack from memory — read `frontend/package.json`, `backend/requirements.txt` and
`docker-compose.yml`. Never call this a test/assessment platform; that is the deleted scaffold's
identity, not this project's.

## 1. Non-negotiable

| # | Rule |
|---|------|
| 1 | **Never commit or push without explicit user approval.** Ask every time, and wait for a yes |
| 2 | **Never add AI attribution** — no `Co-Authored-By`, no "Generated with" |
| 3 | **Never run a git write command from `/opt/lampp/htdocs`.** That is a *different* repo (`Leapswitch-Networks/leapswitch`, the marketing site) with hundreds of deleted files in its tree — a commit there **would delete the website**. This project's root is `/opt/lampp/htdocs/Partner Market Place` |
| 4 | **Never delete branches** unless explicitly asked. Branch is `main`, never `master` |
| 5 | **Read a file before you modify it.** No exceptions |
| 6 | **Ask before any destructive operation** |
| 7 | **This repo is PUBLIC.** Never commit real credentials, customer data, internal URLs or partner names. Seed/demo credentials stay obviously fake. Never echo `.env` *values* into output, docs or commits — key names only |
| 8 | **Never commit** `.env`, `data/`, `.venv/`, `node_modules/`, `__pycache__` |
| 9 | **Update `documentation/DAILY_CHANGES.md` in the same change as the code**, not after |
| 10 | **Report honestly.** If a check failed or a step was skipped, say so with the output |

**Protected files — require explicit user confirmation before editing:** `CLAUDE.md`, `AGENTS.md`
(this file), `documentation/AGENTS.md`, `.env`, `.gitignore`, `docker-compose.yml`,
`backend/alembic.ini`, `backend/app/db/migrations/env.py`, `frontend/next.config.mjs`,
`tailwind.config.ts`, `tsconfig.json`.

Before any push: `git status`, then
`git diff --cached | grep -iE "secret|password|token|api[_-]?key"`.

The plaintext-password design is **known, accepted debt**. Don't re-raise it as a discovery; do fix
it if asked; it is a hard blocker before any partner-facing launch.

## 2. Model tiering — the default execution mode

**Opus orchestrates and validates; Sonnet subagents implement.** Sonnet is far cheaper per token,
so run this split unless told otherwise.

**The orchestrator (Opus) keeps for itself:**

- Planning and architecture, and writing the precise spec each subagent works from
- The **risky** code: Alembic migrations and any schema change · RBAC, permissions, auth, sessions,
  cookies · `backend/app/core/` · API contracts and shared boundaries · anything in Protected Files
- **All validation and reconciliation.** Opus never rubber-stamps a subagent's output — it verifies
  before accepting

**Sonnet subagents (`sonnet-implementer`) take the volume:** bounded, well-specified, mechanical
work — repetitive CRUD, file moves, string/URL rewrites, boilerplate routers · services · Pydantic
schemas · components · tests generated from a spec.

**Escalation:** if a subagent's output is wrong twice, or the task turns out to need real judgment,
Opus takes it over directly rather than burning tokens on rework.

**External agents (OpenCode/Gemini) and local models (Ollama) are not the default.** Prefer
in-session subagents — coordinated, no hand-off, no working-tree collisions. Use an external model
only when the user asks, and isolate it on its own git worktree/branch with a disjoint file set. The
orchestrator still validates the result. Treat a local Ollama model as a text generator (docstrings,
seed data, drafts), never an autonomous coding agent.

## 3. Multi-worker execution

- **Divide independent work** into packages that can proceed concurrently
- **No overlapping file ownership.** Two workers must never hold the same file. Partition on file or
  module boundaries and hand each worker an **explicit, non-overlapping file list**
- **One worker owns an atomic refactor end-to-end.** Never split one across workers
- **Chain approved packages automatically.** When a worker finishes and approved work remains, start
  the next package without asking. This does not extend to committing — rule 1 still holds
- Prefer clear boundaries up front over fine-grained coordination mid-flight

## 4. Verification gate

Nothing is "done" until it has been run. Use these exact commands:

```bash
docker compose exec frontend npm run typecheck                 # frontend
docker compose exec frontend npm run lint                      # frontend
docker compose run --rm --no-deps backend sh -c "pip install -q pytest ruff && python -m pytest -q && ruff check ."
docker compose run --rm backend alembic current                # after any migration
```

Two project-specific traps that override the generic advice:

- ⚠️ **`npm run build` is NOT part of the gate — never run it in the dev container.** `.next` is a
  volume shared with the running dev server; a production build replaces the dev output and every
  `_next/static` request then 404s as an HTML page, which the browser misreports as a MIME-type
  fault. `typecheck` and `lint` are the gate; CI runs the real build on its own checkout.
- ⚠️ **`docker compose run --rm`, never `exec`, for anything touching the database.** `exec` skips
  the entrypoint that rewrites `DATABASE_URL` and fails with a misleading `connection refused`.

## 5. Layer boundaries

| Layer | Rule |
|-------|------|
| Backend routers (`app/api/`) | Thin — HTTP concerns only |
| Backend logic | `app/services/`, never a router |
| SQLAlchemy 2 | **Synchronous.** `def` endpoints, not `async def`. `asyncpg` is not installed |
| Frontend data | Through `lib/api/*`. Never `fetch()` inline in a component |
| Authenticated data | Client-side — the `httpOnly` cookie cannot be forwarded server-side |
| Public data | Server-side via `INTERNAL_API_URL`. Getting these two backwards fails **silently** |
| Business logic | Never in a page or component |

## 6. Where the rest lives

| Need | File |
|------|------|
| Full agent workflow, phases, checklists | [`documentation/AGENTS.md`](documentation/AGENTS.md) |
| The doc map — which single file to read | [`documentation/INDEX.md`](documentation/INDEX.md) |
| Running it locally | [`README.md`](README.md) § Running Locally with Docker |
| Backend conventions | `documentation/system-design/FASTAPI_STANDARDS.md` |
| Frontend conventions | `documentation/system-design/NEXTJS_STANDARDS.md` |
| Styling | `documentation/system-design/UI_PATTERNS.md` |
| Schema changes | `documentation/system-design/DATABASE_MIGRATIONS.md` |
| Auth | `documentation/core/AUTHENTICATION.md` + `AUTHORIZATION.md` |
| Known defects — don't re-report as new | `documentation/planning/TECH_DEBT.md` |

Planning docs are **intent, not current state** — check the code before trusting them. The four
lowercase files in `documentation/` (`architecture.md`, `instruction.md`, `phases.md`,
`planning.md`) describe a **deleted** product. Never cite them as how this project works.
