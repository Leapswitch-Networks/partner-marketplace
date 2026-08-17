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
| `design/LOGO_BRIEF.md` | **Hand-off spec for a logo designer** — the two surfaces, the 32px size floor, upload constraints, every brand hex, the eight swappable presets, and the measured contrast that rules out a single-colour mark | **Ready to hand over** |
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
The one exception is `planning/PLANNING.md`, which records state *measured* on its stated date; when
it and another register disagree, it says so and names the one that is stale.

| File | Purpose | Status |
|------|---------|--------|
| `planning/PLANNING.md` | **The working plan — start here.** What is in flight now, what is next, what is blocked and on whom. State verified against the running system, not copied from the other registers | **Live — 2026-08-07** |
| `planning/CORE_COMPLETION_PLAN.md` | **How the core gets to 100%.** The Index/Form/Show contract every module follows, the shared backend and frontend layers to build first, module-by-module state, build order, and what we deliberately do *not* copy from LeapDesk | **Live — 2026-08-07** |
| `planning/LEAPDESK_PARITY_PLAN.md` | Port spec for LeapDesk's core: **18 modules + Recycle Bin** — schemas, endpoints, permissions, build order. Modules 1–10 are business objects; **11–18 are operations surfaces and most are not CRUD** — read that section before assuming the Users shape applies | **Spec — 18 modules as of 2026-08-11.** Progress table re-audited against code that day. Module 16 (Queue Monitor) is **blocked**: we have no queue |
| `planning/MODULE_PARITY_PLAN.md` | **Bringing every module to the Users index.** All 57 changes made to Users on 10–11 August as a checklist, a measured matrix of which module has each one, and the order to apply them. § 4 records the three structural decisions as taken; § 5 is the caution that matters | **Steps 1–4 done 2026-08-11** — Roles, Invitations and Activity are on the Users structure. `ProfileForm` sections and the sort-key audit remain |
| `planning/FRONTEND_PLAN.md` | **The one register of frontend routes.** Every page across the four surfaces — public directory, auth, partner back office, staff admin — with who sees it, what phase it lands in, whether it is built, and where its spec lives. **43 pages built today, 29 to come, 72 at the end.** § 8 records four things measured in the tree that the directory plan gets wrong | **New — 2026-08-17.** Statuses measured, not copied |
| `planning/PARTNER_DIRECTORY_PLAN.md` | **"Justdial, but only for our partners"** — the directory/listing product: research on Justdial's actual mechanics, comparable curated partner directories, a listing + enquiry domain model, the public-surface and scoping consequences, and the ten decisions the owner has to make. **Read § 0.1 first — the decisions, as taken.** § 7.1 explains why the actor type is a core decision, not a directory one | **Decided in shape 2026-08-10** — directory · public · 300+ partners. Six decisions still open; nothing built |
| `planning/MARKETPLACE_DOMAIN_PLAN.md` | Marketplace domain model — partners, tiers, customers, catalog, quotes | **Partly superseded 2026-08-10.** Its `partners` / `partner_tiers` / scoping foundation is adopted; the catalog, quotes and quote machine are **shelved** |
| `planning/SCAFFOLD_CLEANUP_PLAN.md` | Retiring the inherited test-platform domain | **Tiers 2–3 executed 2026-08-06** — the domain is gone. Tier 1 housekeeping remains |
| `planning/CORE_HARDENING_PLAN.md` | The platform layer under the features — config safety, transactions, tests/CI, API versioning, the frontend data layer. PM-37 to PM-44 | **Active — PM-37/38/39 closed 2026-08-06** |
| `planning/CORE_EXTRACTION_PLAN.md` | **Making the core reusable for a second project.** The five places the partner domain leaks into the platform layer, the registration seam that removes them, the tenancy rename that must land *before* PM-5's 258-signature sweep, and the frontend data layer. A phase-by-phase code-level checklist | **New — 2026-08-17.** Phase 0 not started |
| `planning/DYNAMIC_BRANDING_PLAN.md` | Project identity — name, monogram, tagline, theme, logo, favicon — configurable so the core is reusable across projects. **Read § 6 to rebrand a deployment**, § 7 for how theming and uploads work | **All four phases shipped 2026-08-06** |
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
│   ├── LOGO_BRIEF.md            ← hand-off spec for a logo designer
│   └── assets/screenshots/  ← owner-supplied screenshots (+ its own README)
├── planning/                ← Domain plan, frontend page register, cleanup plan, tech debt
├── architecture.md          ← inherited (stale)
├── instruction.md           ← inherited (stale)
├── phases.md                ← inherited (stale)
└── planning.md              ← inherited (stale)
```

**32 `.md` files live under `documentation/`.** The root `README.md` carries a one-line-per-file
version of the tables above; this index stays the detailed one. Keep both in step when adding a doc.

> **Only three `.md` files live outside this folder** — `README.md`, `CLAUDE.md` and `AGENTS.md` at
> the project root. Everything else belongs here. There are **two** READMEs: the project one in the
> root, and `design/assets/screenshots/README.md`, which documents that folder's contents and its
> public-repo rules. It goes away when the screenshots do.

---

## For AI Agents

1. **Always read `CLAUDE.md` first** (project root) — it chains to `AGENTS.md`
2. **Then read the "Start Here" file** for the area you're working on
3. **Don't read everything** — use the tables above to find the right file
4. **If a file is >500 lines**, read only the sections relevant to your task
5. **Planning docs are reference only** — don't treat them as current state; check the actual code
6. **Never cite the inherited test-platform docs** as how this project works
7. **This project is NOT the Next.js you know** — it is **14.2.35**, not 15 or 16. ⚠️ **Corrected
   2026-08-17:** this line used to say *"read `node_modules/next/dist/docs/`"*. **That directory does
   not exist** — Next ships bundled agent docs from 16.x only. The root `AGENTS.md` corrected the
   same instruction on 2026-08-11; this copy outlived it. Verify against the installed tree instead:
   `node -e "console.log(require('./frontend/node_modules/next/package.json').version)"`
