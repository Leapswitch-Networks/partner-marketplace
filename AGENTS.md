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

> **This is the only agent contract in this repository.** It was merged from two files on
> **2026-08-18**. `documentation/AGENTS.md` used to carry the workflow half and is now a pointer to
> this file — see [ADR-0016](documentation/adr/0016-one-agent-contract.md) for why, including the
> contradiction the split had already produced.

`CLAUDE.md` imports this file, and that import is the only thing that loads automatically. Everything
below is therefore always in context. Read it in full; it is the short list you may not violate.

## 0. First response in any session

Read `CLAUDE.md` → this file before emitting any text. Then display this banner:

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

Then state: "Ready to work on Partner Marketplace. What would you like me to work on?"

**Never describe the stack from memory** — read `frontend/package.json`, `backend/requirements.txt`
and `docker-compose.yml`. Quoting a version from prose is how the inherited `README.md` came to be
wrong in twelve places (PM-12).

**Never call this a test/assessment platform.** That is the deleted scaffold's identity, not this
project's — see [ADR-0002](documentation/adr/0002-keep-the-inherited-scaffold.md).

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

Anything committed here is world-readable **the moment it is pushed**, and may be cached or indexed
even if deleted later.

~~The plaintext-password design is **known, accepted debt**.~~ **Corrected 2026-08-17 — this was
stale.** Passwords have been bcrypt-hashed since 2026-07-31 (TECH_DEBT PM-1, closed);
`core/security.py` hashes with a configurable cost and its docstring forbids reintroducing a
comparison anywhere else. `verify_password` is the only place a supplied password meets a stored
one. Don't re-raise plaintext storage as a discovery **and don't repeat this line as current
state** — it described the pre-rebuild code and outlived it by two and a half weeks.
See [ADR-0005](documentation/adr/0005-bcrypt-directly-not-passlib.md).

The one thing that *is* still outstanding from PM-1: credentials that existed before the rebuild
were readable at the time, so those passwords should be rotated.

## 2. Model tiering — the default execution mode

**Opus orchestrates and validates; Sonnet subagents implement.** Sonnet is far cheaper per token,
so run this split unless told otherwise. Recorded as
[ADR-0014](documentation/adr/0014-opus-orchestrates-sonnet-implements.md).

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

Two project-specific traps that override the generic advice — both recorded in
[ADR-0013](documentation/adr/0013-compose-is-development-only.md):

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

Match the surrounding code's style. **Don't introduce a second way of doing something.**

## 6. Working rhythm

**Before starting.** Confirm you are in `/opt/lampp/htdocs/Partner Market Place` and on `main`
(`git branch --show-current`). Read `documentation/INDEX.md`, then the one **Start Here** doc for
your area — § 7 below is the map. Before changing the *shape* of anything, check
[`documentation/ADR.md`](documentation/ADR.md): a decision listed there as **Accepted** is settled.

Branch only when asked, or when work spans sessions. If you do: `feature/<name>`, `fix/<name>`,
`hotfix/<name>`, `refactor/<name>`, `docs/<name>`.

**During.** Keep changes atomic and reviewable. Decide up front where the change gets recorded:

| Change | Recorded in |
|--------|-------------|
| Every task | an entry in `documentation/DAILY_CHANGES.md` |
| A new subsystem | a doc under `documentation/core/`, plus a row in `INDEX.md` |
| A new convention | the relevant `documentation/system-design/` file |
| A multi-session plan | a doc under `documentation/planning/` |
| A settled architectural decision | a record under `documentation/adr/`, plus a row in `ADR.md` |

**Commits** are conventional: `<type>(<scope>): <description>`.
Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `style`, `build`.
Scopes in use: `auth`, `authz`, `admin`, `api`, `core`, `db`, `ui`, `frontend`, `docs`, `infra`,
`deploy`, `test`, and module names (`users`, `roles`, `invitations`, `webhooks`, `ai`).

**After.** Run the § 4 gate. Update `DAILY_CHANGES.md`, and `VERSION_SUMMARY.md` if the work is a
shippable feature. Update the affected `core/` or `system-design/` doc if behaviour or a convention
changed. Report the verification output honestly — including failures and anything skipped. **Then
ask before committing, and wait.**

## 7. Where the rest lives

| Need | File |
|------|------|
| **Why something is built this way — settled decisions** | [`documentation/ADR.md`](documentation/ADR.md) |
| The doc map — which single file to read | [`documentation/INDEX.md`](documentation/INDEX.md) |
| Running it locally | [`README.md`](README.md) § Running Locally with Docker |
| Backend conventions | `documentation/system-design/FASTAPI_STANDARDS.md` |
| Frontend conventions | `documentation/system-design/NEXTJS_STANDARDS.md` |
| Styling | `documentation/system-design/UI_PATTERNS.md` |
| Schema changes | `documentation/system-design/DATABASE_MIGRATIONS.md` |
| Deploying | `documentation/system-design/DEPLOYMENT.md` |
| Auth | `documentation/core/AUTHENTICATION.md` + `AUTHORIZATION.md` |
| Known defects — don't re-report as new | `documentation/planning/TECH_DEBT.md` |

Planning docs are **intent, not current state** — check the code before trusting them. The four
lowercase files in `documentation/` (`architecture.md`, `instruction.md`, `phases.md`,
`planning.md`) describe a **deleted** product. Never cite them as how this project works.

## 8. Which file each agent reads

| Agent | Entry point | Note |
|-------|-------------|------|
| Claude Code | `CLAUDE.md` | Loaded automatically; imports this file |
| OpenAI Codex / OpenCode | `AGENTS.md` (root) | Reads this file directly |
| Gemini CLI | `GEMINI.md` | Not present — falls back to this file |
| GitHub Copilot | `.github/copilot-instructions.md` | Not present |
| Cursor | `.cursor/rules/*.mdc` | Not present |

Subdirectory `AGENTS.md` files are **never auto-discovered** — only `CLAUDE.md` files are. That is
why a second contract in `documentation/` was unreachable by this chain until 2026-08-11, and part of
why there is now only one.
