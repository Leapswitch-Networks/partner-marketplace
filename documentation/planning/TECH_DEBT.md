# Technical Debt Register

> Defects and inconsistencies carried in from the inherited scaffold, ranked by severity.
> **Everything here is known.** Don't re-report an item as a new discovery; do reference its ID.
>
> Planning docs are reference only — verify against the code before acting.

**Last audited:** 2026-07-31, after the auth/RBAC rebuild.
**Since then:** PM-25 added 2026-07-31 (containerisation); PM-26/27/28 added 2026-07-31
during the auth/RBAC rebuild, which also closed PM-1, 3, 6, 7, 9, 14, 15, 16, 17 and 18.
**2026-08-03 (auth/RBAC audit against LeapDesk):** the auth foundation was audited line by line against
LeapDesk (Laravel 12 + Spatie permission + Fortify). **Enforcement coverage is complete** — every route
is permission-gated and every ungated one is intentionally public — and every UserPolicy/RolePolicy
protection rule is already ported. The gap was **revocation**: closed by adding `user_sessions`.
PM-31/32/33 added from that audit.

**2026-08-03:** PM-29 closed; PM-30 added — the 17 react-hooks errors that closing PM-29 revealed.
PM-2 closed (its clearing half was genuinely still open). PM-4 confirmed **already** closed in code
since 2026-07-31 — only the documentation was wrong, and wrong in a way that broke the setup command.
**Both had been sitting in this register as 🔴 blockers while the code was fine.**

---

## Severity Key

| Level | Meaning |
|-------|---------|
| 🔴 **Blocker** | Must be fixed before the app is reachable from outside `localhost` |
| 🟠 **High** | Actively misleading or a real security weakness; fix before building on top |
| 🟡 **Medium** | Correctness or consistency problem; fix when touching the area |
| ⚪ **Low** | Cosmetic or housekeeping |

---

## Summary

| ID | Sev | Title | Area |
|----|:---:|-------|------|
| [PM-1](#pm-1--passwords-stored-and-compared-in-plaintext--resolved) | ✅ | ~~Passwords stored and compared in plaintext~~ | Auth |
| [PM-2](#pm-2--auth-cookies-set-with-securefalse--resolved) | ✅ | ~~Auth cookies set with `secure=False`~~ | Auth |
| [PM-3](#pm-3--any-admin-can-create-a-super-admin--resolved) | ✅ | ~~Any admin can create a super-admin~~ | Authz |
| [PM-4](#pm-4--seed-credentials-in-a-public-repo--resolved) | ✅ | ~~Seed credentials in a public repo~~ | Auth |
| [PM-5](#pm-5--no-row-level-scoping-pattern-exists) | 🟠 | No row-level scoping pattern exists | Authz |
| [PM-6](#pm-6--six-admin_users-columns-are-never-written--resolved) | ✅ | ~~Six `admin_users` columns are never written~~ | Data |
| [PM-7](#pm-7--three-auth-guards-are-defined-but-unused--resolved) | ✅ | ~~Three auth guards are defined but unused~~ | Authz |
| [PM-8](#pm-8--no-rate-limiting-and-no-lockout--partially-resolved) | ✅ | ~~No rate limiting and no lockout~~ — both now exist (PM-26) | Auth |
| [PM-9](#pm-9--cors-origins-hardcoded-to-localhost--resolved) | ✅ | ~~CORS origins hardcoded to localhost~~ | Infra |
| [PM-10](#pm-10--no-error-logging-or-monitoring--logging-done-monitoring-still-open) | 🟡 | ~~No error logging~~; **no monitoring or alerting** | Infra |
| [PM-11](#pm-11--no-automated-tests) | 🟠 | No automated tests | Quality |
| [PM-12](#pm-12--root-readmemd-is-wrong-in-twelve-places--resolved) | ✅ | ~~Root `README.md` is wrong in twelve places~~ | Docs |
| [PM-13](#pm-13--token-decoding-duplicated-in-routers) | 🟡 | Token decoding duplicated in routers | Auth |
| [PM-14](#pm-14--inconsistent-password-validation-rules--resolved) | ✅ | ~~Inconsistent password validation rules~~ | Schemas |
| [PM-15](#pm-15--patch-endpoints-require-every-field--resolved) | ✅ | ~~`PATCH` endpoints require every field~~ | API |
| [PM-16](#pm-16--no-change-password-endpoint--resolved) | ✅ | ~~No change-password endpoint~~ | Auth |
| [PM-17](#pm-17--emails-are-not-normalised--resolved) | ✅ | ~~Emails are not normalised~~ | Data |
| [PM-18](#pm-18--health-check-doesnt-check-the-database--resolved) | ✅ | ~~Health check doesn't check the database~~ | Infra |
| [PM-19](#pm-19--no-error-boundaries-or-route-suspense--resolved) | ✅ | ~~No error boundaries or route suspense~~ | Frontend |
| [PM-20](#pm-20--brand-colour-hardcoded-in-components) | ⚪ | Brand colour hardcoded in components | UI |
| [PM-21](#pm-21--stale-product-naming-throughout--mostly-resolved) | ✅ | ~~Stale product naming throughout~~ (2 items deferred) | Housekeeping |
| [PM-22](#pm-22--unused-tailwind-v4-dependency) | ⚪ | Unused Tailwind v4 dependency | Frontend |
| [PM-23](#pm-23--two-dead-virtualenvs-in-the-tree) | ⚪ | Two dead virtualenvs in the tree | Housekeeping |
| [PM-24](#pm-24--production-build-failed-on-a-type-error--resolved) | ✅ | ~~Production build failed on a type error~~ | Build |
| [PM-25](#pm-25--npm-ci-fails-react-19-against-next-14s-peer-range) | 🟠 | `npm ci` fails — React 19 against Next 14's peer range | Build |
| [PM-26](#pm-26--no-http-rate-limiting-successor-to-pm-8--resolved) | ✅ | ~~No HTTP rate limiting~~ | Auth |
| [PM-27](#pm-27--no-email-transport-so-invitations-and-resets-are-manual--resolved) | ✅ | ~~No email transport — invitations/resets are manual~~ | Infra |
| [PM-28](#pm-28--google-sso-is-unverified-against-real-google) | 🟠 | Google SSO implemented but never run against Google | Auth |
| [PM-29](#pm-29--eslint-cannot-run-v6-resolves-against-a-v9-flat-config--resolved) | ✅ | ~~ESLint cannot run — v6 binary vs v9 flat config~~ | Quality |
| [PM-30](#pm-30--17-react-hooks-errors-from-rules-that-arrive-with-the-wrong-config-version) | 🟡 | 17 react-hooks errors, from `eslint-config-next` 16 on Next 14 | Quality |
| [PM-31](#pm-31--refresh-reissues-rather-than-rotates-no-token-reuse-detection) | 🟡 | `/refresh` reissues rather than rotates — no reuse detection | Auth |
| [PM-32](#pm-32--no-audit-log-leapdesk-has-one--recording-done-read-surface-pending) | 🟡 | ~~No audit log~~ recording done; **no read surface** | Quality |
| [PM-33](#pm-33--no-security-response-headers--backend-done-frontend-pending) | 🟡 | ~~No security response headers~~ backend done; **frontend pending** | Infra |

---

## 🔴 Blockers

### PM-1 — Passwords stored and compared in plaintext ✅ RESOLVED

**Resolved 2026-07-31.** `hash_password` now uses bcrypt (12 rounds) and `verify_password` is the
only comparison in the codebase. Migration `e7b41c9a2d10` hashed every existing plaintext row in
place, so no credential was lost — verified by logging in afterwards with a pre-migration password.
`passlib` was dropped; bcrypt is used directly because passlib 1.7.4 is incompatible with
bcrypt ≥ 4.1. Google-only accounts carry `password = NULL` and cannot authenticate with a blank
string. **Note:** the old values were readable, so those passwords should still be rotated.

**Where:** `backend/app/core/security.py:9-16`, `backend/app/services/auth_service.py:28,46,107,154`,
`backend/app/models/user.py:18`, `backend/app/models/admin_user.py:29-30`, migration `cc12bb0fb8fb`

Implemented deliberately at every layer. `hash_password()` returns its input unchanged;
`verify_password()` is `plain == stored`; login is a raw `!=` comparison; the columns are commented
`"plain text password (dev/test only)"`; a migration renamed `password_hash` → `password` and
backfilled it. `passlib[bcrypt]` and `bcrypt` are installed and imported nowhere.

**Status:** raised before the repository was first pushed. The owner chose to publish publicly as-is.
**Accepted debt for local development — not deployable.**

**Fix:** see `../core/AUTHENTICATION.md` § Known Debt for the seven-step sketch. Note step 7 —
existing credentials must be rotated, since they were stored readable.

**Do not fix unprompted.** It is a deliberate current state.

---

### PM-2 — Auth cookies set with `secure=False` ✅ RESOLVED

**Setting side resolved by the 2026-07-31 auth/RBAC rebuild. Clearing side resolved 2026-08-03.**

`set_auth_cookies` has driven both cookies from `settings.COOKIE_SECURE` and `settings.COOKIE_SAMESITE`
since the rebuild. What the rebuild missed was the other half: `clear_auth_cookies` called Starlette's
`delete_cookie` with only a path. `delete_cookie` does **not** inherit the flags — it defaults to
`samesite="lax"`, `secure=False`, `httponly=False` — so the expiring `Set-Cookie` carried different
attributes from the one that created it.

Deletion still worked, because browsers match on name/domain/path. But it would have broken silently
the moment `COOKIE_SAMESITE` was set to `none` for a cross-site deployment: a `SameSite=None` cookie
without `Secure` is rejected outright, so the expiry header would be dropped and **logout would leave
the session cookie in place**. Both calls now mirror the full flag set.

**Verified 2026-08-03** by constructing both responses inside the running backend container:

| `COOKIE_SECURE` / `COOKIE_SAMESITE` | Set | Clear |
|---|---|---|
| `False` / `lax` (local default) | `HttpOnly; Path=/; SameSite=lax` — no `Secure`, correct for HTTP | same attributes, `Max-Age=0` |
| `True` / `none` (deployment shape) | `HttpOnly; SameSite=none; Secure` | `HttpOnly; SameSite=none; Secure; Max-Age=0` |

**Remaining, and it is configuration rather than a defect:** `COOKIE_SECURE` defaults to `False` so
local HTTP works, so every HTTPS environment must set it to `True`. Tracked in `DEPLOYMENT.md` § 0
under configuration, not blockers.

---

### PM-3 — Any admin can create a super-admin ✅ RESOLVED

**Resolved 2026-07-31.** The unauthenticated-role-assignment path is gone: there is no
`admin/register` endpoint any more, and `user_service._guard_role_assignment` refuses to grant
`RootUser`/`SuperAdmin` unless the actor already holds one. Same rule on invitations. Verified: an
Admin assigning SuperAdmin gets `403 Only a super admin may assign: SuperAdmin`.

**Where:** `backend/app/api/auth.py:64-74`, `backend/app/services/auth_service.py:36-52`

`POST /api/auth/admin/register` is gated on `get_current_admin` (any admin), and `register_admin()`
performs no role check — `role` comes straight from the request body. So a plain `admin`, who cannot
change their *own* role via `PATCH /api/admin/users/{id}`, can create a fresh `super_admin` account and
log into it.

**Fix:** gate the route on `require_super_admin` (which already exists, see PM-7), or reject
`role="super_admin"` in the service unless `actor.is_super_admin`. The route-level guard is preferable —
it shows up in OpenAPI.

---

### PM-4 — Seed credentials in a public repo ✅ RESOLVED

**Resolved by the 2026-07-31 auth/RBAC rebuild; confirmed and documented 2026-08-03.**

`seed_admin.py`, which hardcoded `abc@gmail.com` / `Abc@1234`, **no longer exists**. It was replaced by
`backend/app/db/seed_rbac.py`, which takes the root address from `ROOT_EMAIL` (defaulting to
`root@leapswitch.com`) and the password from `ROOT_PASSWORD`. There is no hardcoded default: if
`ROOT_PASSWORD` is unset the seeder generates `secrets.token_urlsafe(16)` and prints it once. The
source comment states the reasoning — *"Better a random password printed once than a known default
committed."*

**There is now no working credential anywhere in this repository.**

The rebuild did not update the docs, though, and that was the more dangerous half of this item: nine
places across `README.md`, `ONBOARDING.md`, `ARCHITECTURE.md`, `DATABASE_MIGRATIONS.md` and
`DEPLOYMENT.md` still referenced `app.db.seed_admin`. Because the module is gone, the **documented
setup command failed outright** — a new developer following the README got `ModuleNotFoundError`, and
ONBOARDING § 5.2 still published `Abc@1234` as the password the seeder creates. All corrected
2026-08-03.

---

## 🟠 High

### PM-5 — No row-level scoping pattern exists

**Where:** `backend/app/api/candidate.py`, `backend/app/api/category.py`

Every authenticated admin has full CRUD over every row. The guards are bound to a throwaway `_`
parameter precisely because no ownership check happens. There is **no pattern anywhere** for
"see only your own records".

**Why it's high:** the marketplace needs partner-scoped data. Improvising this per-route is how data
leaks across tenants. Design it centrally — see
[`MARKETPLACE_DOMAIN_PLAN.md`](./MARKETPLACE_DOMAIN_PLAN.md) § Required Regardless.

---

### PM-6 — Six `admin_users` columns are never written ✅ RESOLVED

**Resolved 2026-07-31.** `admin_users` is gone. On the unified `users` table,
`failed_login_attempts` / `locked_until` are written by `auth_service._record_failure`, and
`last_login_at` / `last_login_ip` by `_record_success` (fed by `get_client_ip`, which is now
actually called). `password_reset_token` / `password_reset_expires_at` are used by the implemented
forgot/reset flow. No dead security columns remain.

**Where:** `backend/app/models/admin_user.py:49-72`

| Column | Implies | Reality |
|--------|---------|---------|
| `failed_login_attempts` | Failure counting | Never incremented |
| `locked_until` | Account lockout | Never set or read — **there is no lockout** |
| `last_login_at` | Login audit | Never written |
| `last_login_ip` | Login audit | Never written |
| `password_reset_token` | Reset flow | No endpoint exists |
| `password_reset_expires_at` | Reset flow | No endpoint exists |

`get_client_ip()` exists to populate `last_login_ip` and is called by nothing.

**Why it's high:** reading the model, you would reasonably conclude lockout and auditing exist. They
don't. That's a false sense of security, not just dead code.

**Fix:** either implement the behaviour in `authenticate_admin()`, or drop the columns. Leaving them is
the worst option.

---

### PM-7 — Three auth guards are defined but unused ✅ RESOLVED

**Resolved 2026-07-31.** Every guard in `core/dependencies.py` is wired: `require_permission` on all
34 protected routes, `require_super_admin`/`require_admin_access` available and used by services,
and `get_client_ip` called by the login paths. Authorization is declarative per route and appears
in OpenAPI.

**Where:** `backend/app/core/dependencies.py` — `require_admin`, `require_super_admin`, `get_client_ip`

None is referenced outside its own module. Verify:

```bash
cd backend && grep -rn "require_super_admin" app --include="*.py" | grep -v dependencies.py
```

Super-admin enforcement instead happens as hand-written `if not actor.is_super_admin` checks inside
service functions — invisible in OpenAPI and easy to forget on the next endpoint. `require_admin`
checks `users.role == "admin"`, a role no route consults at all.

**Fix:** wire `require_super_admin` to the routes that need it (starting with PM-3) and delete the
service-level duplicates. Remove `require_admin` or give `users.role` a purpose.

---

### PM-8 — No rate limiting and no lockout 🟡 PARTIALLY RESOLVED

**Lockout implemented 2026-07-31.** After `MAX_FAILED_LOGIN_ATTEMPTS` (default 5) consecutive
failures the account locks for `ACCOUNT_LOCKOUT_MINUTES` (default 15) and login returns `429`.
A successful login or a password reset clears it, and an admin can clear it via
`POST /api/users/{id}/unlock`. Verified end to end.

**Still open:** there is no HTTP-level rate limiting, so an attacker can still spray *many
different* accounts, and the lockout is per-account rather than per-IP. Add a reverse-proxy or
middleware limit before going public.

**Where:** `backend/app/main.py` (no middleware), `authenticate_admin` / `authenticate_user`

Nothing throttles repeated login attempts, and PM-6 means the lockout columns are inert. Combined with
PM-1, a leaked database is immediately usable and brute-forcing is unimpeded.

---

### PM-9 — CORS origins hardcoded to localhost ✅ RESOLVED

**Resolved 2026-07-31.** `CORS_ORIGINS` is a comma-separated setting read by `main.py` via
`settings.allowed_origins`. `COOKIE_SECURE`, `COOKIE_SAMESITE`, `FRONTEND_URL`, `BCRYPT_ROUNDS`,
`STAFF_EMAIL_DOMAINS` and the Google credentials are all configuration too — deploying no longer
requires a code edit.

**Where:** `backend/app/main.py:11-17`

`allow_origins=["http://localhost:3000", "http://localhost:3001"]` with `allow_credentials=True`.
Deploying requires a code edit.

**Fix:** move to `Settings` as a comma-separated env var. Prefer same-origin deployment, which removes
the problem — see `../system-design/DEPLOYMENT.md` § 1.

---

### PM-10 — No error logging or monitoring ⚠️ LOGGING DONE, MONITORING STILL OPEN

**Logging resolved 2026-08-03** in `backend/app/core/logging.py` plus three exception handlers in
`main.py`. **Monitoring is not done** — nothing alerts anyone, so the item stays open rather than being
marked resolved. Splitting it honestly beats ticking it off.

#### What exists now

| Piece | What it does |
|---|---|
| `configure_logging()` | One root handler. `LOG_FORMAT=console` for humans, `json` for aggregators; `LOG_LEVEL` configurable |
| `RequestContextMiddleware` | Assigns each request an id, logs method/path/status/duration, echoes the id in `X-Request-ID` |
| `RequestIdFilter` | Copies the id onto **every** record, so a line from deep inside a service is attributable without threading an id through every signature |
| `RequestValidationError` handler | 422s logged at INFO — a caller's mistake is not an error |
| `SQLAlchemyError` handler | Separate from the catch-all, because "the database refused this" and "the code has a bug" need different responses from whoever is on call |
| `Exception` handler | Logs the traceback, returns `{"detail": …, "request_id": …}` |

Uvicorn's own loggers are re-pointed at the root handler, so its access lines carry the request id too
and nothing is printed twice in two different formats. `sqlalchemy.engine` is pinned to WARNING —
its INFO level is every statement executed, which is useful deliberately and unbearable by accident.

#### Two rules the implementation is built around

**Request bodies are never logged.** Login, registration, change-password and reset all carry a
plaintext password in the body. Logging bodies "for debugging" would write those passwords to disk in
cleartext and undo PM-1. The 422 handler is where this nearly went wrong: `exc.errors()` can echo the
submitted value, so it logs only field locations and messages. Verified with canary passwords through
both the normal and the validation path — neither reached the logs.

**Responses carry a correlation id and nothing else.** A traceback or a raw database error in a
response body tells an attacker table names, driver versions and file paths. The id is what ties a
user's "it broke at 3pm" to the traceback.

#### Two bugs found while verifying, both in this implementation

1. **The 500 body reported `request_id: "-"`.** The middleware reset the `ContextVar` in a `finally`,
   which ran as the exception propagated — *before* Starlette's `ServerErrorMiddleware` invoked the
   handler that builds the body. So the one response that exists to hand over an id handed over a dash.
2. **Every access log line read `[-]`.** Same cause on the success path: the reset ran before the
   summary line was emitted, and before uvicorn wrote its access line. The most useful line in the log
   had no id on it.

Both fixed by never resetting: every request sets its own id as its first act, so a stale value can
never be read as a fresh one. Verified that the `X-Request-ID` response header now matches both the
application's summary line and uvicorn's access line for the same request.

Also trimmed: a 500 was logging **three** tracebacks — the middleware, the handler, and uvicorn. The
middleware now logs the exception type and message without a traceback, contributing the route and
duration that the other two lack. Uvicorn's copy is unavoidable: `ServerErrorMiddleware` always
re-raises after calling a handler.

#### Verified 2026-08-03

| Check | Result |
|---|---|
| `X-Request-ID` generated when absent | 16-hex id present on the response |
| Inbound id honoured | `my-trace-abc123` echoed back |
| Malformed inbound id rejected | `bad id with spaces!!` replaced with a fresh id — blocks log injection via a newline in the header |
| Unhandled exception | `500` with `{"detail": "Internal server error.", "request_id": "…"}` and **no traceback in the body** |
| Traceback reaches the log | Present under the same id, alongside the access line |
| Password leakage | Canary passwords absent from logs via both the normal and 422 paths |
| `LOG_FORMAT=json` | One JSON object per line, extras as fields, traceback as an escaped string |

The 500 was triggered with a temporary route that raised `RuntimeError`; it was removed afterwards and
its absence confirmed (`404`, and gone from the source).

#### Still open — the monitoring half

- **Nothing alerts.** These lines go to stdout. Shipping them somewhere that pages a human is a
  deployment concern and is not built.
- **No error tracking service.** No Sentry or equivalent, so there is no aggregation, no deduplication
  and no regression detection across releases.
- **No log retention.** Container stdout, lost on `docker compose down`.

---

### PM-11 — No automated tests

No test suite, no test runner configured, no CI. Nothing verifies that a change doesn't break auth.
Given PM-1's fix will touch every login path, tests should land first.

---

### PM-25 — `npm ci` fails: React 19 against Next 14's peer range

**Where:** `frontend/package.json:16-18`, `frontend/package-lock.json`

**Found 2026-07-31** while building the frontend dev container. `npm ci` — the standard clean-install
command, and what any CI job would run — **fails outright**:

```
npm error While resolving: next@14.2.35
npm error Found: react@19.2.4
npm error Could not resolve dependency:
npm error peer react@"^18.2.0" from next@14.2.35
```

`package.json` pins `react`/`react-dom` at `19.2.4`, but `next@14.2.35` declares
`peer react@^18.2.0`. **React 19 support landed in Next 15, not 14.** `package-lock.json` already
records the React 19 tree, so it was generated with `--legacy-peer-deps` or `--force`; `npm ci`
re-validates peer ranges and refuses it.

**Why it hasn't bitten yet:** `frontend/node_modules` already exists on the maintainer's machine, so
nobody has done a clean install since. The app runs and `npm run build` passes (PM-24) — the
combination happens to work at runtime, it is simply **unsupported**.

**Current workaround:** `frontend/Dockerfile.dev` runs `npm ci --legacy-peer-deps`, which installs
the exact tree the lockfile records rather than resolving a different one. The flag is commented
there and points back at this entry.

**The real fix is a decision, not a command** — pick one:

| Option | Effect |
|--------|--------|
| Upgrade to Next 15+ | Makes React 19 supported. Needs an App Router migration review. |
| Downgrade React to 18.3.x | Matches Next 14's peer range. `NEXTJS_STANDARDS.md` says React 19 throughout, so docs follow. |
| Keep as-is, commit `.npmrc` with `legacy-peer-deps=true` | Makes the bypass explicit and repo-wide instead of Docker-only. Least work, keeps the unsupported pairing. |

Note `../system-design/NEXTJS_STANDARDS.md` § 1 presents "Next.js 14 + React 19" as the verified
stack without recording that npm rejects the pairing. Whichever option is taken, that line needs a
matching correction.

---

## 🟡 Medium

### PM-12 — Root `README.md` is wrong in twelve places ✅ RESOLVED

**Resolved 2026-07-30.** Every version number, the Docker instructions, the driver, the folder layout,
the seed command and the credentials were wrong. Historical table in `../ONBOARDING.md` § 12.

**What was done:** the README was rewritten to defer to `documentation/INDEX.md` and
`documentation/ONBOARDING.md`, and its version table was **removed rather than corrected** — a
hardcoded version table goes stale silently, so `frontend/package.json` and
`backend/requirements.txt` are now the only stated source of truth. The fabricated `docker/` tree,
the `docker-compose up --build` instructions, the `seed.py` reference, the credentials block and the
test-engine flow diagram were all deleted.

---

### PM-13 — Token decoding duplicated in routers

**Where:** `backend/app/api/auth.py` — `refresh()` (112-123) and `whoami()` (143-155)

Both re-implement decode-and-assert-type instead of using a dependency. `whoami` additionally catches
bare `except Exception`, which will swallow genuine bugs as 401s.

**Fix:** extract to `dependencies.py`; narrow the catch to `(JWTError, KeyError)`.

---

### PM-14 — Inconsistent password validation rules ✅ RESOLVED

**Resolved 2026-07-31.** `schemas/auth.py::validate_password_strength` is the single rule
(min length from config, one uppercase, one digit) and every password-bearing schema reuses the
`_PasswordPair` mixin.

**Where:** `backend/app/schemas/auth.py:9-41`

`AdminRegisterRequest` requires ≥8 chars **plus** an uppercase letter and a digit.
`RegisterRequest` requires only ≥8 chars. Two standards in one file.

---

### PM-15 — `PATCH` endpoints require every field ✅ RESOLVED

**Resolved 2026-07-31.** `UpdateProfileRequest`, `UpdateUserRequest` and `UpdateRoleRequest` are
all-optional and applied with `model_dump(exclude_unset=True)`, so PATCH is genuinely partial.

**Where:** `UpdateProfileRequest`, `UpdateAdminProfileRequest`

Both fields are required, so `PATCH /api/auth/me` behaves like `PUT`. Only `UpdateAdminUserRequest`
is genuinely partial.

**Fix:** make fields optional and apply only what's present, or change the verb to `PUT`.

---

### PM-16 — No change-password endpoint ✅ RESOLVED

**Resolved 2026-07-31.** `POST /api/auth/me/change-password` requires the current password,
rejects reusing it, and refuses on Google-only accounts (which have no password to verify).
`forgot-password` / `reset-password` are implemented too.

Neither account type can change its password through the API. Combined with PM-6's unimplemented reset
flow, the only route is a direct database edit.

---

### PM-17 — Emails are not normalised ✅ RESOLVED

**Resolved 2026-07-31.** `auth_service.normalise_email` lower-cases and trims on every write and
every lookup, and the migration lower-cased all existing rows.

**Where:** `auth_service.py` — `.strip()` only, no `.lower()`

`Admin@x.com` and `admin@x.com` become two distinct accounts, and login is case-sensitive on the local
part. Uniqueness constraints won't catch it.

**Fix:** lower-case on write and on lookup. Needs a data migration to deduplicate any existing rows.

---

### PM-18 — Health check doesn't check the database ✅ RESOLVED

**Resolved 2026-07-31.** `/health` stays shallow and cheap; `/health/ready` runs `SELECT 1` and
reports `unavailable` when the database is unreachable. Use the latter as a probe.

**Where:** `backend/app/main.py:25-27`

`/health` returns `{"status":"ok"}` unconditionally — it stays green with Postgres down, so it's
useless as a load-balancer probe.

**Fix:** add a deep variant running `SELECT 1`. Keep the shallow one for liveness.

---

### PM-19 — No error boundaries or route suspense ✅ RESOLVED

**Resolved 2026-08-03.** Eight files, all confirmed registered in the route tree.

| File | Catches |
|---|---|
| `app/global-error.tsx` | A failure in the **root layout itself** |
| `app/error.tsx` | Anything below the root layout without a nearer boundary |
| `app/dashboard/error.tsx` | A module failure, **keeping the sidebar and top nav alive** |
| `app/(auth)/error.tsx` | Sign-in / sign-up |
| `app/not-found.tsx` | 404 |
| `app/loading.tsx`, `app/dashboard/loading.tsx` | Suspense fallbacks, skeleton-shaped |
| `components/common/ErrorState.tsx` | The shared body, so four boundaries are not four near-copies |

**Verified against the installed version, not from memory.** `next/dist/docs/` — which `AGENTS.md`
requires reading — **does not exist in `next@14.2.35`**, so the contract was read from the shipped
types instead: `error-boundary.d.ts` gives `{ error: Error; reset: () => void }`, and
`next-app-loader.js` lists the recognised conventions as `layout`, `template`, `error`, `loading`,
`not-found`, plus `global-error`. Worth noting for the next person, because the instruction cannot be
followed literally.

#### Three things that are easy to get wrong, and why the code looks like it does

1. **`global-error.tsx` renders its own `<html>` and `<body>`, and uses inline styles.** It *replaces*
   the root layout rather than nesting inside it, so it cannot assume `Providers`, the Redux store, the
   theme class, the `next/font` variable, or even that `globals.css` loaded. Importing a component that
   reached for the store would fail inside the error handler and produce exactly the blank screen the
   file exists to prevent.
2. **`error.digest`, not `error.message`, is what users see.** For a server-thrown error Next replaces
   the message with an opaque digest before it reaches the browser, deliberately. `ErrorState` shows
   the digest always (support asks for it, and it correlates with the backend's `X-Request-ID`) and the
   message only when `NODE_ENV === "development"`.
3. **A folder starting with `_` is a private folder and is not routable.** A first verification attempt
   used `app/(auth)/__boom/` and returned 404 — not because the boundary failed, but because the route
   never existed.

#### What was verified, and what was not

| Check | Result |
|---|---|
| All 8 files registered in the route tree | Present in `.next/app-build-manifest.json` — `/error`, `/global-error`, `/loading`, `/not-found`, `/dashboard/error`, `/dashboard/loading`, `/(auth)/error`, `/_not-found/page` |
| 404 end to end | `GET /this-route-does-not-exist` → **HTTP 404** with the custom copy; `middleware.ts` does not intercept it |
| `tsc --noEmit` | Clean |
| `next build` | Green, 10 routes |
| **Error boundaries rendered in a browser** | ❌ **Not done** |

The last row is the honest gap. A boundary's output cannot be checked with `curl`: in dev, Next's error
overlay intercepts and the raw message is served instead; in production, a route that throws during
prerender **fails the build** (confirmed — `Export encountered errors on /boom-check`), so the throwing
route had to be removed. Proving the rendered output needs the Chrome-DevTools-Protocol harness used on
2026-07-31. The manifest evidence covers the real silent-failure risk — a boundary in the wrong place
or with the wrong filename is ignored without complaint — but it does **not** prove the fallback looks
right.

Also fixed alongside: `Skeleton` had no dark variant. Tolerable on a small inline placeholder, glaring
as a full-page one, which these loading files made it.

**One caveat on `loading.tsx`:** every dashboard page renders the same client component, so its segments
resolve instantly and the fallback will rarely be seen in practice. It is correct to have, and it is
not doing much work today.

---

## ⚪ Low

### PM-20 — Brand colour hardcoded in components

`components/common/Button.tsx` and `Input.tsx` write `#F97316` inline despite `brand` existing in
`tailwind.config.ts`. A rebrand means editing components.

---

### PM-21 — Stale product naming throughout ✅ MOSTLY RESOLVED

**Resolved 2026-07-30.** The original audit undercounted this — a verification sweep found 18
occurrences across 14 files, not the 6 first listed. Notably it included **user-visible brand text**:
"Test Platform" was rendered in the sidebar (3 places) and the navbar, alongside a `T` monogram.

| Location | Was | Now |
|----------|-----|-----|
| `frontend/app/layout.tsx` | `metadata.title = "Test Platform"` | ✅ Partner Marketplace |
| 7 × route `page.tsx` | `"<Page> — Test Platform"` titles + descriptions | ✅ Partner Marketplace |
| `frontend/components/dashboard/Sidebar.tsx` | "Test Platform" ×3 + `T` monogram ×3 | ✅ Partner Marketplace / `P` |
| `frontend/components/dashboard/Navbar.tsx` | "Test Platform" + `T` monogram | ✅ Partner Marketplace / `P` |
| `backend/app/main.py` | `FastAPI(title="Test Platform API")` | ✅ Partner Marketplace API |
| `package-lock.json` (root) | `"name": "test-platform"` | ✅ partner-marketplace |
| `documentation/README.md` | competing "Docs Index" | ✅ deleted — one README per project |

**Still outstanding**, both deliberately deferred because they carry real risk rather than being
string edits:

| Location | Says | Why deferred |
|----------|------|--------------|
| `docker-compose.yml` | network `test-platform` | Renaming recreates the Docker network — containers must be stopped first |
| `.env` / `DATABASE_URL` | `POSTGRES_DB=test_platformDB` | Touches three coupled values plus the existing `data/db` cluster. Dump-and-restore, not an in-place rename — see [`SCAFFOLD_CLEANUP_PLAN.md`](./SCAFFOLD_CLEANUP_PLAN.md) § 3.3. Low value, non-trivial risk. |

---

### PM-22 — Unused Tailwind v4 dependency

`@tailwindcss/postcss ^4` sits in `frontend/devDependencies` but `postcss.config.mjs` uses the v3
plugin form and `tailwindcss ^3.4.19` is installed. The build is consistent; the package is dead
weight. Safe to remove — **not** safe to activate without a full v3→v4 migration.

---

### PM-23 — Two dead virtualenvs in the tree

Root `.venv/` is a Windows/`uv` venv (unusable on Linux); `backend/.venv/` is a Linux venv whose
interpreter no longer matches its packages. Both gitignored, both ~93 MB. `../ONBOARDING.md` § 2 tells
newcomers to delete them.

---

### PM-24 — Production build failed on a type error ✅ RESOLVED

**Where:** `frontend/components/admin/AddQuestionForm.tsx:17,25,46`

**Found and fixed 2026-07-30.** `npm run build` **failed** — it compiled, then died in the
"Linting and checking validity of types" phase with two `error TS` reports. Since
`next.config.mjs` does not set `typescript.ignoreBuildErrors`, Next.js treats type errors as fatal,
so **the project could not be built for production at all.** This was pre-existing, inherited with
the scaffold, and had not been caught because nothing runs the build.

**Cause:** `marks: z.coerce.number()` in the form's Zod schema. Under Zod 4, a coercing schema has a
different *input* type (`unknown` — coercion accepts anything) from its *output* type (`number`).
`type FormValues = z.infer<typeof schema>` resolves to the **output** type, but `useForm<FormValues>`
passes that as the field-values generic, which `zodResolver` needs to match the **input** type.
Hence `Resolver<{… marks: unknown …}>` not assignable to `Resolver<{… marks: number …}>`.

**Fix:** used React Hook Form's three-generic form, which exists for exactly this case:

```ts
type FormInput  = z.input<typeof schema>;   // what the resolver receives
type FormValues = z.output<typeof schema>;  // what onSubmit receives
useForm<FormInput, unknown, FormValues>({ resolver: zodResolver(schema), … })
```

Runtime behaviour is unchanged — the number field still yields a coerced `number` in `onSubmit`.

**Verified:** `npm run build` now completes, generating all 12 routes.

**Lessons worth keeping:**
- This is the only `z.coerce` in the codebase. Any new one needs the same treatment — noted in
  `../system-design/NEXTJS_STANDARDS.md` § 7.
- The file is slated for deletion in `SCAFFOLD_CLEANUP_PLAN.md` § 2.1, so this fix may be short-lived.
  It was still worth making: a repo that cannot build is broken for everyone until then.
- **Nothing in CI or local workflow runs `npm run build`** (PM-11). A build that has been broken
  unnoticed is the strongest argument for that item.

---

### PM-26 — No HTTP rate limiting (successor to PM-8) ✅ RESOLVED

**Resolved 2026-08-03.** `backend/app/core/rate_limit.py` — a per-IP sliding-window limiter,
registered in `main.py`.

Hand-written rather than pulling in `slowapi`, matching the reasoning that removed `passlib`: one
fewer dependency, and `slowapi`'s default backend is in-process memory anyway, so it would not have
fixed the real limitation below.

**Three tiers**, because one number cannot serve both a login form and a dashboard:

| Tier | Applies to | Default |
|---|---|---|
| `sensitive` | `login`, `register`, `forgot-password`, `reset-password`, `accept-invitation`, `me/change-password`, `invitations/preview` | **10 / 60s** |
| `auth` | the rest of `/api/auth/*` — `me`, `refresh`, `logout`, Google | 60 / 60s |
| `default` | everything else | 300 / 60s |

`/health*` is exempt: an orchestrator polling liveness must not be able to exhaust its own quota and
get the service pulled from a load balancer. `OPTIONS` is exempt so a CORS preflight does not make one
real request cost two. All limits are `Settings` values, and `RATE_LIMIT_ENABLED` turns the whole thing
off for a load test or once a proxy does the job.

A sliding log, not a fixed window: a fixed window lets a caller send the full allowance at 0:59 and
again at 1:01 — double the intended rate, at exactly the boundary an attacker would look for.

#### The bug found while verifying it, which mattered more than the feature

The first working version **could be bypassed completely**, and the measurement is worth keeping:
sending 14 logins while rotating `X-Forwarded-For: 10.9.9.$i` produced **14 × HTTP 401 against a limit
of 10** — a fresh bucket per request.

The cause was in `get_client_ip`, not in the limiter. It returned the `X-Forwarded-For` value whenever
the header was present. That header is written by the *client*; it is only trustworthy when a proxy
overwrites it, and **this deployment has no reverse proxy**. So the limiter keyed on an
attacker-controlled string, and the same header could write any address into `users.last_login_ip` and
poison the audit trail.

Now gated on `TRUST_PROXY_HEADERS` (default `False`): the socket address is used unless a proxy is
declared to be in front. **Enable it only in the same change that deploys the proxy** — turning it on
without one restores the bypass exactly.

Re-measured after the fix: 10 through, then `429`, regardless of the rotating header.

#### Verified 2026-08-03, against the running stack

| Check | Result |
|---|---|
| 12 rapid logins, limit 10 | 10 × `401`, then `429` |
| `429` body and headers | `Retry-After: 4`, `X-RateLimit-Limit: 10`, `X-RateLimit-Remaining: 0` |
| **`429` carries `Access-Control-Allow-Origin`** | Present — the middleware order is right |
| Window releases | recovers to `401` after expiry, does not latch |
| `/health` × 30 | 30 × `200` — exempt |
| Tier isolation | `/api/auth/me` still answered with `X-RateLimit-Limit: 60` while `sensitive` was exhausted |
| `X-Forwarded-For` spoofing | 14 rotating values → `429` after 10 |
| `get_client_ip`, both modes | `False`: socket wins, header ignored. `True`: first hop wins, chain parsed, falls back to socket |

The CORS check is the one that would have been easy to miss: `RateLimitMiddleware` is registered
**before** `CORSMiddleware` because Starlette runs the most recently added middleware outermost. Get
that backwards and the `429` escapes without CORS headers, so the browser reports an opaque network
error instead of "too many attempts".

#### Still open

**Counters are per process.** N workers multiply every limit by N, and a restart clears them. Honest
for the current single-container deployment, wrong the moment the API scales horizontally — a shared
store (Redis) is the fix. Until then this is a speed bump against spraying, not an authorisation
control. It is also not a defence against a distributed attack: per-IP limiting does nothing against a
botnet, which is what the per-account lockout is for. The two are complements, and neither replaces
the other.

---

### PM-27 — No email transport, so invitations and resets are manual ✅ RESOLVED

**Resolved 2026-08-03.** `backend/app/services/mail_service.py`, wired into invitation create, bulk
create, resend, and `forgot-password`.

Two backends, chosen by `MAIL_BACKEND`. `console` (the default) logs the message instead of sending it,
so local development needs no SMTP server and the link is in `docker compose logs backend`. `smtp`
sends for real via `smtplib`.

**`console` is the default rather than `smtp`, deliberately.** An unconfigured `smtp` backend fails
every send; an unconfigured `console` backend works. The cost of guessing wrong should be "the link is
in the log", not "nobody can ever be invited".

#### Three decisions that shape the code

**A send never breaks the operation that triggered it.** Creating an invitation writes a row; emailing
is a side effect that can fail for unrelated reasons — wrong password, blocked port, greylisting relay.
If that propagated, the caller would get a 500 for an invitation that *was* created, and retrying would
then be refused with "a pending invitation already exists". So `send()` returns a boolean and the caller
decides what to tell the user.

**`accept_url` is now withheld only when a real email was delivered.** It used to be returned
unconditionally. Returning it after successful delivery would leave a working credential in an API
response, a devtools tab and a log for something already delivered privately. But withholding it after
a *failed* send would leave the invitation created and uncompletable. So the rule is
`sent and backend != "console"`, and a new `email_sent` boolean lets the UI say "we emailed them"
versus "copy this link and send it yourself".

**`forgot-password` does not reflect the send result, on purpose.** A caller able to tell "sent" from
"not sent" could enumerate accounts exactly as easily as one able to read a 404 — which is the whole
reason that endpoint answers identically either way. A failed send is logged, never surfaced.

Also: the reset TTL is now the named `auth_service.PASSWORD_RESET_TTL_HOURS`, because the email quotes
it. A literal in two places is how an email comes to promise an hour for a token that lasts two.

#### Verified 2026-08-03

The SMTP half looked unverifiable without credentials. It was verified against a **minimal fake SMTP
relay** written for the test, which speaks enough of the protocol to accept a message:

| Case | Result |
|---|---|
| `console` | Returns `True`, logs subject and body |
| `smtp` with no `SMTP_HOST` | `False`, logs `MailError`, does **not** raise |
| `smtp` with an unreachable host | `False`, logs `ConnectionRefusedError`, does **not** raise |
| Unknown backend (`carrier-pigeon`) | `False`, logs `unknown MAIL_BACKEND` |
| `smtp` against the fake relay | `True` — relay received a well-formed message with the right `To`, `Subject`, and the reset link intact |
| **Token safety on failure** | A canary body was sent through both failing SMTP cases and appeared in **neither** log — the failure path logs recipient and subject only |
| `forgot-password` live | Answered the neutral message; reset link logged under the request's correlation id |
| Invitation create live | `email_sent: false` and `accept_url` present, correct for the `console` backend |

The `accept_url`-withheld branch (`smtp` + successful send → `accept_url: null`) was not exercised
through the live API, since the running server would have to be pointed at the fake relay; it is a
two-term boolean and is stated here rather than claimed as tested.

#### Still open

- **Delivery against a real provider is untested** — authentication, the TLS handshake, and whether
  anything actually lands in an inbox (SPF/DKIM/DMARC are unconfigured). The protocol is proven; the
  deliverability is not.
- **`MAIL_BACKEND=console` must never be used in a deployed environment.** It writes reset links to the
  log, and a reset link is a working credential for anyone who can read logs. Listed in
  `DEPLOYMENT.md` § 0 configuration.
- **Sends are synchronous.** On a slow relay the request waits; `SMTP_TIMEOUT_SECONDS` bounds it at 10s
  rather than removing it. A queue is the real answer if invitation volume ever grows.
- **No HTML or branding.** Plain text, which every client renders and nothing can break. Branding is a
  product decision, not a gap.

---

### PM-28 — Google SSO is unverified against real Google

**Where:** `backend/app/services/google_service.py`

The flow is implemented (signed `state`, code exchange, `email_verified` check, domain gate,
three-step account resolution) but **has never run against Google** — no client credentials are
configured, so `settings.google_oauth_configured` is false and the endpoints return `503`.

**Fix:** create an OAuth client, set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` /
`GOOGLE_REDIRECT_URI=http://localhost:8002/api/auth/google/callback`, then walk the flow. Until that
happens, treat this code as untested.

---

### PM-29 — ESLint cannot run: v6 resolves against a v9 flat config ✅ RESOLVED

**Resolved 2026-08-03.** `npm run lint` now lints, and the root cause was **not** what this entry
originally guessed — the guess is left here because it was wrong in an instructive way.

**What was guessed:** a hoisted transitive copy of ESLint 6 winning module resolution.

**What it actually was:** the local install is correct — `node_modules/eslint` is **9.39.4**. But every
one of the 23 shims in `frontend/node_modules/.bin/` had **lost its execute bit** (`-rw-rw-rw-`), and
they are Windows-style shell shims with `.cmd`/`.ps1` siblings rather than the symlinks npm creates on
Linux. With `node_modules/.bin/eslint` not executable, `npx` and `npm run` both fall through to the
next `eslint` on `PATH` — Debian's `/usr/bin/eslint`, which is **6.4.0** and wants `.eslintrc`. Nothing
was wrong with the dependency tree at all; the "v6 vs v9" symptom was a file-permission artifact of
how this checkout's `node_modules` was installed.

**Fix applied:**

1. `chmod +x frontend/node_modules/.bin/*` — restores all 23 shims. `node_modules` is gitignored, so
   this is a **local repair, not a committed fix**; it must be repeated if `node_modules` is
   reinstalled in a way that drops the bit again. The filesystem is ext4 and holds the bit fine, so
   the cause is the install, not the disk.
2. `package.json` scripts gained a target and two companions:
   `"lint": "eslint app components lib types"`, `"lint:fix"`, and `"typecheck": "tsc --noEmit"`.

**Diagnosing this again:** compare `npx eslint --version` against
`grep '"version"' node_modules/eslint/package.json`. If they disagree, check `ls -la node_modules/.bin/`
for the execute bit before suspecting the dependency tree.

**What it surfaced:** 24 errors on first run. 7 were fixed immediately (see below); the remaining 17
are recorded as PM-30.

---

### PM-30 — 17 react-hooks errors, from rules that arrive with the wrong config version

**Where:** 12 files across `components/` and `app/`. Reproduce with `npm run lint`.

The first real lint run reported 24 errors. Seven were fixed in the same change, because they were
genuine defects rather than style opinions:

| Fixed | Rule | What it was |
|---|---|---|
| `components/dashboard/Sidebar.tsx` (5) | `react-hooks/static-components`, `react/display-name` | `BottomExpanded` and `BottomCollapsed` were `memo()` components **declared inside `Sidebar`'s render**. A component created during render gets a new type every render, which discards the memoisation and resets any state it holds. Both are hoisted to module level and take `loggingOut`/`onLogout` as props; the now-dead `navIcons.logout` entry was removed in favour of a module-level `logoutIcon` |
| `components/admin/Candidate.tsx` (2) | `react/no-unescaped-entities` | Raw `"` in JSX text, now `&ldquo;`/`&rdquo;` |

**The 17 that remain**, and why they are deferred rather than fixed:

| Count | Rule |
|---|---|
| 15 | `react-hooks/set-state-in-effect` |
| 1 | `react-hooks/immutability` (`Sidebar.tsx`) |
| 1 | `react-hooks/preserve-manual-memoization` (`Sidebar.tsx`) |

These come from `eslint-plugin-react-hooks` v6 — the React-Compiler-era rule set — which is bundled by
**`eslint-config-next@16.2.3`**, while the app runs **`next@14.2.35`**. So the codebase is being judged
against a rule set from two major versions ahead of its framework. That overlaps **PM-25**: whichever
way the React/Next version decision goes changes whether these 17 even apply. Fixing them before that
decision risks refactoring 12 files to satisfy rules that get removed.

Most of the 15 are the mount-flag pattern (`useEffect(() => setIsLoaded(true), [])` driving an entry
animation) and state derived from a just-completed fetch. Neither is a live bug today; the rule exists
because both defeat the React Compiler's assumptions.

**Fix:** settle PM-25 first, then re-run and fix whatever the chosen config still reports. Do **not**
blanket-disable the rules — the `static-components` findings above prove this rule set catches real
defects in this codebase.

---

### PM-31 — `/refresh` reissues rather than rotates: no token reuse detection

**Where:** `backend/app/api/auth.py` `refresh()`

Sessions (2026-08-03) made revocation possible, and `/refresh` now refuses a revoked session. What it
does **not** do is invalidate the specific refresh token it just superseded: the session id is carried
over, so the previous token stays decodable and keeps working until its own 7-day expiry while the
session lives.

Consequence: a refresh token captured at any point remains usable for as long as that session is alive,
even after the legitimate client has refreshed several times. The blast radius is bounded — revoking the
session kills every token naming it at once, and logout/password-change/admin-suspend all do that — but
a stolen token is not individually killable.

**Fix:** give each refresh token a `jti`, store the current one on the session row, and on refresh (a)
reject a `jti` that is not the current one and (b) treat that rejection as evidence of theft by revoking
the whole session. That last part is the point: presenting a superseded token means either the client
replayed it or an attacker has it, and neither should continue.

**Not urgent** because the session check bounds it, but it is the difference between "revocable" and
"rotating", and the standard expectation for refresh tokens is rotation with reuse detection.

---

### PM-32 — No audit log; LeapDesk has one ⚠️ RECORDING DONE, READ SURFACE PENDING

**Recording resolved 2026-08-03.** `activity_log` table, `app/models/activity_log.py`,
`app/services/activity_service.py`. **There is no way to read it yet** — no endpoint, no permission, no
screen. LeapDesk has an Activity Log Index; ours is write-only until that is built.

Column names are LeapDesk's verbatim: `log_name`, `description`, `subject_type`, `subject_id`, `event`,
`causer_type`, `causer_id`, `properties`, `batch_uuid`, `created_at`, `updated_at`. Its index names
`subject` and `causer` are kept too.

**What is recorded**, all verified against the running stack:

| Event | Where |
|---|---|
| `login` | after a session exists — so the row means "a session was created", not "the password matched" |
| `failed_login` | unknown email, bad password, locked account, **and credentials-valid-but-status-blocked** |
| `logout` | only when a session was actually revoked |
| `created` / `updated` / `deleted` | user create, update, delete — with a before/after diff |
| `status_changed` | toggle, approve, and bulk status, rather than hidden inside an `updated` diff |
| `roles_changed` | its own event, with `granted` / `revoked` lists |
| `lockout_cleared` | an admin overriding a control that fired for repeated failures |
| `password_changed` | when an administrator sets someone else's password |

**Design decisions worth keeping:**

- **Two column types diverge while the names do not.** `subject_id`/`causer_id` are `String(36)` because
  our ids are UUIDs and one column holds both a user UUID and a role integer; `properties` is `JSONB`
  rather than `json` so it can be indexed and queried, which is the point of a database over a log file.
- **`*_type` holds `User` / `Role`, not `App\Models\User`.** Storing a PHP namespace in a Python codebase
  would be a lie someone would eventually try to resolve.
- **Nothing here may raise.** Every entry point swallows and logs its own exceptions, matching LeapDesk's
  try/catch around `activity()`. Failing a login because an audit write failed would turn observability
  into an outage.
- **Recording is explicit, not a global ORM hook.** A hook cannot be forgotten, which is its advantage;
  the reason to reject it is that it would log the inherited test-platform domain and every session
  `last_seen_at` touch, burying the role grants. The trade-off is named in the service docstring.
- **`password`, hashes and reset tokens are stripped from every diff.** An audit trail is read by more
  people than the database is, so it is a worse place for a secret.
- **`batch_uuid` groups bulk operations**, so deleting nine accounts reads as one action.
- **A failed login has no causer and no subject.** Nobody authenticated, and the submitted address may
  match no account — inventing a subject for it would be fiction. The address goes in `properties`.

**Still open:** a read endpoint gated on a new `activity-view` permission, and a UI. Also no retention
policy — this table grows forever, and unlike `user_sessions` it must not simply be purged, so the
policy is a real decision rather than a cron job.

Original entry follows.

**Where:** whole backend

`users.created_by` / `updated_by` record *who last touched a row* and nothing else. There is no history,
so none of these can be answered: who granted this user the Admin role, and when? Who deactivated this
account? How many failed logins preceded that lockout? Who deleted the role that used to exist?

LeapDesk has `spatie/laravel-activitylog` with two layers worth porting:

- **`LogsAllActivity`** — a trait wrapping Spatie's, logging dirty fields only, rewriting an
  `updated` event to `status_changed` when the only change is a status flip, and stamping a `source`
  discriminator (`web` / `seeder` / `tinker` / `command` / `job`) plus the OS user and host so a change
  made from the CLI is attributable instead of showing a blank actor.
- **`LogAuthEvents`** — a listener recording `login`, `logout` and **`failed_login`** with IP and
  user-agent.

Its table is `activity_log`: `log_name`, `description`, `subject_type`/`subject_id`,
`causer_type`/`causer_id`, `properties` (json), `event`, `batch_uuid`, timestamps.

**Fix:** an `activity_log` table using those exact column names (the 2026-08-03 alignment decision), a
service that records a diff, and calls on the role-grant, status-change, delete and auth paths.
Structured logging (PM-10) is *not* a substitute: those lines go to stdout, are not queryable, and are
lost on `docker compose down`.

---

### PM-33 — No security response headers ⚠️ BACKEND DONE, FRONTEND PENDING

**Backend resolved 2026-08-03** in `backend/app/core/headers.py`, registered in `main.py`. **The
frontend half is not done** — `frontend/next.config.mjs` is a protected file and needs the owner's
confirmation before editing.

Sent on every response, verified including on a `429`:
`X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
`X-Frame-Options: SAMEORIGIN`, `Content-Security-Policy: frame-ancestors 'self'`, and a
`Permissions-Policy`. HSTS is gated on `HSTS_ENABLED` (default off) and verified to appear as
`max-age=31536000; includeSubDomains` when switched on and to be absent otherwise.

**Two deliberate divergences from LeapDesk's middleware:**

1. **`X-XSS-Protection` is not set.** It controlled an auditor every current browser has removed —
   Chrome dropped it in 2019 — and it could itself be abused to selectively block scripts. LeapDesk
   sets it; copying a dead header for symmetry would be cargo-culting.
2. **HSTS is not tied to `COOKIE_SECURE`.** They answer different questions: whether cookies require
   TLS, versus whether every browser that has seen this host should refuse plain HTTP to it for a year.
   Enabling HSTS against a host without a valid certificate is not a warning, it is an outage no
   server-side change can clear. `HSTS_PRELOAD` is separate again, because preloading is effectively
   irreversible.

**Still open:** the Next.js app is a separate origin serving the actual HTML, so a header on the API
does nothing for a page the API did not serve. `next.config.mjs` already has a `headers()` block and
needs the same set added there — that is where framing and sniffing protections actually matter.

Original entry follows.

**Where:** `backend/app/main.py` — no header middleware

The API sends none of the standard hardening headers. LeapDesk registers a `SecurityHeaders` middleware
globally that sets `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`,
`X-XSS-Protection: 1; mode=block`, `Referrer-Policy: strict-origin-when-cross-origin`,
`Permissions-Policy` disabling camera/microphone/geolocation/payment, and HSTS in production only.

Worth being precise about what this does and does not buy, because these headers are often
cargo-culted: the API returns JSON, so `X-Frame-Options` and `X-XSS-Protection` matter far less here
than on LeapDesk's HTML responses — the ones that genuinely count for this service are `nosniff`,
`Referrer-Policy` (so a URL with a token in it is not leaked in a `Referer`), and **HSTS**, which is
what stops a downgrade attack from ever seeing the auth cookie. The frontend is a separate Next.js app
and needs its own headers via `next.config.mjs`; a header on the API does not protect a page the API
did not serve.

**Fix:** a small middleware mirroring LeapDesk's, HSTS gated on an environment flag rather than on
`COOKIE_SECURE`, plus the equivalent `headers()` block in `next.config.mjs`.

---

## Suggested Order of Work

The 2026-07-31 auth/RBAC rebuild closed the four original blockers except PM-2 and PM-4. What is left,
in order:

1. ~~**PM-29** (ESLint)~~ — ✅ done 2026-08-03; linting runs now
2. ~~**PM-2** (`secure` cookies)~~ — ✅ done 2026-08-03; the clearing half was still open
3. ~~**PM-4** (seed credentials)~~ — ✅ was already fixed in code; the docs were the live problem
4. ~~**PM-26** (rate limiting)~~ — ✅ done 2026-08-03; also closed PM-8 and fixed an
   `X-Forwarded-For` bypass that made the limiter useless
5. **PM-10** — logging ✅ done 2026-08-03; **monitoring and alerting still open**
6. **PM-5** (row-level scoping) — required before any partner-owned data exists; this is also
   Build Sequence step 2 in [`MARKETPLACE_DOMAIN_PLAN.md`](./MARKETPLACE_DOMAIN_PLAN.md)
7. ~~**PM-27** (email)~~ — ✅ done 2026-08-03; deliverability against a real provider still untested
8. **PM-28** (verify Google SSO end to end against a real OAuth client) — **needs credentials**
9. ~~**PM-19** (error boundaries)~~ — ✅ done 2026-08-03; **PM-30** (react-hooks findings) remains
10. **PM-25** (React/Next peer mismatch) — a framework-version decision; gates PM-30
11. **PM-11** (tests) — **deliberately last**, see below
12. Everything else as the surrounding code is worked on

> **Audit note, 2026-08-03.** Working this queue found that **PM-2 and PM-4 were already fixed in
> code** and only the register said otherwise, and that `DEPLOYMENT.md` § 0 still listed five resolved
> items as hard blockers. Closing an item and updating this file were separate acts, and the second
> kept not happening. Before starting any item here, verify it against the code first — the register
> is a map, not the territory.

### Why PM-11 is last, and what that costs

**Owner's decision, 2026-08-03:** tests are deferred to the end of the queue, because writing them is
slow and running them is slow, and that cost lands on every task in between.

This reverses the earlier recommendation, and the risk it was protecting against is real, so it is
recorded rather than quietly dropped:

- **Row-level scoping (PM-5) will ship without a regression net.** A scoping bug does not raise an
  error — it returns another partner's rows. Nothing in the current toolchain would notice.
- **`tsc --noEmit`, `npm run lint` and `next build` are the only automatic checks.** Linting works as
  of PM-29, but none of the three checks *behaviour* — they check types, style and that it compiles.
- **The verification that does exist is manual** — a shell script over the auth surface and a
  Chrome-DevTools-Protocol harness over the UI. Both must be re-run by hand and neither runs in CI.

**Mitigation while PM-11 waits:** every change to a scoping or permission path gets its verification
recorded in [`../DAILY_CHANGES.md`](../DAILY_CHANGES.md) — what was run, against which role, and what
it returned. That is not a substitute for a test suite; it is a paper trail so the eventual suite
knows what it must reproduce.

## Related Documentation

- [`../core/AUTHENTICATION.md`](../core/AUTHENTICATION.md) — PM-1, PM-2, PM-6 in depth
- [`../core/AUTHORIZATION.md`](../core/AUTHORIZATION.md) — PM-3, PM-5, PM-7 in depth
- [`../system-design/DEPLOYMENT.md`](../system-design/DEPLOYMENT.md) § 0 — the deploy blocker list
- [`SCAFFOLD_CLEANUP_PLAN.md`](./SCAFFOLD_CLEANUP_PLAN.md) — retiring inherited code
- [`MARKETPLACE_DOMAIN_PLAN.md`](./MARKETPLACE_DOMAIN_PLAN.md) — what must exist regardless of domain
