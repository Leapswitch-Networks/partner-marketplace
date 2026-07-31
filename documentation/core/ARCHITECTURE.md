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
| Container for app tiers | none — both run on the host |

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

`whoami` is gone; `GET /api/auth/me` returns identity plus resolved roles and permissions. Do **not**
add a second identity table for partners — add a role. See [`AUTHORIZATION.md`](./AUTHORIZATION.md).

### 4. Frontend: server shell, client data

Pages under `app/` are React Server Components by default, but every data-bearing view delegates to
a client component (e.g. `app/dashboard/page.tsx` → `DashboardClient.tsx`). Data is fetched
client-side through Axios so the `httpOnly` cookie rides along from the browser.

Redux Toolkit holds cross-page state (`authSlice`, `testSlice`); component-local state stays in
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
│       │   ├── seed_admin.py       # default super-admin seeder
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
  │  (skipped entirely for /api/auth/refresh and /api/auth/logout)
  ▼
POST /api/auth/refresh  (3s timeout)
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
| `/api/auth/*` | 11 | mostly unauthenticated (register, login, reset) or access-cookie |
| `/api/auth/google/*` | 3 | unauthenticated; signed `state` guards the handshake |
| `/api/users/*` | 10 | `user-view` / `-create` / `-update` / `-delete` / `-approve` |
| `/api/roles/*` | 5 | `role-view` / `-create` / `-update` / `-delete` |
| `/api/permissions` | 1 | `permission-view` — read-only catalog |
| `/api/invitations/*` | 6 | `invitation-*`; `/preview` is deliberately unauthenticated |
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
- The refresh cookie is path-scoped to `/api/auth/refresh`, so it isn't sent on ordinary requests
- CORS is an explicit allowlist with credentials, not `*`
- Inactive admins are rejected at the dependency layer, not just at login
- Email uniqueness is enforced on both tables (DB constraint + a service-level pre-check that
  returns a clean 409 instead of an integrity error)

### What is missing — read before trusting this

Fixed on 2026-07-31: password hashing (bcrypt 12 rounds), account lockout, login auditing,
configurable CORS and cookie flags, super-admin-only role granting, password change + reset, one
password policy, email normalisation, and a deep readiness probe. See `../planning/TECH_DEBT.md`.

Still open:

| Gap | Detail |
|-----|--------|
| `COOKIE_SECURE` defaults to `False` | Configurable now, but must be `True` behind HTTPS (PM-2) |
| No CSRF token | `samesite=lax` alone; no double-submit or synchroniser token |
| **No HTTP rate limiting** | Lockout is per-account, so an attacker can still spray many accounts (PM-26) |
| No email transport | Invitations return the accept URL; reset tokens are only readable in the DB (PM-27) |
| Google SSO unverified | Implemented but never run against real Google credentials (PM-28) |
| No row-level / partner scoping | Users and invitations are admin-or-self; no ownership model (PM-5) |
| No automated tests | Verified by a 41-check shell script, not a suite (PM-11) |
| `SECRET_KEY` has no rotation story | Rotating it logs everyone out |
| No request logging or error monitoring | An unhandled exception is a bare 500 (PM-10) |

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
| `/dashboard/candidates` | protected | Inherited domain |

### State

| Slice | Holds |
|-------|-------|
| `authSlice` | Current identity, `user_type`, auth status |
| `testSlice` | Inherited test-taking state — removal candidate |

`usePermissions()` (`lib/hooks/usePermissions.ts`) is how components gate themselves; it reads the
server-resolved `permissions` list, so the super-admin bypass needs no client-side special case.

`Providers.tsx` wraps the tree with the Redux provider; `AuthInitializer.tsx` hydrates identity on
mount by calling `GET /api/auth/me`. `useAppDispatch` / `useAppSelector` are the typed accessors — never use
the untyped hooks directly.

### API layer

One module per resource under `lib/api/`, all sharing `axiosInstance`:

| Module | Covers |
|--------|--------|
| `authApi.ts` | register, login, logout, me, profile, change/reset password, accept invitation, Google URL |
| `adminApi.ts` | user administration — CRUD, approve, toggle, unlock, bulk |
| `rbacApi.ts` | roles, permission catalog, invitations |
| `candidateApi.ts` | candidates (inherited) |
| `categoryApi.ts` | categories |
| `testApi.ts` | tests (inherited) |

**Rule:** components never call `axios` or `fetch` directly.

### Performance choices already made

- `next.config.mjs`: `compress: true`, `poweredByHeader: false`, `reactStrictMode: true`
- `optimizePackageImports` for `@/components/{admin,dashboard,common}`
- Cache headers: `/api/*` → `no-store`; hashed static assets → `max-age=31536000, immutable`
- Skeleton components (`Skeleton.tsx`, `TestCardSkeleton.tsx`) for loading states
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
