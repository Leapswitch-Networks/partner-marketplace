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

> **The inherited test-platform *code* is gone as of 2026-08-06** — components, routes, models, RBAC
> permissions and database tables. These four documents are now the only trace of it, which makes the
> warning above more important, not less: they describe a product that no longer exists in this repo.

---

## Core Platform

| File | Purpose | Start Here? |
|------|---------|:-----------:|
| `core/ARCHITECTURE.md` | Application architecture, request lifecycle, folder structure, layer boundaries | Yes |
| `core/AUTHENTICATION.md` | bcrypt hashing, JWT cookie auth, approval gate, lockout, Google SSO, signup policy | |
| `core/AUTHORIZATION.md` | RBAC — roles, permissions, per-route guards, protection rules, data visibility | |
| `core/USERS.md` | The unified `users` table, what the merge migration did, admin endpoints | |

## System Design & Standards

Each file has ONE clear purpose. Load only what the task needs.

| File | Purpose | Start Here? |
|------|---------|:-----------:|
| `system-design/FASTAPI_STANDARDS.md` | **Backend only** — routers, services, SQLAlchemy 2 models, Pydantic v2 schemas, dependency injection | Any Python task |
| `system-design/NEXTJS_STANDARDS.md` | **Page & feature composition** — App Router layout, Redux slices, API layer, forms, data fetching | Building any page |
| `system-design/UI_PATTERNS.md` | **Design atoms** — brand palette, Button/Input/Skeleton, dark mode, fonts, Tailwind rules | Styling a component |
| `system-design/DATABASE_MIGRATIONS.md` | **Alembic runbook** — revision chain, writing migrations, current head, recovery | Any schema change |
| `system-design/DEPLOYMENT.md` | **Deploy runbook** — environments, build, migrate, health checks | Deploying or debugging prod |

## Design

| File | Purpose | Status |
|------|---------|--------|
| `design/VIHO_ADOPTION_PLAN.md` | **The decision and the route to it** — what was adopted, the measured cost (242 brand-colour occurrences across 37 files), the 10-phase order, and the three questions still open | **Decided 2026-08-05 · implemented app-wide 2026-08-06** |
| `design/VIHO_THEME_REFERENCE.md` | Design tokens extracted from the **Viho** theme — colour hex values, contrast audit, type scale, spacing, login-screen anatomy, component anatomy, and the 36-screenshot catalogue | **Adopted in full 2026-08-05** — reference for what Viho looks like |
| `design/assets/screenshots/` | Reference screenshots + the rules for adding them to a public repo | **Temporary — delete after the UI/UX component build-out** ([why, and the catch](design/assets/screenshots/README.md#retirement--these-are-temporary-by-decision)) |

> ⚠️ **`system-design/UI_PATTERNS.md` remains authoritative for how our UI is actually built.** Viho
> was adopted on 2026-08-05 and implemented across every route on 2026-08-06, so the two now agree —
> but when they drift, `UI_PATTERNS.md` describes reality and the design folder describes the theme.
> What is still outstanding is listed in `VIHO_ADOPTION_PLAN.md`'s phase table. Viho is a **paid**
> template — its source is not in this repo, and its illustrations are deliberately not reproduced.

## Planning

Planning docs are **reference only** — they describe intent, not current state. Check the code.

| File | Purpose | Status |
|------|---------|--------|
| `planning/LEAPDESK_PARITY_PLAN.md` | Port spec for LeapDesk's eight core admin modules + the Settings area — schemas, endpoints, permissions, build order | **Spec — awaiting review. Current focus** |
| `planning/MARKETPLACE_DOMAIN_PLAN.md` | Marketplace domain model — partners, tiers, customers, catalog, quotes | Design — **parked** pending LeapDesk parity |
| `planning/SCAFFOLD_CLEANUP_PLAN.md` | Retiring the inherited test-platform domain | **Tiers 2–3 executed 2026-08-06** — the domain is gone. Tier 1 housekeeping remains |
| `planning/CORE_HARDENING_PLAN.md` | The platform layer under the features — config safety, transactions, tests/CI, API versioning, the frontend data layer. PM-37 to PM-44 | **Active — PM-37/38/39 closed 2026-08-06** |
| `planning/DYNAMIC_BRANDING_PLAN.md` | Making project identity (name, monogram, favicon, theme) configurable so the core is reusable across projects — 34 hardcoded sites, and why only some should become runtime-dynamic | Design — **awaiting review** |
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
├── design/                  ← Adopted theme reference + the plan to implement it
│   ├── VIHO_ADOPTION_PLAN.md    ← the decision, the cost, the phase order
│   ├── VIHO_THEME_REFERENCE.md
│   └── assets/screenshots/  ← owner-supplied screenshots
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
