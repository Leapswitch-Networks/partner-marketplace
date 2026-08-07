# Partner Marketplace Core — System Architecture

> Describes the application as it exists **today**, on the inherited scaffold.
> The marketplace domain has not been built yet — see `../planning/MARKETPLACE_DOMAIN_PLAN.md`.
> Do not read the inherited `../architecture.md`; it describes the previous product.

---

## Overview

Partner Marketplace is a two-tier web application: a **Next.js 14 App Router** frontend and a
**FastAPI** backend, talking over JSON with `httpOnly` cookie authentication, backed by
**PostgreSQL 16**.

The two tiers are deployed and run independently — there is no server-side rendering *of* backend
data and no shared runtime. The frontend is a browser client that happens to be server-rendered by
Next.js; all data comes from the API over HTTP.

---

## Technology Stack

### Backend

| Concern | Choice | Version |
|---------|--------|---------|
| Framework | FastAPI | 0.115.5 |
| Server | Uvicorn (standard extras) | 0.32.1 |
| ORM | SQLAlchemy (2.0 declarative style) | 2.0.36 |
| Migrations | Alembic | 1.14.0 |
| Driver | psycopg2-binary — **synchronous** | 2.9.10 |
| Validation | Pydantic v2 (`[email]` extras) | 2.10.3 |
| Settings | pydantic-settings | 2.6.1 |
| JWT | python-jose[cryptography] | 3.3.0 |
| Hashing | bcrypt — used **directly**, not via passlib | 4.3.0 |
| HTTP client | httpx — Google OAuth token exchange | 0.28.1 |
| Uploads | python-multipart | 0.0.17 |

### Frontend

| Concern | Choice | Version |
|---------|--------|---------|
| Framework | Next.js — App Router | 14.2.35 |
| UI library | React | 19.2.4 |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | 3.4.19 |
| State | Redux Toolkit + react-redux | 2.11.2 / 9.2.0 |
| Forms | React Hook Form + `@hookform/resolvers` | 7.72.1 / 5.2.2 |
| Schema validation | Zod | 4.3.6 |
| HTTP | Axios | 1.15.0 |

### Infrastructure

| Concern | Choice |
|---------|--------|
| Database | `postgres:16-alpine` (Docker), host port 5434 |
| DB admin | Adminer (Docker), host port 8083 |
| Reverse proxy | none |
| Queue / scheduler | none |
| Container for app tiers | **development containers** for backend and frontend (bind-mounted source, reload servers). No production topology yet |

---

## Architecture Patterns

### 1. Layered backend (router → service → model)

Three layers with a strict dependency direction. Nothing lower reaches upward.

```
app/api/*.py         HTTP concerns only — routing, status codes, cookies, response models
      │
      ▼
app/services/*.py    Business logic — validation rules, permission checks, orchestration
      │
      ▼
app/models/*.py      SQLAlchemy 2.0 declarative models — persistence only
```

`app/schemas/*.py` (Pydantic v2) sits alongside as the wire contract, used by both the router
(request parsing, `response_model`) and the service (typed input).

**Rule:** a router function should read as a handful of lines that delegate. Business rules living
in a router is a defect — see `../system-design/FASTAPI_STANDARDS.md`.

### 2. Dependency injection for cross-cutting concerns

`app/core/dependencies.py` is the single place where request-scoped concerns are resolved:

| Dependency | Returns | Raises |
|------------|---------|--------|
| `get_db()` | `Session`, closed in a `finally` | — |
| `get_current_user()` | `User` — valid token, row exists, **status ACTIVE** | 401 / 403 |
| `require_permission(p)` | …plus holds `p` (super admins bypass) | 403 |
| `require_any_permission(*p)` | …plus holds at least one | 403 |
| `require_roles(*names)` | …plus holds one of the roles | 403 |
| `require_super_admin()` | …plus is RootUser/SuperAdmin | 403 |
| `require_admin_access()` | …plus sees all data | 403 |
| `get_client_ip()` | client IP, `X-Forwarded-For` aware | — |

Every guard is wired to real routes (they were dead before — PM-7), and **status is re-read from the
database on every request**, so suspending an account ends live sessions immediately.

### 3. One account table, roles decide everything

**Rebuilt 2026-07-31.** `users` and `admin_users` were merged (migration `e7b41c9a2d10`). There is one
table, one login endpoint, and one guard chain; capability comes from roles.

```
users ──user_roles──> roles ──role_permissions──> permissions ──> permission_groups
```

| Concept | Where |
|---------|-------|
| May they sign in? | `users.status` — `INACTIVE` \| `ACTIVE` \| `SUSPENDED` |
| Staff or partner? | `users.account_type` — drives **signup policy** only, never authorization |
| What may they do? | roles → permissions, checked by `require_permission(...)` |

`whoami` is gone; `GET /api/v1/auth/me` returns identity plus resolved roles and permissions. Do **not**
add a second identity table for partners — add a role. See [`AUTHORIZATION.md`](./AUTHORIZATION.md).

### 4. Frontend: server shell, client data

Pages under `app/` are React Server Components by default, but every data-bearing view delegates to
a client component (e.g. `app/dashboard/page.tsx` → `DashboardClient.tsx`). Data is fetched
client-side through Axios so the `httpOnly` cookie rides along from the browser.

Redux Toolkit holds cross-page state (`authSlice` is the only slice); component-local state stays in
`useState`.

---

## Folder Structure

```
Partner Market Place/
├── backend/
│   ├── alembic.ini                 # script_location = app/db/migrations (relative!)
│   ├── requirements.txt
│   ├── .env                        # read by pydantic-settings (CWD-relative)
│   └── app/
│       ├── main.py                 # FastAPI app, middleware, router mounting, /health
│       ├── api/                    # routers — auth, admin, candidate, category
│       ├── core/
│       │   ├── config.py           # Settings (pydantic-settings)
│       │   ├── security.py         # JWT create/decode + password helpers
│       │   └── dependencies.py     # get_db, auth guards, client IP
│       ├── db/
│       │   ├── base.py             # DeclarativeBase
│       │   ├── session.py          # engine + SessionLocal (pooled)
│       │   ├── seed_rbac.py        # RBAC catalog + bootstrap root account
│       │   └── migrations/         # Alembic env.py + versions/
│       ├── models/                 # SQLAlchemy models
│       ├── schemas/                # Pydantic v2 request/response models
│       └── services/               # business logic
├── frontend/
│   ├── middleware.ts               # route protection + / → /sign-in
│   ├── next.config.mjs             # headers, compression, optimizePackageImports
│   ├── tailwind.config.ts          # brand palette, keyframes, darkMode: "class"
│   └── app/                        # App Router
│       ├── layout.tsx              # root layout + Providers
│       ├── (auth)/                 # route group: sign-in, sign-up
│       └── dashboard/              # dashboard + admin sections
│   ├── components/                 # admin/, auth/, common/, dashboard/
│   ├── lib/
│   │   ├── api/                    # axiosInstance + one module per resource
│   │   ├── store/                  # Redux store + slices
│   │   ├── hooks/                  # typed dispatch/selector, useTheme
│   │   └── utils/                  # constants, user helpers
│   └── types/                      # shared TypeScript types
├── documentation/                  # this folder — see INDEX.md
├── docker-compose.yml              # db + adminer + backend/frontend dev containers
├── data/db/                        # live Postgres cluster (gitignored)
└── .env                            # read by docker-compose
```

---

## Request Lifecycle

### Authenticated API request

```
Browser
  │  fetch via axiosInstance (withCredentials: true, timeout 5000ms)
  ▼
FastAPI middleware
  │  GZipMiddleware (responses ≥1000 bytes)
  │  CORSMiddleware (allowlist: localhost:3000, localhost:3001; credentials allowed)
  ▼
Router  /api/<prefix>/<path>
  │  Depends(get_current_user) or Depends(get_current_admin)
  │    → reads access_token cookie → decode_token() → assert payload.type == "access"
  │    → db.get(User | AdminUser, sub)   → 401 if missing/inactive
  ▼
Service  app/services/*.py
  │  business rules, permission checks, HTTPException on violation
  ▼
Model / Session
  │  SQLAlchemy Session from SessionLocal (pool_size 10, max_overflow 20, pre-ping)
  ▼
Response  serialised through the router's response_model
```

### 401 recovery (frontend)

`lib/api/axiosInstance.ts` retries once, transparently:

```
Any request → 401
  │  (skipped entirely for /api/v1/auth/refresh and /api/v1/auth/logout)
  ▼
POST /api/v1/auth/refresh  (3s timeout)
  ├─ success → replay the original request once (_retry guard prevents loops)
  └─ failure → reject with the ORIGINAL error, so the caller sees the real status/detail
```

### Route protection (frontend, edge)

`frontend/middleware.ts` runs before the page renders:

| Path | Behaviour |
|------|-----------|
| `/` | Always redirect to `/sign-in` |
| `/dashboard*`, `/admin*`, `/test*`, `/result*` | Require an `access_token` cookie, else redirect to `/sign-in` |
| everything else | Pass through |

This is a **presence check only** — the middleware does not verify the JWT signature or expiry.
Real enforcement is the backend's dependency guards. Treat the middleware as UX, not security.

---

## API Surface

All routers are mounted under `/api`.

44 routes. Every protected route names its permission — see
[`AUTHORIZATION.md`](./AUTHORIZATION.md) § Route Authorization Matrix for the full table.

| Group | Routes | Gating |
|-------|--------|--------|
| `/health`, `/health/ready` | 2 | none — shallow liveness and a deep DB probe |
| `/api/v1/auth/*` | 11 | mostly unauthenticated (register, login, reset) or access-cookie |
| `/api/v1/auth/google/*` | 3 | unauthenticated; signed `state` guards the handshake |
| `/api/v1/users/*` | 10 | `user-view` / `-create` / `-update` / `-delete` / `-approve` |
| `/api/v1/roles/*` | 5 | `role-view` / `-create` / `-update` / `-delete` |
| `/api/v1/permissions` | 1 | `permission-view` — read-only catalog |
| `/api/v1/invitations/*` | 6 | `invitation-*`; `/preview` is deliberately unauthenticated |
| `/api/categories/*`, `/api/candidates/*` | 10 | `category-*` / `candidate-*` — inherited domain |

`whoami`, `admin/login`, `admin/me`, `admin/register` and `/api/admin/users` are **gone** — one account
table means one set of endpoints.

`candidates` and `categories` are **inherited domain** from the previous product. They stay until
the marketplace domain replaces them — see `../planning/SCAFFOLD_CLEANUP_PLAN.md`.

---

## Data Layer

### Current tables

| Table | Model file | Status |
|-------|-----------|--------|
| `users` | `models/user.py` | **Core** — the single account table |
| `roles` | `models/role.py` | **Core** — RBAC |
| `permissions` | `models/permission.py` | **Core** — reference data, seeded from code |
| `permission_groups` | `models/permission_group.py` | **Core** — display grouping |
| `user_roles`, `role_permissions` | `models/associations.py` | **Core** — RBAC pivots |
| `user_invitations` | `models/user_invitation.py` | **Core** — tokenised onboarding |
| ~~`admin_users`~~ | — | **Dropped 2026-07-31**, folded into `users` |
| `categories` | `models/category.py` | Inherited, probably reusable |
| `candidates` | `models/candidate.py` | Inherited — test-platform domain |
| `tests` | `models/test.py` | Inherited — test-platform domain |
| `questions` | `models/question.py` | Inherited — test-platform domain |
| `options` | `models/option.py` | Inherited — test-platform domain |
| `test_sessions` | `models/test_session.py` | Inherited — test-platform domain |
| `session_answers` | `models/session_answer.py` | Inherited — test-platform domain |

### Session management

`app/db/session.py` builds one module-level engine with a connection pool:

| Setting | Value | Why |
|---------|-------|-----|
| `pool_pre_ping` | `True` | Drops dead connections instead of erroring mid-request |
| `pool_size` | 10 | Steady-state connections |
| `max_overflow` | 20 | Burst headroom (30 max) |
| `pool_timeout` | 30s | Wait before giving up on a pool slot |
| `pool_recycle` | 1800s | Recycle before Postgres/proxy idle timeouts bite |

Sessions are per-request via `get_db()`, always closed in a `finally`. `autocommit=False`,
`autoflush=False` — services commit explicitly.

Every model must be imported in **both** `app/models/__init__.py` and
`app/db/migrations/env.py`. The first makes string-based relationships (`Mapped[list["Role"]]`)
resolvable no matter which module is imported first — omitting it produces
`InvalidRequestError: expression 'Role' failed to locate a name`. The second is what Alembic
autogenerate sees.

---

## Security Architecture

### What is in place

- JWTs are signed (HS256) and carry `sub`, `exp`, and a `type` claim (`access` \| `refresh`)
- `type` is asserted on every decode, so a refresh token can't be used as an access token
- Tokens live in `httponly` cookies — not readable by JavaScript, so XSS can't exfiltrate them
- `samesite=lax` gives baseline CSRF protection for cross-site POSTs
- The refresh cookie is path-scoped to `/api/v1/auth/refresh`, so it isn't sent on ordinary requests
- CORS is an explicit allowlist with credentials, not `*`
- Inactive admins are rejected at the dependency layer, not just at login
- Email uniqueness is enforced on the single `users` table (DB constraint + a service-level pre-check
  that returns a clean 409 instead of an integrity error)

### What is missing — read before trusting this

Fixed on 2026-07-31: password hashing (bcrypt 12 rounds), account lockout, login auditing,
configurable CORS and cookie flags, super-admin-only role granting, password change + reset, one
password policy, email normalisation, and a deep readiness probe. See `../planning/TECH_DEBT.md`.

Still open:

| Gap | Detail |
|-----|--------|
| `COOKIE_SECURE` defaults to `False` | A **deployment requirement, not a code defect** — PM-2 is closed. The flag is honoured on both set and clear; it must be set `True` in any HTTPS environment |
| No CSRF token | `samesite=lax` alone; no double-submit or synchroniser token |
| ~~No HTTP rate limiting~~ | **Done 2026-08-03** — per-IP, three tiers, in `core/rate_limit.py`. Counters are per process, so N workers multiply every limit by N (PM-26) |
| No monitoring or alerting | Structured logging with request correlation exists as of 2026-08-03; **nothing alerts**, and container stdout is lost on `down` (PM-10) |
| Google SSO unverified | Implemented but never run against real Google credentials (PM-28) |
| No row-level / partner scoping | Users and invitations are admin-or-self; no ownership model (PM-5) |
| Test coverage is partial | **241 tests and CI exist** as of 2026-08-06 (PM-39), but none covers RBAC enforcement across the routes, a login round trip, or migrations — which is what PM-5 needs (PM-11) |
| `SECRET_KEY` has no rotation story | Rotating it logs everyone out |

---

## Frontend Architecture

### Routing

| Route | Kind | Notes |
|-------|------|-------|
| `/` | redirect | Always → `/sign-in` (middleware) |
| `/sign-in`, `/sign-up` | `(auth)` route group | Shared minimal auth layout |
| `/dashboard` | protected | Server page → `DashboardClient` |
| `/dashboard/profile` | protected | Profile form |
| `/dashboard/all-users`, `/dashboard/add-user` | protected | Admin user management |

### State

| Slice | Holds |
|-------|-------|
| `authSlice` | Current identity, `user_type`, auth status |

`usePermissions()` (`lib/hooks/usePermissions.ts`) is how components gate themselves; it reads the
server-resolved `permissions` list, so the super-admin bypass needs no client-side special case.

`Providers.tsx` wraps the tree with the Redux provider; `AuthInitializer.tsx` hydrates identity on
mount by calling `GET /api/v1/auth/me`. `useAppDispatch` / `useAppSelector` are the typed accessors — never use
the untyped hooks directly.

### API layer

One module per resource under `lib/api/`, all sharing `axiosInstance`:

| Module | Covers |
|--------|--------|
| `authApi.ts` | register, login, logout, me, profile, change/reset password, accept invitation, Google URL |
| `adminApi.ts` | user administration — CRUD, approve, toggle, unlock, bulk |
| `rbacApi.ts` | roles, permission catalog, invitations |
| `navigationApi.ts` | the server-driven sidebar |
| `settingsApi.ts` | installation branding — text, theme, logo/favicon |

**Rule:** components never call `axios` or `fetch` directly.

### Performance choices already made

- `next.config.mjs`: `compress: true`, `poweredByHeader: false`, `reactStrictMode: true`
- `optimizePackageImports` for `@/components/{admin,dashboard,common}`
- Cache headers: `/api/*` → `no-store`; hashed static assets → `max-age=31536000, immutable`
- Skeleton components (`Skeleton.tsx`) for loading states
- Backend gzips responses ≥1000 bytes

---

## Key Design Decisions

| Decision | Rationale | Revisit if |
|----------|-----------|-----------|
| ~~Separate `users` and `admin_users` tables~~ → **unified** | One table + roles removed a whole class of dual-identity awkwardness; a third identity for partners would have made it worse | A partner must become an *organisation* with several logins — then add a `partners` table and an FK, keeping accounts in `users` |
| Cookie auth over `Authorization: Bearer` | `httpOnly` defeats XSS token theft; no token juggling in the client | You need cross-domain API clients or mobile apps |
| Synchronous SQLAlchemy | Simpler; the workload is not I/O-bound at this scale | Concurrency becomes the bottleneck — note this is a large migration |
| Redux Toolkit for global state | Already wired; predictable | If only auth is global, React Context would be lighter |
| Dev-only app containers, bind-mounting source | Reproducible toolchain (the pinned deps need Python 3.12, which hosts increasingly don't have) without giving up `--reload` and Fast Refresh | Production deployment — these images are not it, and need a real story first |
| UUID string PKs | No cross-table ID collisions; safe to expose | You need sortable/compact keys (consider UUIDv7) |

---

## Related Documentation

- [`AUTHENTICATION.md`](./AUTHENTICATION.md) — auth flows in depth, and the plaintext-password debt
- [`AUTHORIZATION.md`](./AUTHORIZATION.md) — roles and guard behaviour
- [`USERS.md`](./USERS.md) — account tables and management endpoints
- [`../system-design/FASTAPI_STANDARDS.md`](../system-design/FASTAPI_STANDARDS.md) — backend conventions
- [`../system-design/NEXTJS_STANDARDS.md`](../system-design/NEXTJS_STANDARDS.md) — frontend conventions
- [`../planning/MARKETPLACE_DOMAIN_PLAN.md`](../planning/MARKETPLACE_DOMAIN_PLAN.md) — what replaces the inherited domain

---

## Pending

> **Architecture-level work still outstanding.** Last audited **2026-08-06** against the code, not
> against this document. Verify before starting — the § *What is missing* table above is older than
> this section and contradicts it in places (see *Documentation accuracy* below).

### 🔴 Structural — cheapest now, expensive after the first external consumer

- [ ] **PM-40 — version the API.** All 56 routes are `/api/<resource>`; there is no `v1`. The frontend
      hardcodes **38** `"/api/…"` literals across five `lib/api/` modules. Today this costs nothing —
      one client, one repo, deployed together. It becomes a migration the moment a partner integrates.
      Fix: `API_PREFIX = "/api/v1"` in `core/config.py`, an `API` constant in
      `frontend/lib/utils/constants.ts`, and no compatibility alias (nothing is pinned yet, so keep
      the OpenAPI clean).
- [ ] **PM-5 — row-level / partner scoping.** Still the single largest architectural hole. Users and
      invitations are scoped admin-or-self; there is **no ownership model**. Design it centrally —
      improvising per route is how data leaks across tenants, and a scoping bug does not raise, it
      returns another partner's rows. Do it **after** PM-40 and PM-42, so it is written against a
      versioned API with a generated contract.
- [ ] **PM-41 — the frontend has no data layer.** All 24 server components under `app/` are shells:
      each sets `metadata` and renders one client component, and **not one fetches anything or reads a
      cookie server-side**. Consequences: every screen is a two-round-trip waterfall, nothing is cached
      or deduplicated or cancelled, `loading.tsx` almost never renders, and PM-30's climbing lint count
      is a symptom rather than a lint problem. Fix in three steps — see
      [`../planning/CORE_HARDENING_PLAN.md`](../planning/CORE_HARDENING_PLAN.md) PM-41.
- [ ] **PM-42 — generate the API contract.** `frontend/types/index.ts` is 161 lines hand-mirroring
      `backend/app/schemas/`. FastAPI already publishes an accurate `/openapi.json`. A renamed field
      produces a `tsc`-clean frontend that reads `undefined` at runtime. Depends on PM-40.

### 🟠 Runtime and operations

- [ ] **PM-44 — three pieces of state live in process memory.** Rate-limit counters are an in-process
      dict, nothing is cached, and email sends synchronously in-request. The trigger is the first
      `gunicorn -w 4`: every rate limit silently multiplies by N. One Redis dependency answers all
      three — **but introduce it with the production topology, not before.**
- [ ] **PM-10 (monitoring half) — nothing alerts.** Structured logging with request-id correlation
      exists; there is no error tracker, no aggregation, no deduplication, and container stdout is lost
      on `docker compose down`. Needs a destination before it needs code.
- [ ] **No production topology.** The Compose services are development-only — bind-mounted source,
      reload servers, no reverse proxy, no TLS terminator. Every question is still open in
      [`../system-design/DEPLOYMENT.md`](../system-design/DEPLOYMENT.md) § 1. **Same-origin is strongly
      preferred**: it removes CORS entirely and simplifies cookie flags.
- [ ] **PM-43 — two purge functions exist and nothing calls them.** `session_service.purge_expired`
      and `activity_service.purge_older_than`. `user_sessions` gains one row per sign-in, kept forever.
      A `python -m app.db.maintenance` entry point plus a cron line; session purge can ship with its
      30-day default immediately, audit retention stays a policy decision.
- [ ] **No CSRF token.** `samesite=lax` alone — no double-submit and no synchroniser token. Re-evaluate
      if `COOKIE_SAMESITE` ever has to become `none` for a cross-site deployment, because that is the
      configuration where `lax`'s protection disappears.
- [ ] **`SECRET_KEY` has no rotation story.** Rotating it signs everyone out **and permanently breaks
      2FA for every enrolled user** — the TOTP secrets are Fernet-encrypted with a key derived from it
      (see [`AUTHENTICATION.md`](./AUTHENTICATION.md) § Rotating `SECRET_KEY`). A rotation procedure
      needs to re-encrypt those secrets, not just re-issue tokens.

### 🟡 Decisions that gate other work

- [x] ~~**PM-25 — settle React/Next.**~~ **Settled 2026-08-07: React 18.3.1.** It turned out not to be a
      decision anyone got to make at leisure — React 19 broke Next 14's App Router client runtime and
      sign-in stopped working. It did **not** gate PM-30 after all (those lint errors come from
      `eslint-config-next@16` on a Next 14 codebase, unrelated to the React version), and it no longer
      blocks PM-41's server-component step.
- [ ] **PM-11 — extend the test suite.** 74 tests now cover token types, refresh reuse, password
      hashing and config validation (PM-39). They do **not** cover RBAC enforcement across the 56
      routes, which is the suite PM-5 needs before it can be trusted.
- [ ] **Synchronous SQLAlchemy** is a deliberate choice, recorded in § Key Design Decisions. Revisit
      only when concurrency is measured to be the bottleneck — it is a large migration, not a flag.

### Documentation accuracy — this file is stale in six places
> **✅ The *Documentation accuracy* items below were cleared on 2026-08-06.** The API-path sweep
> (`/api/…` → `/api/v1/…`, 110 references across 13 current-state docs) and every stale section named
> here have been corrected. They are kept, struck through, as the record of what had drifted and why —
> deleting them would lose the more useful lesson, which is that all of it accumulated in under two
> weeks while the code was being actively improved.
>
> Historical documents were deliberately **not** rewritten: `DAILY_CHANGES.md` and `TECH_DEBT.md`'s
> dated entries still say `/api/…` because that is what was true when they were written, and both now
> carry a note saying so. The four inherited test-platform docs were left alone too — `INDEX.md`
> already marks them untrustworthy.

The 2026-08-06 deletion of the inherited test-platform domain invalidated part of this document, and
§ *What is missing* predates the 2026-08-03 work. Fix in one pass:

- [ ] § *What is missing* — **"No email transport"** is wrong: resolved 2026-08-03 (PM-27,
      `mail_service.py`, two backends). **"No automated tests | Verified by a 41-check shell script"**
      is superseded by PM-39. **"No request logging or error monitoring | an unhandled exception is a
      bare 500"** is both wrong and a duplicate of the monitoring row two lines above it.
- [ ] § *Routing* still lists **`/dashboard/candidates`** — the route was deleted 2026-08-06.
- [ ] § *State* still lists **`testSlice`** — deleted, along with its store registration.
- [ ] § *API layer* still lists **`candidateApi.ts`, `categoryApi.ts`, `testApi.ts`** — all deleted.
      It also omits `navigationApi.ts`, which does exist.
- [ ] § *Performance choices* references **`TestCardSkeleton.tsx`** — deleted.
- [ ] § *Security Architecture → What is in place* says email uniqueness is enforced **"on both
      tables"** — there has been one account table since migration `e7b41c9a2d10`.
