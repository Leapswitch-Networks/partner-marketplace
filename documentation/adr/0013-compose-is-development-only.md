# ADR-0013 — Docker Compose is development-only, and the dev container never builds

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-07-31 |
| **Recorded** | 2026-08-18 |
| **Deciders** | project owner |
| **Area** | Infra |

## Context

Containers were added on 2026-07-31 (commit `f59d0bf`) so that a fresh machine needs only Docker —
no Python, no Node. Compose grew from two services to four: `db`, `adminer`, `backend`, `frontend`.

Two collisions between host and container followed, and both produce **misleading** errors:

1. `backend/.env` sets `DATABASE_URL` to `localhost:5434`, correct when uvicorn runs on the host and
   wrong inside a container where Postgres is a sibling service at `db:5432`.
2. The frontend's `.next` directory is a **named Docker volume** shared with the running dev server.

## Decision

**Compose is for development only.** Bind-mounted source, reload servers, and no Nginx. It is not a
production topology and must not be mistaken for one.

Three operational rules follow, all of which override generic advice:

1. **`docker compose run --rm`, never `exec`, for anything touching the database.** `exec` skips
   `backend/docker-entrypoint.dev.sh`, which rewrites **only the host:port** of `DATABASE_URL` and
   leaves the credentials byte-for-byte intact. Skipping it fails with a misleading
   `connection refused`.
2. **Never run `npm run build` in the dev container.** A production build replaces the dev output in
   the shared `.next` volume, after which every `_next/static` request 404s as an HTML page — which
   the browser misreports as a MIME-type fault. The verification gate is `typecheck` and `lint`; CI
   runs the real build on its own checkout.
3. **Nothing is automatic on first start.** Migrations and seeders are separate, explicit,
   idempotent commands. The stack comes up with an empty database and no one can sign in until they
   are run.

## Alternatives rejected

**Rebuild `DATABASE_URL` from `POSTGRES_USER`/`POSTGRES_PASSWORD` in `docker-compose.yml`.** The
obvious fix for rule 1. It **cannot work here**: the password contains `@` and `#`, so the URL
carries it percent-encoded — reassembling yields an unparseable URL, and hardcoding the encoded form
would commit a secret to a public repo. Rewriting the host:port in place avoids both.

**Run migrations automatically on container start.** Convenient, and it makes a destructive operation
implicit. It also races when more than one backend replica starts.

**Add Nginx to mirror production.** More moving parts in a dev loop, for fidelity to a production
topology that does not exist yet.

## Consequences

- **Good:** one command brings up a working stack, and credentials never have to be reassembled.
- **Cost:** two traps that generic Docker advice gets **backwards**, both severe enough to be pinned
  in the root operating contract's verification gate.
- **Cost:** a first-run checklist (migrate, seed RBAC, seed tiers) that cannot be skipped.
- **Follow-on:** production deployment is not described by Compose — see
  `documentation/system-design/DEPLOYMENT.md`.

## Where this is enforced

| Kind | Path | What it does |
|------|------|--------------|
| Code | `backend/docker-entrypoint.dev.sh` | rewrites host:port only; explains why in its header |
| Config | `docker-compose.yml` | four dev services; `frontend_next` and `frontend_node_modules` volumes |
| Contract | root `AGENTS.md` § 4 | both traps, as ⚠️ overrides on the verification gate |
| Doc | `README.md` § Running Locally with Docker | the full first-run sequence |
| Doc | `documentation/ONBOARDING.md` § 3.2, § 4.2 | the host-versus-container gotchas |

**Nothing prevents either mistake** — no guard rejects `npm run build` inside the container, and
`exec` remains available. Both are convention plus a loud warning.
