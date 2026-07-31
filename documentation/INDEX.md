# Partner Marketplace Documentation Index

> Single source of truth for all project documentation.
> If you're an AI agent, read the **Start Here** file for each area you're working on.

---

## ⚠️ Read This First — Project State

Partner Marketplace is a **new project built on an inherited scaffold**. The folder was renamed
from a logic-test / recruitment platform on **2026-07-30**; the tech stack and folder structure
were kept deliberately, the product it serves is being replaced.

That means two kinds of content live side by side:

| Kind | What it is | Trust it? |
|------|------------|:---------:|
| **Marketplace docs** | Everything in this index below — written against the code as it actually is today | Yes |
| **Inherited test-platform docs** | `architecture.md`, `instruction.md`, `phases.md`, `planning.md` — all inside this folder | **No** — stale, describes the old product |

The inherited docs were kept on purpose (nothing was stripped), but they describe features that
are **not** what this project is becoming. Never cite them as current state.

---

## Core Platform

| File | Purpose | Start Here? |
|------|---------|:-----------:|
| `core/ARCHITECTURE.md` | Application architecture, request lifecycle, folder structure, layer boundaries | Yes |
| `core/AUTHENTICATION.md` | JWT cookie auth, dual user/admin identity, refresh flow, **known plaintext-password debt** | |
| `core/AUTHORIZATION.md` | Roles, FastAPI dependency guards, route protection, frontend middleware | |
| `core/USERS.md` | `users` + `admin_users` tables, profile management, admin CRUD | |

## System Design & Standards

Each file has ONE clear purpose. Load only what the task needs.

| File | Purpose | Start Here? |
|------|---------|:-----------:|
| `system-design/FASTAPI_STANDARDS.md` | **Backend only** — routers, services, SQLAlchemy 2 models, Pydantic v2 schemas, dependency injection | Any Python task |
| `system-design/NEXTJS_STANDARDS.md` | **Page & feature composition** — App Router layout, Redux slices, API layer, forms, data fetching | Building any page |
| `system-design/UI_PATTERNS.md` | **Design atoms** — brand palette, Button/Input/Skeleton, dark mode, fonts, Tailwind rules | Styling a component |
| `system-design/DATABASE_MIGRATIONS.md` | **Alembic runbook** — revision chain, writing migrations, current head, recovery | Any schema change |
| `system-design/DEPLOYMENT.md` | **Deploy runbook** — environments, build, migrate, health checks | Deploying or debugging prod |

## Planning

Planning docs are **reference only** — they describe intent, not current state. Check the code.

| File | Purpose | Status |
|------|---------|--------|
| `planning/MARKETPLACE_DOMAIN_PLAN.md` | Marketplace domain model — partners, listings, orders | **Blocked** — awaiting product scope |
| `planning/SCAFFOLD_CLEANUP_PLAN.md` | Retiring the inherited test-platform domain when the marketplace domain lands | Planning |
| `planning/TECH_DEBT.md` | Known defects and inconsistencies carried in from the scaffold, ranked | Active |

## Project Tracking

| File | Purpose |
|------|---------|
| `VERSION_SUMMARY.md` | Feature releases across all versions |
| `DAILY_CHANGES.md` | One entry per task — updated after every feature/fix |
| `ONBOARDING.md` | Local setup guide for a fresh machine |
| `AGENTS.md` | AI agent workflow & git instructions |
| `../CLAUDE.md` | AI agent instructions — mandatory reading (must stay in root) |

## Inherited — Do Not Trust

| File | Was | Why it's kept |
|------|-----|---------------|
| `architecture.md` | Test-platform system design | Reference for the scaffold's original intent |
| `phases.md` | Test-platform build plan | Records how the scaffold was built |
| `planning.md` | Test-platform project plan | Module breakdown and UX decisions of the old product |
| `instruction.md` | Test-platform coding standards | Superseded by `system-design/` |

---

## Folder Structure

```
documentation/
├── INDEX.md                 ← You are here
├── AGENTS.md                ← AI agent workflow
├── ONBOARDING.md            ← Local setup
├── VERSION_SUMMARY.md       ← Release tracking
├── DAILY_CHANGES.md         ← Per-task log
├── core/                    ← Architecture, auth, authorization, users
├── system-design/           ← Standards, patterns, migrations, deployment
├── planning/                ← Domain plan, cleanup plan, tech debt
├── architecture.md          ← inherited (stale)
├── instruction.md           ← inherited (stale)
├── phases.md                ← inherited (stale)
└── planning.md              ← inherited (stale)
```

> **Only three `.md` files live outside this folder** — `README.md`, `CLAUDE.md` and `AGENTS.md` at the
> project root. Everything else belongs here. There is exactly **one** README in the project.

---

## For AI Agents

1. **Always read `CLAUDE.md` first** (project root) — it chains to `AGENTS.md`
2. **Then read the "Start Here" file** for the area you're working on
3. **Don't read everything** — use the tables above to find the right file
4. **If a file is >500 lines**, read only the sections relevant to your task
5. **Planning docs are reference only** — don't treat them as current state; check the actual code
6. **Never cite the inherited test-platform docs** as how this project works
7. **This project is NOT the Next.js you know** — per `../AGENTS.md`, read
   `node_modules/next/dist/docs/` before writing Next.js code
