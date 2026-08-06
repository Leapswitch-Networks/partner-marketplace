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

## Quick Start

Full instructions, including prerequisites and gotchas, are in
[`documentation/ONBOARDING.md`](documentation/ONBOARDING.md). The short version — everything in
Docker, which needs only Docker and Compose installed:

```bash
# 1. Create .env and backend/.env  (see ONBOARDING § 3 for the keys)
#    plus frontend/.env.local with:  NEXT_PUBLIC_API_URL=http://localhost:8002

# 2. Start all four services
docker compose up -d --build

# 3. Migrate and seed — neither is automatic.
#    Use `run`, not `exec`: see ONBOARDING § 4.3 for why.
#    ROOT_PASSWORD is optional: without it the seeder generates one and prints
#    it once. There is no default credential.
docker compose run --rm backend alembic upgrade head
docker compose run --rm -e ROOT_PASSWORD backend python -m app.db.seed_rbac

# 4. Follow the dev servers
docker compose logs -f backend frontend
```

Edit files on your host and both servers reload — the containers bind-mount the source.

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3001 (`/` redirects to `/sign-in`) |
| API | http://localhost:8002 |
| API docs | http://localhost:8002/docs |
| Health | http://localhost:8002/health |
| Adminer | http://localhost:8083 |
| PostgreSQL | localhost:5434 |

The app ports are **not** the framework defaults: `:3000` and `:8000` are too often already taken.
`:3001` is used because it is already in the backend's CORS allowlist. Override with
`FRONTEND_PORT` / `BACKEND_PORT`.

To run the apps on your host instead, see ONBOARDING § 0 Path B. Note that it needs **Python 3.12
exactly** — the pinned dependencies have no wheels for 3.13/3.14, which is the main reason the
containers exist.

Three things that trip people up: **migrations are not automatic**; one-off backend commands need
`docker compose run`, not `exec` (ONBOARDING § 4.3); and on the host path, backend commands must run
from `backend/` because both `.env` discovery and Alembic's `script_location` are relative.

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
