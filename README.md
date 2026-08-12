# Partner Marketplace

A full-stack web application built on Next.js and FastAPI, backed by PostgreSQL.

> **Project status: early.** The marketplace domain has not been built yet. What exists today is a
> working foundation — authentication, an admin dashboard shell, and local infrastructure — inherited
> from a previous logic-test platform whose tech stack and folder structure were kept deliberately.
>
> The inherited test/question/candidate domain has been **deleted** (2026-08-06) — code, RBAC rows and
> database tables. See [`documentation/planning/SCAFFOLD_CLEANUP_PLAN.md`](documentation/planning/SCAFFOLD_CLEANUP_PLAN.md).

---

## Documentation

**Start at [`documentation/INDEX.md`](documentation/INDEX.md)** — it's the doc map, and it tells you
which single file to read for the area you're working on rather than making you read everything.

| I want to… | Read |
|------------|------|
| Set up locally | [`documentation/ONBOARDING.md`](documentation/ONBOARDING.md) |
| Understand the architecture | [`documentation/core/ARCHITECTURE.md`](documentation/core/ARCHITECTURE.md) |
| Work on the backend | [`documentation/system-design/FASTAPI_STANDARDS.md`](documentation/system-design/FASTAPI_STANDARDS.md) |
| Work on the frontend | [`documentation/system-design/NEXTJS_STANDARDS.md`](documentation/system-design/NEXTJS_STANDARDS.md) |
| Change the database schema | [`documentation/system-design/DATABASE_MIGRATIONS.md`](documentation/system-design/DATABASE_MIGRATIONS.md) |
| Know what's broken | [`documentation/planning/TECH_DEBT.md`](documentation/planning/TECH_DEBT.md) |
| See what changed recently | [`documentation/DAILY_CHANGES.md`](documentation/DAILY_CHANGES.md) |

If you are an AI coding agent, read [`CLAUDE.md`](CLAUDE.md) and
[`documentation/AGENTS.md`](documentation/AGENTS.md) first.

### Every documentation file, and what it's for

The full inventory — **31 Markdown files** under `documentation/`, plus three at the project root.
`INDEX.md` carries the same map with more detail per file and is the one to keep authoritative;
this table exists so you can see the whole shape without opening anything.

**Project root**

| File | Purpose |
|------|---------|
| [`README.md`](README.md) | This file — what the project is, how to start it, where the docs are |
| [`CLAUDE.md`](CLAUDE.md) | Entry point for AI coding agents; chains straight to root `AGENTS.md` |
| [`AGENTS.md`](AGENTS.md) | Framework warning — this Next.js differs from training data, read `node_modules/next/dist/docs/` first |

**`documentation/` — tracking and process**

| File | Purpose |
|------|---------|
| [`INDEX.md`](documentation/INDEX.md) | **The doc map.** Which single file to read per area, plus which docs not to trust |
| [`ONBOARDING.md`](documentation/ONBOARDING.md) | Local setup on a fresh machine — both paths (all-Docker, apps-on-host), ports, gotchas, day-to-day commands |
| [`AGENTS.md`](documentation/AGENTS.md) | AI agent workflow — startup banner, git and commit rules, protected files, public-repo handling |
| [`DAILY_CHANGES.md`](documentation/DAILY_CHANGES.md) | One entry per task, newest first, in plain business English. Updated with every change |
| [`VERSION_SUMMARY.md`](documentation/VERSION_SUMMARY.md) | Feature releases across versions |

**`documentation/core/` — how the platform actually works today**

| File | Purpose |
|------|---------|
| [`ARCHITECTURE.md`](documentation/core/ARCHITECTURE.md) | Request lifecycle, folder structure, layer boundaries — the app as it exists now |
| [`AUTHENTICATION.md`](documentation/core/AUTHENTICATION.md) | bcrypt hashing, JWT cookie auth, approval gate, lockout, Google SSO, signup policy |
| [`AUTHORIZATION.md`](documentation/core/AUTHORIZATION.md) | RBAC — roles, permissions, per-route `require_permission` guards, data visibility |
| [`USERS.md`](documentation/core/USERS.md) | The unified `users` table, what the merge migration did, admin endpoints |

**`documentation/system-design/` — conventions to follow when writing code**

| File | Purpose |
|------|---------|
| [`FASTAPI_STANDARDS.md`](documentation/system-design/FASTAPI_STANDARDS.md) | **Backend only** — routers, services, SQLAlchemy 2 models, Pydantic v2 schemas, dependency injection |
| [`NEXTJS_STANDARDS.md`](documentation/system-design/NEXTJS_STANDARDS.md) | **Page composition** — App Router layout, Redux slices, API layer, forms, data fetching |
| [`UI_PATTERNS.md`](documentation/system-design/UI_PATTERNS.md) | **Design atoms** — palette, typography, primitives, dark mode, Tailwind rules. Authoritative for how the UI is really built |
| [`DATABASE_MIGRATIONS.md`](documentation/system-design/DATABASE_MIGRATIONS.md) | Alembic runbook — revision chain, writing migrations, current head, recovery |
| [`DEPLOYMENT.md`](documentation/system-design/DEPLOYMENT.md) | Deploy readiness **gap analysis** — nothing has ever been deployed; § 0 lists the hard blockers |

**`documentation/design/` — the adopted visual direction**

| File | Purpose |
|------|---------|
| [`VIHO_THEME_REFERENCE.md`](documentation/design/VIHO_THEME_REFERENCE.md) | Design tokens extracted from the Viho theme — hex values, contrast audit, type scale, component anatomy |
| [`VIHO_ADOPTION_PLAN.md`](documentation/design/VIHO_ADOPTION_PLAN.md) | The adoption decision, its measured cost, and the phase order to implement it |
| [`LOGO_BRIEF.md`](documentation/design/LOGO_BRIEF.md) | Hand-off spec for a logo designer — surfaces, size floor, every brand hex, upload constraints |
| [`assets/screenshots/README.md`](documentation/design/assets/screenshots/README.md) | What the 36 reference screenshots are, and the rules for keeping them in a **public** repo. Temporary by decision |

**`documentation/planning/` — intent, not current state. Check the code before trusting any of it.**

| File | Purpose | Status |
|------|---------|--------|
| [`PLANNING.md`](documentation/planning/PLANNING.md) | **The working plan — start here.** In flight, next, blocked. Verified against the running system | Live |
| [`CORE_COMPLETION_PLAN.md`](documentation/planning/CORE_COMPLETION_PLAN.md) | How the core reaches 100% — the Index/Form/Show contract, shared layers, build order | Live |
| [`CORE_HARDENING_PLAN.md`](documentation/planning/CORE_HARDENING_PLAN.md) | The platform layer beneath the features — config safety, transactions, tests/CI, API versioning (PM-37…PM-44) | Active |
| [`LEAPDESK_PARITY_PLAN.md`](documentation/planning/LEAPDESK_PARITY_PLAN.md) | Port spec for LeapDesk's core — 18 modules plus Recycle Bin | Spec — 18 modules, 2026-08-11 |
| [`MODULE_PARITY_PLAN.md`](documentation/planning/MODULE_PARITY_PLAN.md) | The 57 changes made to the Users index on 10–11 Aug, as a checklist, plus which modules have each | Steps 1–4 done — 2026-08-11 |
| [`PARTNER_DIRECTORY_PLAN.md`](documentation/planning/PARTNER_DIRECTORY_PLAN.md) | **The product.** Verified partners author listings from a back office; the public browses and enquires. Listing + enquiry domain model, public-surface and scoping consequences. **Read § 0.1 for the decisions as taken** | Decided in shape — nothing built |
| [`MARKETPLACE_DOMAIN_PLAN.md`](documentation/planning/MARKETPLACE_DOMAIN_PLAN.md) | Reseller-quoting domain model. Its `partners` / `partner_tiers` / scoping foundation is adopted; catalog and quotes are shelved | Partly superseded |
| [`DYNAMIC_BRANDING_PLAN.md`](documentation/planning/DYNAMIC_BRANDING_PLAN.md) | Making name, monogram, tagline, theme and logo configurable so the core is reusable. **§ 6 rebrands a deployment** | Shipped |
| [`SCAFFOLD_CLEANUP_PLAN.md`](documentation/planning/SCAFFOLD_CLEANUP_PLAN.md) | Retiring the inherited test-platform domain | Executed — housekeeping left |
| [`TECH_DEBT.md`](documentation/planning/TECH_DEBT.md) | Every known defect, ranked by severity. Reference the ID; don't re-report an item as new | Active |

**`documentation/` — inherited from the old test platform. ⚠️ Do not cite as current state.**

These four describe a product that **no longer exists in this repo** — its code was deleted on
2026-08-06. They're kept as a record of the scaffold's original intent, nothing more.

| File | What it was |
|------|-------------|
| [`architecture.md`](documentation/architecture.md) | Test-platform system design — superseded by `core/ARCHITECTURE.md` |
| [`instruction.md`](documentation/instruction.md) | Test-platform coding standards — superseded by `system-design/` |
| [`phases.md`](documentation/phases.md) | Test-platform build plan, phase by phase |
| [`planning.md`](documentation/planning.md) | Test-platform project plan — module breakdown and UX decisions of the old product |

---

## Tech Stack

Deliberately no version table — it goes stale silently. The lockfiles are the source of truth:

| Layer | Read the versions from |
|-------|------------------------|
| Frontend | [`frontend/package.json`](frontend/package.json) |
| Backend | [`backend/requirements.txt`](backend/requirements.txt) |
| Database | [`docker-compose.yml`](docker-compose.yml) |

**Frontend** — Next.js (App Router) · React · TypeScript · Tailwind CSS · Redux Toolkit ·
React Hook Form + Zod · Axios

**Backend** — FastAPI · SQLAlchemy 2 (synchronous) · Alembic · Pydantic v2 · python-jose

**Infrastructure** — Docker Compose, with four services for local development: PostgreSQL, Adminer,
and **development containers for the backend and frontend** that bind-mount your source and run the
reload-enabled dev servers. Running the two apps directly on your host is still supported as an
alternative. There is **no** Nginx and no queue, and the app containers are **development-only** —
a production topology has not been defined yet.

---

## Project Structure

```
Partner Market Place/
├── frontend/               # Next.js App Router application
│   ├── app/                # routes: (auth) group, dashboard
│   ├── components/         # common/, auth/, dashboard/, admin/, settings/
│   ├── lib/                # api/, store/, hooks/, utils/
│   ├── middleware.ts       # edge route protection
│   └── Dockerfile.dev      # dev container: node 20, npm ci, next dev
├── backend/                # FastAPI application
│   ├── app/
│   │   ├── api/            # routers
│   │   ├── core/           # config, security, dependencies
│   │   ├── db/             # session, base, migrations, seeder
│   │   ├── models/         # SQLAlchemy models
│   │   ├── schemas/        # Pydantic v2 schemas
│   │   └── services/       # business logic
│   ├── Dockerfile.dev      # dev container: python 3.12, uvicorn --reload
│   └── docker-entrypoint.dev.sh   # points DATABASE_URL at the db service
├── documentation/          # all project docs — start at INDEX.md
├── docker-compose.yml      # db + adminer + backend + frontend (local dev only)
└── data/db/                # local Postgres cluster (gitignored)
```

---

## Running Locally with Docker

Everything below runs from the **project root** — the directory holding `docker-compose.yml` — and
every command is copy-pasteable. This is the recommended path; the only prerequisites are **Docker**
and **Compose v2**. Nothing needs Python or Node on your machine.

[`documentation/ONBOARDING.md`](documentation/ONBOARDING.md) remains the single source of truth; it
carries the host-based alternative and the full gotcha list. This section is the Docker path in full.

### Step 0 — Prerequisites

```bash
docker --version           # any recent Docker Engine / Desktop
docker compose version     # must be v2 — "docker compose", not "docker-compose"
git --version
```

If ports 3001, 8002, 8083 or 5434 are already taken, see [Changing the ports](#changing-the-ports).

### Step 1 — Clone

The repo is public, so no token is needed. Skip this if you already have a checkout.

```bash
git clone https://github.com/Leapswitch-Networks/partner-marketplace.git
cd partner-marketplace
```

### Step 2 — Create the three environment files

**None of these are in git** — they are gitignored, and there is no `.env.example` to copy. You have
to create them. Three files, and each is read by a different thing:

| File | Read by | Why it must exist separately |
|------|---------|------------------------------|
| `.env` (root) | `docker-compose.yml` | Supplies `POSTGRES_*` and `ADMINER_PORT` to Compose |
| `backend/.env` | `app/core/config.py` (pydantic-settings) | `env_file=".env"` resolves relative to the working directory, which is `backend/` |
| `frontend/.env.local` | the Next.js dev server | `lib/utils/constants.ts` falls back to port **8000**, but the API is on **8002** |

**Generate a real secret first** — never reuse one from another environment:

```bash
openssl rand -hex 48
```

Hex, so the value has no `/`, `+` or `=` for a dotenv parser to trip over. If you have a Python 3
on your host, `python3 -c "import secrets; print(secrets.token_urlsafe(48))"` is equivalent.

Then create the root `.env`. Replace every `<…>` placeholder with your own values:

```bash
cat > .env <<'EOF'
# --- read by backend/app/core/config.py ---
DATABASE_URL=postgresql://<user>:<url-encoded-password>@localhost:5434/test_platformDB
SECRET_KEY=<paste-the-generated-secret>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=7

# --- read by docker-compose.yml ---
POSTGRES_DB=test_platformDB
POSTGRES_USER=<user>
POSTGRES_PASSWORD=<password>
POSTGRES_PORT=5434
ADMINER_PORT=8083
EOF
```

`backend/.env` needs the same keys, so copy it and then add the two local-only lockout overrides:

```bash
cp .env backend/.env

cat >> backend/.env <<'EOF'

# Local-only: a 15-minute lockout costs you 15 minutes to protect an empty
# database. Raised, not disabled, so the code path is still exercised.
MAX_FAILED_LOGIN_ATTEMPTS=50
ACCOUNT_LOCKOUT_MINUTES=1
EOF
```

Finally the frontend file — one line:

```bash
echo 'NEXT_PUBLIC_API_URL=http://localhost:8002' > frontend/.env.local
```

> ⚠️ **If your `POSTGRES_PASSWORD` contains `@`, `#`, `/` or `:`**, the copy inside `DATABASE_URL`
> must be **percent-encoded** (`@` → `%40`, `#` → `%23`). The two values are then not byte-identical
> and must be kept in sync by hand. This is exactly why the backend container rewrites only the
> host:port of the URL rather than rebuilding it — see ONBOARDING § 3.2 and § 4.2.

> Keep `DATABASE_URL` on the plain `postgresql://` scheme. It resolves to the **synchronous**
> `psycopg2` driver, which is what the entire backend is written against. `postgresql+asyncpg://`
> will not work — `asyncpg` is not installed.

### Step 3 — Build and start all four services

```bash
docker compose up -d --build
```

`--build` is only needed the first time, or after a dependency change. Afterwards `docker compose up
-d` is enough.

This starts four containers. `backend` waits for the database's healthcheck before it starts, and
`frontend` waits for `backend`:

| Compose service | Container name | Host port | What it runs |
|-----------------|----------------|-----------|--------------|
| `db` | `postgresql` | 5434 → 5432 | PostgreSQL 16-alpine |
| `adminer` | `adminer` | 8083 → 8080 | Web database browser |
| `backend` | `pmp-backend` | 8002 → 8002 | FastAPI, `uvicorn --reload` |
| `frontend` | `pmp-frontend` | 3001 → 3001 | Next.js dev server, Fast Refresh |

### Step 4 — Run the migrations and seeders

**None of this is automatic.** The stack starts with an empty database and you cannot sign in until
these have run.

Use `docker compose run --rm`, **not** `exec` — `exec` skips the entrypoint that rewrites
`DATABASE_URL` to point at the `db` service, so it fails with `connection refused`:

```bash
# 1. Create every table. Required.
docker compose run --rm backend alembic upgrade head

# 2. Permissions, permission groups, system roles, and the root account. Required.
#    ROOT_PASSWORD is optional — omit it and the seeder generates a password and
#    prints it ONCE. There is no committed default credential.
docker compose run --rm -e ROOT_PASSWORD='choose-a-strong-one' backend python -m app.db.seed_rbac

# 3. Partner tier reference data. Strongly recommended.
#    Without it `partner_tiers` is empty — onboarding a partner still works,
#    because tier_id is nullable, but every partner lands with no entitlement.
docker compose run --rm backend python -m app.db.seed_partner_tiers
```

All three are **idempotent** — safe to re-run. `seed_rbac` reconciles permissions and system roles
against `app/core/permissions.py` on every run, never touches administrator-created roles, and
creates the root account **only when no user exists at all**. Root's address defaults to
`root@leapswitch.com`; override it with `-e ROOT_EMAIL=…`.

Optionally, seed a whole team instead of just the one bootstrap account:

```bash
cp backend/seed_users.example.json backend/seed_users.json    # then edit it
docker compose run --rm backend python -m app.db.seed_users
```

`seed_users.json` is gitignored on purpose — it holds real addresses, and **this repository is
public**.

### Step 5 — Verify it came up

```bash
docker compose ps                          # db "healthy", the other three "Up"
docker compose logs -f backend frontend    # follow both dev servers; Ctrl-C to stop following
```

Then the smoke tests:

```bash
curl -s localhost:8002/health                                              # {"status":"ok"}
curl -s -o /dev/null -w '%{http_code}\n' localhost:8002/api/v1/auth/me     # 401 without a cookie
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' localhost:3001/   # 307 → …/sign-in
docker compose run --rm backend alembic current                            # should print "(head)"
```

Open **http://localhost:3001** and sign in with the root account from Step 4.

| Service | URL |
|---------|-----|
| **Frontend** | **http://localhost:3001** (`/` redirects to `/sign-in`) |
| API | http://localhost:8002 |
| API docs (Swagger) | http://localhost:8002/docs |
| API docs (ReDoc) | http://localhost:8002/redoc |
| Health | http://localhost:8002/health |
| Adminer | http://localhost:8083 — System `PostgreSQL`, Server **`db`** (not `localhost`) |
| PostgreSQL | localhost:5434 |

Editing files on your host reloads both servers in place — the containers bind-mount your source.
That is the entire reason they exist.

### Day-to-day commands

All from the project root.

| Task | Command |
|------|---------|
| Start everything | `docker compose up -d` |
| Stop everything (keeps data) | `docker compose down` |
| Restart one service | `docker compose restart backend` |
| Status | `docker compose ps` |
| Follow logs | `docker compose logs -f backend frontend` |
| Last 50 log lines | `docker compose logs --tail=50 frontend` |
| Shell into the backend | `docker compose exec backend bash` |
| Shell into the frontend | `docker compose exec frontend sh` |
| psql prompt | `docker compose exec db sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'` |

The `sh -lc` wrapper on the psql line is load-bearing: `$POSTGRES_USER` must be expanded **inside**
the container, where Compose has set it. Left unquoted it expands in your host shell, where it is
almost certainly empty, and psql then fails with `role "<your-username>" does not exist`.

**Database — always `run --rm`, never `exec`:**

| Task | Command |
|------|---------|
| Apply migrations | `docker compose run --rm backend alembic upgrade head` |
| Current revision | `docker compose run --rm backend alembic current` |
| New migration | `docker compose run --rm backend alembic revision --autogenerate -m "<msg>"` |
| Roll back one | `docker compose run --rm backend alembic downgrade -1` |
| Re-seed RBAC | `docker compose run --rm -e ROOT_PASSWORD backend python -m app.db.seed_rbac` |
| Seed partner tiers | `docker compose run --rm backend python -m app.db.seed_partner_tiers` |
| Unlock a locked-out account | `./scripts/unlock-user.sh someone@example.com` |

**Verifying your changes:**

| Task | Command |
|------|---------|
| Typecheck frontend | `docker compose exec frontend npm run typecheck` |
| Lint frontend | `docker compose exec frontend npm run lint` |
| Backend tests + lint | `docker compose run --rm --no-deps backend sh -c "pip install -q pytest ruff && python -m pytest -q && ruff check ."` |
| Production build | ⚠️ **never in the dev container** — see the warning below |

The backend test command installs its own tooling because `pytest` and `ruff` live in
`requirements-dev.txt`, which the image deliberately does not install.

**After a dependency change** — dependencies live in the image, not the bind mount, so a host
`npm install` or `pip install` never reaches the container:

| Task | Command |
|------|---------|
| Rebuild after `requirements.txt` changed | `docker compose up -d --build backend` |
| Rebuild after `package.json` changed | `docker compose up -d --build frontend` |
| Force a clean node_modules | `docker compose down && docker volume rm partnermarketplace_frontend_node_modules && docker compose up -d --build frontend` |

### The background worker

Four things need to happen on a timer: webhook deliveries whose retry backoff has
elapsed, expired session rows, API request-log retention, and — if you choose to
switch it on — audit-log retention.

```bash
docker compose run --rm backend python -m app.worker --list   # what would run, and how often
docker compose run --rm backend python -m app.worker --once   # one pass, then exit
docker compose run --rm backend python -m app.worker          # stay running
```

**It is not a service in `docker-compose.yml`, deliberately.** That file is a
protected file and adding a long-running process to everyone's stack is the
owner's decision, not a side effect of a feature landing. Until then `--once` is
the useful mode: run it by hand, or from cron.

To make it permanent, the compose service is four lines beside `backend`:

```yaml
  worker:
    build: ./backend
    command: python -m app.worker
    env_file: [./backend/.env]
    depends_on: [db]
```

**`activity-log` is disabled by default and stays that way until someone asks for
it by name** (`--job activity-log`). How long the audit trail is kept is a policy
question — legal, contractual, or simply how far back you want to be able to
answer questions — and starting a worker should not quietly begin deleting it.

### Checking every screen in a real browser

`UI_PATTERNS.md` warned from 2026-08-06 that nothing had been verified on screen
since the Viho migration, and blamed a missing Chrome-DevTools-Protocol harness.
This is that harness. It needs Chrome on your host and nothing else — no
Playwright, no Puppeteer, no browser download.

```bash
CHECK_EMAIL=root@example.com CHECK_PASSWORD=... \
  node --experimental-websocket scripts/browser-check.mjs
```

It signs in, visits all 24 signed-in screens, and fails on any that redirects to
the login page, renders no sidebar, produces a console error, makes a failing
request, or comes back with almost no text — **a client-rendered page that throws
during hydration leaves an empty shell, which is exactly what fetching the HTML
cannot see.** Screenshots go to `/tmp/pmp-browser-check` unless you set `SHOTS`.

`--experimental-websocket` is only needed on Node 20; 22 and later have the
WebSocket global as standard.

### Changing the ports

The app ports are deliberately **not** the framework defaults — `:3000` and `:8000` are too often
already taken. Override them without editing any file:

```bash
FRONTEND_PORT=3005 BACKEND_PORT=8005 docker compose up -d
```

⚠️ If you move the frontend off **3000 or 3001**, you must add the new origin to the CORS allowlist
in `backend/app/main.py` — it is hardcoded to those two. Otherwise every API call is blocked.

`POSTGRES_PORT` and `ADMINER_PORT` are changed in the root `.env` instead.

### Stopping and resetting

```bash
docker compose down                  # stop everything. Database survives.
docker compose down && docker compose up -d --build     # rebuild when things are stale
```

To **destroy the database and start over** — this is irreversible:

```bash
docker compose down
sudo rm -rf data/db                  # the Postgres cluster lives here, on the host
docker compose up -d
# then re-run every command in Step 4
```

`docker compose down -v` does **not** clear the database: `data/db` is a bind mount, not a named
volume, so `-v` leaves it untouched and only removes the `node_modules` / `.next` volumes.

### ⚠️ Never run `npm run build` in the frontend container

`.next` is the named volume `frontend_next`, shared with the `next dev` process already running in
that container. A production build **replaces the dev output**, and every `_next/static` request then
404s — reported by the browser as a MIME-type error, because Next answers a 404 with an HTML page:

```text
Refused to apply style from '…/_next/static/css/app/layout.css' because its MIME
type ('text/html') is not a supported stylesheet MIME type
```

The code is fine; the build passing is what breaks it. Recover with:

```bash
docker compose stop frontend
docker compose run --rm --no-deps -T frontend sh -c 'rm -rf /app/.next/* /app/.next/.[!.]*'
docker compose start frontend
```

Use `npm run typecheck` and `npm run lint` to verify frontend changes — neither writes to `.next`.

### Troubleshooting

| Symptom | Cause and fix |
|---------|---------------|
| `connection refused` from a backend command | You used `docker compose exec` for something that talks to the database. `exec` skips the entrypoint that rewrites `DATABASE_URL`. Use `docker compose run --rm backend …` |
| `Bind for 0.0.0.0:3001 failed: port is already allocated` | Find the holder with `ss -ltnp \| grep 3001`, then stop it or use `FRONTEND_PORT=3005 docker compose up -d` |
| `pydantic_core.ValidationError: DATABASE_URL Field required` | `backend/.env` is missing — Step 2 |
| Frontend loads but every API call fails with CORS | Frontend is on a port other than 3000/3001. Add the origin to `allow_origins` in `backend/app/main.py` |
| Can't reach the API from the browser | `NEXT_PUBLIC_API_URL` must be **host-visible** (`http://localhost:8002`), never `http://backend:8002` — the browser resolves it, not the container |
| Branding saves but never appears | The reverse case: `INTERNAL_API_URL` is server-side and must be `http://backend:8002`. Compose sets both correctly; this only bites if you override them |
| Signed in, then immediately bounced to `/sign-in` | Cookies are `samesite=lax` + `secure=False`. Over plain HTTP use `localhost` consistently — never mix `localhost` and `127.0.0.1` |
| 404 on an unversioned path like `GET /api/auth/me`, or `Cannot read properties of undefined (reading 'call')` | A **stale browser bundle**, not a code bug. Clear site data for `localhost:3001` (DevTools → Application → Storage). Recreating the `.next` volume does not help — the stale copy is in the browser |
| Host edits don't reload the container | Check the mount: `docker compose exec backend ls /app` should show your source. `WATCHPACK_POLLING=true` is already set for the frontend |
| A package seems missing after editing `package.json` | `node_modules` is a named volume; rebuild with `docker compose up -d --build frontend` |
| `data/db` permission errors | The cluster is owned by the container's uid — do not `chown` it. Reset it instead (see above) |

The full list is in [`documentation/ONBOARDING.md`](documentation/ONBOARDING.md) § 9.

### Running the apps on your host instead

Supported, but only the database and Adminer come from Docker
(`docker compose up -d db adminer` — naming the services matters, or the app containers will fight
your host servers for the ports). It needs **Python 3.12 exactly**: the pinned dependencies publish
no wheels for 3.13/3.14, which is the main reason these containers exist. Backend commands must run
from `backend/`, because both `.env` discovery and Alembic's `script_location` are relative. See
ONBOARDING § 0 Path B.

---

## Application Structure Today

```
/  →  /sign-in
        └── /dashboard
              ├── /dashboard/all-users      (user management)
              ├── /dashboard/add-user
              ├── /dashboard/roles          (roles & permissions)
              ├── /dashboard/activity       (audit trail)
              └── /settings                 (profile · password · appearance)
```

Authentication uses JWTs in `httpOnly` cookies, with an access/refresh pair and transparent
single-retry refresh on the client. There are two separate account tables — `users` and
`admin_users` — sharing one token format. See
[`documentation/core/AUTHENTICATION.md`](documentation/core/AUTHENTICATION.md).

---

## ⚠️ Before Deploying

This repository is **public**, and the application is **not deployable as-is**. There are hard
blockers, the most significant being that **passwords are currently stored and compared in
plaintext** — deliberately, as a development shortcut inherited with the scaffold.

The full blocker list is in
[`documentation/system-design/DEPLOYMENT.md`](documentation/system-design/DEPLOYMENT.md) § 0, and
every known defect is ranked in
[`documentation/planning/TECH_DEBT.md`](documentation/planning/TECH_DEBT.md).

Do not deploy this to any internet-reachable environment before those are addressed.

---

## Contributing

- Branch is `main`. No commits without the project owner's approval.
- No AI attribution in commit messages.
- Conventional commits: `feat(scope): …`, `fix(scope): …`, `docs(scope): …`
- Update [`documentation/DAILY_CHANGES.md`](documentation/DAILY_CHANGES.md) in the same change as
  the code.
- Read the relevant standards doc before writing code — see the table at the top.

---

## Owner

Ayush Mishra — `ayush.mishra@leapswitch.com`
