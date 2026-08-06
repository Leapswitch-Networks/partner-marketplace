# Deployment — Runbook & Readiness

> ⚠️ **Partner Marketplace has never been deployed.** There is no staging environment, no production
> environment, no CI/CD, no process manager, and no reverse proxy. This document is a **gap analysis
> plus the shape of the runbook**, not a set of steps you can follow today.
>
> Do not treat any section below as "how we deploy" until § 1 is resolved and this file is rewritten
> against a real environment.

---

## Table of Contents

0. [Blockers — Fix Before Any Deploy](#0-blockers--fix-before-any-deploy)
1. [Undecided Infrastructure](#1-undecided-infrastructure)
2. [What Exists Today](#2-what-exists-today)
3. [What a Deploy Will Have to Do](#3-what-a-deploy-will-have-to-do)
4. [Environment Variables](#4-environment-variables)
5. [Health Checks](#5-health-checks)
6. [Pre-Deploy Checklist](#6-pre-deploy-checklist)
7. [Local vs Deployed](#7-local-vs-deployed)

---

## 0. Blockers — Fix Before Any Deploy

**Corrected 2026-08-03.** This list had gone badly stale: five of its eight entries were fixed by the
2026-07-31 auth/RBAC rebuild and one more was never true after it, yet all eight still read as live
blockers. A blocker list nobody trusts is worse than no list, because the two entries that *are* real
get lost among the six that aren't.

### Still blocking

| # | Blocker | Where | Required change |
|---|---------|-------|-----------------|
| 1 | **No error logging or monitoring** | — | No exception handler, no structured logging, no alerting. A 500 in production would be invisible. PM-10 |
| 2 | **No automated tests** — *partially addressed 2026-08-06* | — | Nothing verified a deploy didn't break auth. The production build was **silently broken** by a type error until 2026-07-30 (PM-24) precisely because no workflow ran `npm run build`. **Since 2026-08-06** there are 74 tests and a CI workflow running `ruff`, `pytest`, `tsc --noEmit`, `npm run lint` and `npm run build` on every push (PM-39) — so the hand-run instruction below is now a fallback rather than the only line of defence. **Still blocking**, because the suite covers three properties (token types, refresh reuse, password hashing) and **not RBAC enforcement across the 56 routes** — which is what a deploy most needs proven. PM-11 stays open |
| 3 | **No production topology** | — | The Compose services are development-only: bind-mounted source, reload servers, no Nginx, no TLS terminator. See § 1 |

### Configuration that must change per environment — not defects

> **Since 2026-08-06 this table is enforced, not advisory.** Set `APP_ENV=production` and the app
> **refuses to start** until every row below is correct, listing all the problems at once rather than
> one per failed deploy. See `CORE_HARDENING_PLAN.md` PM-37.
>
> That change exists because of this document's own history: § 0 above listed five already-fixed items
> as live blockers for weeks. A written rule about configuration drifts from the configuration; an
> assertion cannot. **`APP_ENV` is the one setting nothing can check for you** — leave it at
> `development` in a deployed environment and every other check below is skipped.
>
> Two are warnings rather than refusals, because both are legitimate production choices:
> `HSTS_ENABLED=false` (the TLS terminator may set the header itself) and `TRUST_PROXY_HEADERS=false`
> (correct with no proxy — and enabling it *without* one is the measured PM-26 bypass, so it must never
> be auto-corrected).

| Setting | Why it matters |
|---|---|
| **`APP_ENV=production`** | Turns on every check in this table. Without it they are all skipped, and this list goes back to being something a human has to remember |
| `COOKIE_SECURE=true` | Honoured on both set and clear, but defaults to `false` so local HTTP works. Without it, session cookies travel in cleartext. Verify with `curl -si … \| grep -i set-cookie` — `Secure` must be present |
| `CORS_ORIGINS` | Defaults to localhost. Set to the real frontend origin |
| `SECRET_KEY` | Must be a fresh strong value per environment, never the development one. **Now enforced**: at least 32 characters, no placeholder substring, and at least 12 distinct characters (so a repeated word cannot clear the length floor). Generate with `python -c "import secrets; print(secrets.token_urlsafe(48))"`. Note that **this project's current development key is refused** — it contains a placeholder string |
| `ROOT_PASSWORD` | Only read at seed time. Omit it and the seeder generates and prints one once |
| `MAIL_BACKEND=smtp` | **Must not stay `console` in a deployed environment.** `console` writes password-reset links to the log, and a reset link is a working credential to anyone who can read logs. Set `SMTP_HOST`/`SMTP_USERNAME`/`SMTP_PASSWORD` with it |
| `TRUST_PROXY_HEADERS=true` | Only in the same change that puts a reverse proxy in front. Enabling it without one lets any caller spoof `X-Forwarded-For` and bypass rate limiting entirely (PM-26) |
| `LOG_FORMAT=json` | `console` is for humans; `json` is one object per line for an aggregator — grep does not survive multi-line tracebacks |

### Closed since this list was written

| Was | Now |
|---|---|
| ~~Passwords stored in plaintext~~ | bcrypt at 12 rounds; migration `e7b41c9a2d10` hashed every existing row in place. PM-1 |
| ~~`secure=False` on both auth cookies~~ | Driven by `COOKIE_SECURE`, on set **and** clear. PM-2 |
| ~~CORS origins hardcoded to localhost~~ | `settings.allowed_origins`. PM-9 |
| ~~No login rate limiting and no account lockout~~ | **Half closed.** Per-account lockout works — five failures, fifteen minutes, `429`. Per-IP HTTP rate limiting still does not exist: PM-26, and it remains required before public exposure |
| ~~Any admin can create a `super_admin`~~ | Elevated roles refused unless the actor holds one, on both the user and invitation paths. PM-3 |
| ~~Seed credentials in a public repo~~ | `seed_admin.py` no longer exists. `seed_rbac.py` takes `ROOT_PASSWORD` from the environment and generates a random one if unset — **there is no committed credential**. PM-4 |

**Recommendation:** the three still-blocking items plus **PM-26** are non-negotiable before real
partners use it. The configuration table is non-negotiable for any internet-reachable environment.

> **Maintaining this section:** when a blocker closes, move it into *Closed since this list was
> written* in the same change. Do not delete the row — the drift above happened because closing a
> blocker and updating this list were separate acts, and the second one never happened.

---

## 1. Undecided Infrastructure

None of this has been chosen. Decide before writing the real runbook.

| Question | Options | Notes |
|----------|---------|-------|
| **Where does it run?** | CloudJiffy (LeapDesk's host), a VPS, a container platform | LeapDesk uses CloudJiffy with manual SSH pulls — precedent exists in-house |
| **How does the backend run?** | systemd + uvicorn, gunicorn + uvicorn workers, Docker | `uvicorn --reload` is dev-only; `--reload` must be off in production |
| **How does the frontend run?** | `next start` (Node server), static export, a platform runtime | App Router + middleware means **static export is not viable** — middleware needs a server |
| **Reverse proxy?** | Nginx, Caddy, platform-managed | Needed for TLS, and to serve both tiers on one origin |
| **Same origin or split?** | `example.com` + `example.com/api`, or separate hosts | **Same origin is strongly preferred** — it sidesteps CORS entirely and makes `samesite` cookies straightforward |
| **TLS termination?** | Proxy, platform, Cloudflare | Required for `secure=True` cookies |
| **Database?** | Managed Postgres, or `postgres:16-alpine` on a host | `data/db` bind-mount is a local convenience, not a production pattern |
| **Migrations on deploy?** | Manual step, or automated pre-start | Currently manual, and nothing runs them automatically |
| **CI/CD?** | GitHub Actions, manual | Repo is on GitHub; Actions is the obvious default |

### Why same-origin matters

If the frontend and API share an origin, blockers 3 disappears and cookie handling gets simpler. If
they don't, you need: configurable CORS with `allow_credentials`, `samesite=none` + `secure=true` on
cookies (which requires HTTPS), and careful handling of the path-scoped refresh cookie. **Pick
same-origin unless there's a reason not to.**

---

## 2. What Exists Today

### `docker-compose.yml` — local only

Four services. **None of them is a production artifact** — read the next paragraph before reusing any
of this for a deployment.

| Service | Image | Purpose |
|---------|-------|---------|
| `db` | `postgres:16-alpine` | Local database, bind-mounted to `./data/db` |
| `adminer` | `adminer` | Local DB browser |
| `backend` | built from `backend/Dockerfile.dev` | FastAPI dev server, `--reload`, source bind-mounted |
| `frontend` | built from `frontend/Dockerfile.dev` | Next.js dev server, Fast Refresh, source bind-mounted |

⚠️ **The two app images are development-only and must not be deployed.** Added 2026-07-31 to make
local setup reproducible — the pinned Python dependencies have no wheels past 3.12, so a host with a
newer Python cannot install them. They deliberately do the opposite of what a production image should:
they bind-mount source instead of copying it, run reload-enabled dev servers instead of a process
manager with workers, install dev dependencies, and publish plain HTTP on `localhost`. The `.dev`
suffix is there to keep that distinction unambiguous.

There is still **no** production Dockerfile for either tier, and no Nginx config, anywhere in the
repo. The inherited root `README.md` described a `docker/` folder with `frontend.Dockerfile`,
`backend.Dockerfile`, and `nginx.conf` — **none of those files exist.** Writing genuine production
images is open work; § 0's blocker list applies first.

### Build commands that do exist

| Tier | Command | Output |
|------|---------|--------|
| Frontend | `npm run build` (from `frontend/`) | `.next/` production build — ✅ verified working 2026-07-30 |
| Frontend | `npm start` | Serves the build (needs Node) |
| Backend | none | Python needs no build; it needs a process manager |
| Migrations | `alembic upgrade head` (from `backend/`) | Applies schema |

### Production-relevant settings already in place

| Setting | Where | Effect |
|---------|-------|--------|
| `compress: true` | `next.config.mjs` | gzip |
| `poweredByHeader: false` | `next.config.mjs` | Drops `X-Powered-By` |
| `/api/*` → `no-store` | `next.config.mjs` | API responses uncached |
| Static assets → `max-age=31536000, immutable` | `next.config.mjs` | Long-lived asset caching |
| `GZipMiddleware(minimum_size=1000)` | `backend/app/main.py` | gzip on API responses |
| Connection pooling with `pool_pre_ping` | `backend/app/db/session.py` | Survives dropped connections |
| `SECRET_KEY` has no default | `backend/app/core/config.py` | App refuses to start unconfigured |

---

## 3. What a Deploy Will Have to Do

The shape, once § 1 is decided. **Order matters** — migrate before the new code serves traffic only
if the change is backward-compatible; otherwise take a maintenance window.

```bash
# 1. Fetch code
git pull origin main

# 2. Backend dependencies
cd backend
source .venv/bin/activate
pip install -r requirements.txt

# 3. Migrations — review first
alembic current
alembic upgrade head --sql        # inspect
alembic upgrade head

# 4. Frontend build
cd ../frontend
npm ci                            # ci, not install — respects the lockfile
npm run build

# 5. Restart processes (whatever § 1 chooses)
#    e.g. systemctl restart partner-marketplace-api
#         systemctl restart partner-marketplace-web

# 6. Verify
curl -sf https://<host>/health
```

### Rules for the eventual runbook

1. **`npm ci`, never `npm install`,** in any automated context — `install` can drift from the lockfile.
2. **Never run `uvicorn --reload` in production.** Use a process manager with restart-on-failure.
3. **Never commit or overwrite the deployed `.env`.** It is environment-specific and gitignored.
4. **Review migration SQL before applying** — `alembic upgrade head --sql`.
5. **Have a rollback path** for both code and schema before you deploy. A migration without a working
   `downgrade()` is not deployable.
6. **`seed_rbac.py` is safe to re-run on every deploy** — it is idempotent and reconciles the
   permission catalog. It creates the root account only when no user exists at all. Supply
   `ROOT_PASSWORD` explicitly on a first deploy rather than letting it generate one, so the value
   never appears in deploy logs.

---

## 4. Environment Variables

### Backend — `backend/.env`

| Variable | Required | Local | Deployed |
|----------|:--------:|-------|----------|
| `DATABASE_URL` | ✅ | `postgresql://…@localhost:5434/test_platformDB` | Managed DB connection string |
| `SECRET_KEY` | ✅ | any dev value | **Unique per environment**, ≥32 random bytes, never shared with local |
| `ALGORITHM` | | `HS256` | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | | `60` | Consider shorter |
| `REFRESH_TOKEN_EXPIRE_DAYS` | | `7` | Consider shorter |

⚠️ `env_file=".env"` resolves relative to the **working directory** — the process must start from
`backend/`, or the variables must be supplied by the environment instead of a file. A systemd unit
should set `WorkingDirectory=/path/to/backend`.

### Frontend — `frontend/.env.local`

| Variable | Required | Notes |
|----------|:--------:|-------|
| `NEXT_PUBLIC_API_URL` | | Falls back to `http://localhost:8000`. **`NEXT_PUBLIC_*` is inlined into the client bundle at build time** — it is public, and changing it requires a rebuild, not a restart. |

### Docker Compose — root `.env`

`POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_PORT`, `ADMINER_PORT`.
**Adminer must not be exposed in any deployed environment.**

### Rotating `SECRET_KEY`

Rotating it invalidates every issued token — all users are logged out immediately. There is no
key-rotation or multi-key verification support. Plan for the logout.

---

## 5. Health Checks

### What exists

```bash
curl -s http://localhost:8002/health     # → {"status":"ok"}  (local; see ../ONBOARDING.md § 0)
```

⚠️ **This endpoint is shallow.** It returns `ok` without touching the database, so it stays green
while Postgres is down. For a real load-balancer check, add a variant that runs `SELECT 1`.

### Post-deploy verification

```bash
# API alive
curl -sf https://<host>/health

# OpenAPI served (consider disabling docs in production)
curl -s -o /dev/null -w "%{http_code}\n" https://<host>/docs

# Unauthenticated access is refused
curl -s -o /dev/null -w "%{http_code}\n" https://<host>/api/auth/whoami   # expect 401

# Frontend renders
curl -s -o /dev/null -w "%{http_code}\n" https://<host>/sign-in           # expect 200

# Root redirects
curl -s -o /dev/null -w "%{http_code}\n" https://<host>/                  # expect 307

# Cookies are Secure + HttpOnly
curl -si -X POST https://<host>/api/auth/admin/login \
  -H 'Content-Type: application/json' -d '{"email":"…","password":"…"}' | grep -i set-cookie
```

That last check is the one that catches blocker 2 — if `Secure` is absent from `Set-Cookie`, stop.

**Consider disabling `/docs` and `/redoc` in production** (`FastAPI(docs_url=None, redoc_url=None)`) —
they currently publish the full API surface to anyone.

---

## 6. Pre-Deploy Checklist

### One-time, before the first deploy ever

- [ ] § 0 blockers 1, 2, 3, 6 resolved
- [ ] § 1 infrastructure decisions made and written down
- [ ] Process manager configured for both tiers (no `--reload`)
- [ ] TLS terminating, HTTP → HTTPS redirect in place
- [ ] `secure=True` on cookies, verified in `Set-Cookie`
- [ ] CORS origins environment-configurable
- [ ] Production `SECRET_KEY` generated, unique, stored in a secret manager
- [ ] Database backups scheduled and a restore tested
- [ ] Error logging and alerting wired up
- [ ] `/docs` and `/redoc` decision made
- [ ] Adminer not exposed
- [ ] Seed admin absent from the environment
- [ ] This file rewritten as a real runbook

### Every deploy thereafter

- [ ] `git status` clean; deploying a known commit
- [ ] Migrations reviewed with `--sql`
- [ ] Every migration has a working `downgrade()`
- [ ] Rollback plan for code **and** schema
- [ ] `npm ci` (not `install`)
- [ ] Health checks pass (§ 5)
- [ ] Login flow manually verified end to end
- [ ] `../DAILY_CHANGES.md` updated

---

## 7. Local vs Deployed

| Concern | Local (today) | Deployed (required) |
|---------|---------------|---------------------|
| Frontend | `next dev`, Fast Refresh, :3001 — in a dev container or on the host | `npm run build` + `next start` behind a proxy |
| Backend | `uvicorn --reload`, :8002 — in a dev container or on the host | Process manager, no reload, multiple workers |
| App images | `*/Dockerfile.dev`, bind-mounted source, dev servers | Purpose-built images that COPY source — **do not ship the `.dev` ones** |
| Database | `postgres:16-alpine`, bind-mounted `./data/db`, :5434 | Managed Postgres with backups |
| DB admin | Adminer on :8083 | **Not exposed** |
| Reverse proxy | none | Required (TLS, single origin) |
| TLS | none | Required |
| Cookie `secure` | `False` | **`True`** |
| CORS | hardcoded localhost | Environment-configured |
| Passwords | plaintext (accepted debt) | **Hashed — blocker** |
| Migrations | manual, by hand | Explicit, reviewed deploy step |
| Secrets | `.env` files on disk | Secret manager / platform env vars |
| Logging | uvicorn stdout | Structured, aggregated, alerting |
| `/docs` | open | Decide — probably closed |
| Seed admin | present | absent |

---

## Related Documentation

- [`../ONBOARDING.md`](../ONBOARDING.md) — local setup, and why the root README is wrong
- [`DATABASE_MIGRATIONS.md`](./DATABASE_MIGRATIONS.md) — migration workflow and recovery
- [`../core/AUTHENTICATION.md`](../core/AUTHENTICATION.md) — cookie flags and the plaintext debt
- [`../core/AUTHORIZATION.md`](../core/AUTHORIZATION.md) — the escalation path in blocker 5
- [`../planning/TECH_DEBT.md`](../planning/TECH_DEBT.md) — the full ranked list
