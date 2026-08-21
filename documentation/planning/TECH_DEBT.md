# Technical Debt Register

> Defects and inconsistencies carried in from the inherited scaffold, ranked by severity.
> **Everything here is known.** Don't re-report an item as a new discovery; do reference its ID.
>
> Planning docs are reference only — verify against the code before acting.

> **⚠️ API paths in dated entries are as they were on that date.** All routes moved from
> `/api/…` to `/api/v1/…` on **2026-08-06** (PM-40). Resolved entries and every *Original entry follows* section say
> `/api/…` and have deliberately **not** been rewritten — this is a record of what was
> true when it was written, and editing it would make the log unreliable for exactly the
> question it exists to answer. For current paths, read the `core/` and `system-design/`
> docs, which were swept.

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
| [PM-5](#pm-5--row-level-scoping--resolved-2026-08-17) | ✅ | ~~No row-level scoping pattern exists~~ — `services/scoping.py`, wired | Authz |
| [PM-6](#pm-6--six-admin_users-columns-are-never-written--resolved) | ✅ | ~~Six `admin_users` columns are never written~~ | Data |
| [PM-7](#pm-7--three-auth-guards-are-defined-but-unused--resolved) | ✅ | ~~Three auth guards are defined but unused~~ | Authz |
| [PM-8](#pm-8--no-rate-limiting-and-no-lockout--partially-resolved) | ✅ | ~~No rate limiting and no lockout~~ — both now exist (PM-26) | Auth |
| [PM-9](#pm-9--cors-origins-hardcoded-to-localhost--resolved) | ✅ | ~~CORS origins hardcoded to localhost~~ | Infra |
| [PM-10](#pm-10--no-error-logging-or-monitoring--logging-done-monitoring-still-open) | 🟡 | ~~No error logging~~; **no monitoring or alerting** | Infra |
| [PM-11](#pm-11--test-coverage--floor-laid-coverage-still-open) | ⏳ | ~~No automated tests~~ — 765 tests + CI; **coverage** still open | Quality |
| [PM-12](#pm-12--root-readmemd-is-wrong-in-twelve-places--resolved) | ✅ | ~~Root `README.md` is wrong in twelve places~~ | Docs |
| [PM-13](#pm-13--token-decoding-duplicated-in-routers--resolved) | ✅ | ~~Token decoding duplicated in routers~~ | Auth |
| [PM-14](#pm-14--inconsistent-password-validation-rules--resolved) | ✅ | ~~Inconsistent password validation rules~~ | Schemas |
| [PM-15](#pm-15--patch-endpoints-require-every-field--resolved) | ✅ | ~~`PATCH` endpoints require every field~~ | API |
| [PM-16](#pm-16--no-change-password-endpoint--resolved) | ✅ | ~~No change-password endpoint~~ | Auth |
| [PM-17](#pm-17--emails-are-not-normalised--resolved) | ✅ | ~~Emails are not normalised~~ | Data |
| [PM-18](#pm-18--health-check-doesnt-check-the-database--resolved) | ✅ | ~~Health check doesn't check the database~~ | Infra |
| [PM-19](#pm-19--no-error-boundaries-or-route-suspense--resolved) | ✅ | ~~No error boundaries or route suspense~~ | Frontend |
| [PM-20](#pm-20--brand-colour-hardcoded-in-components--re-scoped) | ✅ | ~~Brand colour hardcoded in 242 places across 37 files~~ — all migrated to tokens 2026-08-05 | UI |
| [PM-21](#pm-21--stale-product-naming-throughout--mostly-resolved) | ✅ | ~~Stale product naming throughout~~ (2 items deferred) | Housekeeping |
| [PM-22](#pm-22--unused-tailwind-v4-dependency) | ✅ | ~~Unused Tailwind v4 dependency~~ — **removed 2026-08-21** | Frontend |
| [PM-23](#pm-23--two-dead-virtualenvs-in-the-tree) | ✅ | ~~Two dead virtualenvs~~ — **already gone; item was stale**, verified 2026-08-21 | Housekeeping |
| [PM-24](#pm-24--production-build-failed-on-a-type-error--resolved) | ✅ | ~~Production build failed on a type error~~ | Build |
| [PM-25](#pm-25--npm-ci-fails-react-19-against-next-14s-peer-range--resolved) | ✅ | ~~`npm ci` fails — React 19 against Next 14's peer range~~ | Build |
| [PM-26](#pm-26--no-http-rate-limiting-successor-to-pm-8--resolved) | ✅ | ~~No HTTP rate limiting~~ | Auth |
| [PM-27](#pm-27--no-email-transport-so-invitations-and-resets-are-manual--resolved) | ✅ | ~~No email transport — invitations/resets are manual~~ | Infra |
| [PM-28](#pm-28--google-sso-is-unverified-against-real-google) | 🟠 | Google SSO implemented but never run against Google | Auth |
| [PM-29](#pm-29--eslint-cannot-run-v6-resolves-against-a-v9-flat-config--resolved) | ✅ | ~~ESLint cannot run — v6 binary vs v9 flat config~~ | Quality |
| [PM-30](#pm-30--17-react-hooks-errors-from-rules-that-arrive-with-the-wrong-config-version) | ✅ | **Closed 2026-08-12 — count is 0**, and `continue-on-error` is gone from CI | Quality |
| [PM-31](#pm-31--refresh-reissues-rather-than-rotates-no-token-reuse-detection--resolved) | ✅ | ~~`/refresh` reissues rather than rotates~~ | Auth |
| [PM-32](#pm-32--no-audit-log-leapdesk-has-one--recording-done-read-surface-pending) | ✅ | ~~No audit log~~ | Quality |
| [PM-33](#pm-33--no-security-response-headers--backend-done-frontend-pending) | ✅ | ~~No security response headers~~ | Infra |
| [PM-34](#pm-34--no-two-factor-auth-fortify-parity--resolved) | ✅ | ~~No two-factor auth (Fortify parity)~~ | Auth |
| [PM-35](#pm-35--email-verification-is-not-enforced-anywhere--resolved) | ✅ | ~~Email verification not enforced~~ | Auth |
| [PM-36](#pm-36--every-emailed-link-landed-on-a-404--resolved) | ✅ | ~~Every emailed link landed on a 404~~ | Frontend |

### PM-37 onwards live in a separate file

**Added 2026-08-06.** A code-first audit of the *platform layer* — as opposed to the auth features this
register grew up around — found eight items. They are tracked in
[`CORE_HARDENING_PLAN.md`](./CORE_HARDENING_PLAN.md) rather than here, because they share a cause and
an ordering that only reads correctly together.

| ID | Sev | Title | Status |
|----|:---:|-------|--------|
| PM-37 | 🔴 | No environment concept — every deployment-safety rule unenforced | ✅ closed 2026-08-06 |
| PM-38 | 🟠 | No transaction boundary: 49 commits, a session that never rolls back | ✅ closed 2026-08-06 |
| PM-39 | ✅ | ~~Nothing mechanical verifies anything~~ — **1003 tests, CI green both jobs, 68-screen browser pass** | closed 2026-08-21 |
| PM-40 | 🟠 | ~~56 routes are unversioned~~ — `API_PREFIX = "/api/v1"` | ✅ closed 2026-08-06 |
| PM-41 | ✅ | ~~The frontend has no data layer~~ — **the fetch-on-mount sweep finished 2026-08-21**: every screen reads through the cache, one documented exception | Frontend |
| PM-42 | 🟡 | ~~The API contract is hand-copied into TypeScript~~ — generated + drift-asserted | ✅ closed 2026-08-06 |
| PM-43 | 🟡 | ~~Two purge functions exist and nothing runs them~~ — `worker.py` + `db/maintenance.py` | ✅ closed 2026-08-06 |
| PM-44 | 🟡 | Three pieces of state live in process memory | Open — deferred to the production topology |
| PM-45 | 🟡 | Model/database drift — `--autogenerate` proposed 80 unrelated operations | ✅ **closed 2026-08-18** — drift is 0; a generated migration is now empty |
| [PM-46](#pm-46--the-partner-write-surface-is-not-tenancy-scoped) | ✅ | ~~The id-taking partner writes apply no tenancy narrowing~~ — **RESOLVED 2026-08-21**, all five now call `assert_within_tenant` | Security |
| [PM-47](#pm-47--the-enquiry-state-machine-is-half-built-and-the-trust-metric-pays-for-it) | 🟠 | No `SPAM` state, so junk enquiries count against a partner's response rate for ever | ✅ **RESOLVED 2026-08-21** — enum, transition table, spam excluded from the metric, and the UI half |
| [PM-48](#pm-48--the-moderation-queue-returned-a-500-for-every-non-empty-queue) | 🔴 | `GET /moderation/queue` 500'd whenever anything was waiting — required non-column fields were assigned *after* validation | ✅ **found and RESOLVED 2026-08-21**; the empty-queue early return hid it, and the browser pass agreed |
| [PM-49](#pm-49--the-partner-dashboard-was-unreachable-for-everybody) | 🔴 | `organisation_id` was declared on the identity response with a default and never put in the payload, so it was `null` for everyone — and the partner dashboard keys off it alone | ✅ **found and RESOLVED 2026-08-21** by reading a screenshot, not a log |
| [PM-50](#pm-50--ci-had-been-red-for-environmental-reasons-so-nobody-read-it) | 🟠 | CI migrated and seeded nothing, so 5 tests failed environmentally and 86 more skipped; the frontend build needed an API it had no way to reach | ✅ **RESOLVED 2026-08-21** — 912 passed/91 skipped/5 failed becomes 995 passed/13 skipped/0 failed |

> **This table was wrong for eleven days and that is worth a line.** PM-40, PM-42 and PM-43 were
> closed in `CORE_HARDENING_PLAN.md` on 2026-08-06 and still read "Open" here on 2026-08-17, found by
> checking each against the code rather than trusting either document. A register that overstates
> what is broken gets re-litigated by the next reader; one that overstates what is fixed is worse.
> **Both files are updated together or neither is trustworthy.**

**Two of those change how items already in this register should be read:**

- **PM-41 is PM-30's cause.** The 20 react-hooks errors are not a lint problem and not only a
  consequence of PM-25. Every one is the fetch-on-mount pattern, which is what a codebase does when it
  has no data-fetching layer — so the count rises with every new client component regardless of which
  way the React/Next version decision goes.
- **PM-39 partially discharges PM-11.** 74 tests and a CI workflow now exist. PM-11 stays open: this is
  a floor over three properties, not coverage, and it does not touch RBAC enforcement across the 56
  routes — which is the suite **PM-5** will need before it can be trusted.

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

### PM-5 — Row-level scoping ✅ RESOLVED 2026-08-17

**The original entry pointed at `backend/app/api/candidate.py` and `backend/app/api/category.py`.
Both files were part of the deleted scaffold and have not existed for weeks** — a reminder that a
"where" line is the first part of an entry to rot. What follows is the current state, checked against
code.

**`app/services/scoping.py` is the pattern**, written 2026-08-17 with three rules it enforces by
construction rather than by convention: anonymous is the most restrictive branch (a model must *opt
in* to being publicly readable, and an unregistered model raises rather than returning every row);
every refusal is **404, never 403**, because a 403 confirms the row exists; and the filter reaches
SQL, so the count matches the page.

**Closed in two passes.** The first landed the module and the partner directory's two call sites. The
second (`BACKEND_CORE_PUNCHLIST.md` T1–T5) closed what that left, and every item below was a real
hole rather than tidying:

| Gap | What it allowed |
|---|---|
| `users` and `user_invitations` carried `organisation_id` and were unregistered | the central rule governed neither |
| **no visibility check on any user write path** | an actor who could not *see* a row could `PATCH` it by id, change the `email` (not admin-gated) and drive a password reset — escalation from a custom role holding `user-update` |
| bulk paths loaded targets with their own query | the same hole with an `s`, plus writes to already-binned rows |
| grants never consulted the organisation | one admin-written cross-organisation grant produced a genuine cross-tenant read |
| `manage` and `view` grants were indistinguishable on writes | `can_manage_data_of` and `manageable_user_ids` had no call site, so a manage grant changed nothing |
| `list_grants` was unscoped | Staff holds `data-access-view`, so the whole delegation graph was readable |

Enforced by `tests/test_scoping.py` (the rule, plus a guard that asks the mapper registry which tables
carry `organisation_id` and requires each to be registered) and `tests/test_visibility_paths.py` (the
routes and services, written attacker-first and confirmed to fail against the pre-fix code).

**Still deliberately open:** `narrow_to_creators` has no call site. Nothing in this codebase has
creator-owned rows governed by delegation — the tables carrying `created_by` are administrative
objects governed by permissions — so wiring it anywhere today would be inventing a policy rather than
enforcing one. See [`MARKETPLACE_DOMAIN_PLAN.md`](./MARKETPLACE_DOMAIN_PLAN.md) § Required Regardless
for where it becomes real.

**2026-08-13, from the § 8.2 data-visibility sweep — two PM-5-adjacent facts, recorded so they are
decisions rather than surprises:**

- **The Data Access grant-scope helpers are built, tested, and wired to nothing.**
  `manageable_user_ids`, `can_manage_data_of` and `narrow_to_creators` in `data_access_service.py`
  have zero production call sites — the grants admins create today change what `accessible_user_ids`
  answers, but no list endpoint asks it yet. That is PM-5's other half: the seam exists at
  `get_or_404` and the helpers exist here, and the wiring between them is the actual work. Until
  then a data-access grant affects Global Search results and nothing else.
- **`list_grants` shows the whole delegation graph to any `data-access-view` holder — and Staff
  holds it.** Faithful to the reference, and defensible only while the permission is narrowly held,
  which ours is not. Scoping it is a visible behaviour change and therefore the owner's call —
  flagged in `DAILY_CHANGES.md` 2026-08-13 (the service docstring had claimed this flag existed
  since the module shipped; it hadn't, which the sweep also caught).

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

### PM-11 — Test coverage ⏳ FLOOR LAID, COVERAGE STILL OPEN

**The original text — "no test suite, no test runner configured, no CI" — has been wrong since
2026-08-06.** As of 2026-08-17 there are **765 tests across 31 files** and a CI workflow
(`.github/workflows/ci.yml`) that blocks on the same gate as local work. PM-39 laid that floor.

What stays open is the distinction PM-39 was careful about: **a floor is not coverage.** The suites
that exist are deep where a mistake is a breach — scoping, tenancy, RBAC hierarchy, token types,
session lifetime, retention — and thin everywhere else. The specific gap worth naming:

- **Permission enforcement is not asserted route by route.** `test_route_enforcement.py` proves a
  stranger is refused and that the schema matches the models; nothing asserts *which* permission each
  route requires, so a new route shipped without a guard passes CI. Being closed by
  `BACKEND_CORE_PUNCHLIST.md` T7.
- **No frontend tests at all.** Type checking and lint are the only automated gate there.

---

### PM-25 — `npm ci` fails: React 19 against Next 14's peer range ✅ RESOLVED

**Resolved 2026-08-07 by downgrading React to 18.3.1** — the second option below. Forced rather than
chosen: the "unsupported but works" pairing **stopped working**, and it took the whole dashboard with it.

**How it surfaced.** Signing in appeared to fail. The console showed
`TypeError: Cannot read properties of undefined (reading 'call')` at webpack's `options.factory`, thrown
from a `<Lazy>` inside Next's own `layout-router`, crashing `NotFoundErrorBoundary`. The application
contains **no** `next/dynamic` or `React.lazy` call — that `<Lazy>` is framework-internal, so this was the
App Router's client runtime failing against a React it does not support. `npm ls` agreed:
`react@19.2.4 invalid: "^18.2.0" from node_modules/next`, exit code `ELSPROBLEMS`.

**Downgrading was the minimal fix, not the ambitious one.** Next 15 would have made React 19 supported,
but it is a major-version migration with its own breaking changes (async `cookies()`/`headers()`/`params`,
changed caching defaults) — not something to do inside a bug fix while sign-in is broken. React 18.3.1
matches Next 14's declared peer range exactly and restores a combination the framework actually tests.

**It cost no code changes.** The app uses no React 19-only API — no `useActionState`, `useFormStatus`,
`useOptimistic` or `use()`. `forwardRef` is used in three components and behaves identically on 18.
`@types/react` and `@types/react-dom` moved to `^18` to match the runtime.

**Verified:** `npm ls` clean (0 invalid peers) · **the dependency tree now resolves with no
`--legacy-peer-deps` at all** · `tsc --noEmit` clean · `next build` compiles all 20 routes · `npm run
lint` 17 errors, unchanged · `/sign-in` and `/dashboard` both 200 on a from-scratch build.

**Docs corrected in the same change:** `NEXTJS_STANDARDS.md` (title, § 1 stack line, known-issues row,
pending list), `ONBOARDING.md` § 6 and § 9, `ARCHITECTURE.md`, `VERSION_SUMMARY.md`,
`CORE_HARDENING_PLAN.md`.

**Still to follow up:** `frontend/Dockerfile.dev` and `.github/workflows/ci.yml` still pass
`--legacy-peer-deps`. It is now harmless rather than load-bearing, so removing it is housekeeping — but
worth doing, because a flag that silences nothing today will silence the next real `ERESOLVE`.

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

### PM-13 — Token decoding duplicated in routers ✅ RESOLVED

**Resolved 2026-08-03**, and it had grown since it was written. The two sites named below no longer exist
— `whoami()` was removed in the account merge — but the *pattern* had spread to **five**:

| Site | Token type |
|---|---|
| `dependencies._decode_access_token` | `access` |
| `auth.refresh` | `refresh` |
| `auth.two_factor_challenge` | `two_factor` |
| `auth_service.complete_email_verification` | `email_verification` |
| `google_service._verify_state` | `oauth_state` |

Each independently decoded, asserted `type`, pulled its claims and caught `(JWTError, KeyError)`.

**Why that mattered more than the duplication.** The `type` assertion is the *only* thing keeping the
token kinds from being interchangeable — it is what stops a seven-day refresh token being replayed as an
hour-long access token, and a 2FA challenge token being used as a session. Five copies meant five chances
for a sixth token type to be added without it, and the failure would be silent: everything would work, and
one kind of token would quietly be accepted where another belonged.

**Fix:** `security.decode_typed_token(token, expected_type, require=(...))` — one decoder that asserts the
type, asserts the named claims, and raises a single `TokenError` for every failure mode. Callers no longer
know that `jose` raises `JWTError` or that a missing claim raises `KeyError`. `TokenError` deliberately
does not distinguish expired from wrong-type from bad-signature: the caller turns it into a 401 or 400, and
telling a client which part of a forgery to change next is not useful to anyone but the forger.

`decode_token` remains for the one case that genuinely wants an unchecked payload, with a docstring
pointing at the typed version.

**Verified 2026-08-03**, all five paths after the refactor: login and `/me` `200`; **a refresh token used as
an access token `401` and an access token used as a refresh token `401`**; refresh still rotates; logout
`200` and still `200` when handed deliberate garbage in both cookies (it must never fail); email
verification `200`, and an access token presented to `/verify-email` rejected with `400` as the wrong type.

Original entry follows.

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

### PM-20 — Brand colour hardcoded in components ✅ RESOLVED

**Resolved 2026-08-05.** All 242 occurrences across 37 files migrated to the Viho token layer in
three sweeps. `grep -rn 'F97316\|EA6C0A\|orange-[0-9]' app components` returns nothing, and the same
sweep also eliminated every `blue-*`/`purple-*`/`amber-*`/`emerald-*` pastel. Keep that grep as the
regression guard.

The original entry, and the undercount that made it interesting, are kept below.

#### Original entry (re-scoped 2026-08-05)

**Raised from ⚪ Low to 🟡 Medium on 2026-08-05.** Two things changed: the original entry undercounted
the problem by an order of magnitude, and the owner's adoption of the Viho theme turned it from a
tidy-up into the **blocker in front of the rebrand**.

**The original entry said** `components/common/Button.tsx` and `Input.tsx` write `#F97316` inline
despite `brand` existing in `tailwind.config.ts`. Measured against commit `b144c24`:

```bash
grep -ro 'F97316\|EA6C0A'       app components   # 151 occurrences, 37 files
grep -ro 'orange-[0-9]\{2,3\}'  app components   #  91 occurrences, 18 files
                                         union   # 242 occurrences, 37 files
```

**37 of the frontend's 85 `.tsx` files — 44%.** Only 6 files use the `brand` token at all. This is the
same undercount pattern as PM-21, which found 18 occurrences across 14 files where 6 were first listed.

Two reasons the first count missed so much:

1. **`orange-*` Tailwind utilities are brand colour, and a hex grep never sees them.** `bg-orange-50`,
   `dark:bg-orange-950/40`, `hover:text-orange-400` — 91 of the 242.
2. **Nine distinct orange shades are in use** (`orange-50` ×27, `950` ×26, `400` ×23, `600` ×6,
   `500` ×4, `700` ×2, one each of `100/200/900`) where the token defines two. A find-and-replace onto
   `brand` will not work; the token layer needs a tint ladder first.

| Occurrences | File |
|------------:|------|
| 46 | `components/dashboard/Sidebar.tsx` |
| 22 | `components/admin/Candidate.tsx` |
| 15 | `components/admin/AddCategoryForm.tsx` |
| 14 | `components/admin/AddQuestionForm.tsx` |
| 12 | `components/admin/SelectQuestionType.tsx`, `components/admin/ProfileForm.tsx`, `app/not-found.tsx` |

**The mitigation is sequencing, not effort.** Migrate every call site to tokens *while still orange*
(no visual change, verifiable by grep), then flip the values in one revertible commit. Phases 1–3 of
[`../design/VIHO_ADOPTION_PLAN.md`](../design/VIHO_ADOPTION_PLAN.md).

**And 85 of the 242 — 35% — sit in 8 inherited screens that
[`SCAFFOLD_CLEANUP_PLAN.md`](./SCAFFOLD_CLEANUP_PLAN.md) already schedules for deletion.** Retiring
those first removes a third of this debt at no migration cost. That ordering is the single cheapest
thing available here, and it is easy to miss.

---

## ⚪ Low

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

**✅ Resolved 2026-08-21.** Removed from `package.json` and the lockfile recomputed with
`npm install --package-lock-only` — 659 lines out, and `grep` finds no remaining reference. Verified
the stylesheet still builds by fetching it from the running dev server: `/sign-in` 200, and the
emitted `_next/static/css` asset 200 at 129 KB. The v3→v4 warning above still stands for anyone
tempted to re-add it.

---

### PM-23 — Two dead virtualenvs in the tree

Root `.venv/` is a Windows/`uv` venv (unusable on Linux); `backend/.venv/` is a Linux venv whose
interpreter no longer matches its packages. Both gitignored, both ~93 MB. `../ONBOARDING.md` § 2 tells
newcomers to delete them.

**✅ Closed 2026-08-21 — nothing to do; the item was stale.** Neither directory exists: `ls` finds no
`.venv` at the root and none under `backend/`, and `git check-ignore` reports nothing for either path.
They were removed at some point without this register being updated, which is the failure mode the
note at the top of this file already warns about — *"a register that overstates what is broken gets
re-litigated by the next reader"*. Checked before writing rather than assumed.

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

> **✅ CLOSED 2026-08-12. The count is zero and lint now blocks CI.**
>
> The register said PM-41's data layer would retire this "by construction", and `PLANNING.md` § 3.2
> asked for a decision rather than drift. PM-41 has not started; 19 errors behind
> `continue-on-error` is a CI step nobody reads. So they were fixed by hand.
>
> Almost all of them were one shape — a `setState` run synchronously inside an effect body — and
> four remedies covered every case:
>
> | Remedy | Where |
> |---|---|
> | Hand the function to a callback instead of calling it: `void Promise.resolve().then(load)` | 12 modules, and `useResourceList`, which every index uses |
> | Derive the value rather than store it | `AuthInitializer`'s `checked` |
> | `useHydrated()` — a `useSyncExternalStore` that answers "has hydration happened" in the first render | `Modal`, `Toast`, `RowActions`, `DashboardOverview` |
> | Declare the callback above the effect that uses it | `Sidebar`, which also fixed its "Compilation Skipped" |
>
> **Verified by the browser harness afterwards**, not just by the linter: `useResourceList` is the
> fetch hook behind twelve screens, and a change there that satisfied a rule while breaking a page
> would have been the worst possible outcome.

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
| **18** | `react-hooks/set-state-in-effect` |
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

#### The count grows with every new client component, and that is the argument for settling PM-25

**2026-08-03, later still:** 19 → **20**. `ActiveSessions.tsx`, again fetch-on-mount. Four of the last
five components added today have contributed one each, which is the pattern rather than a coincidence.

**2026-08-03, later:** 18 → **19**. `ActivityModule.tsx` adds one, again a fetch-on-mount. A second new
error in that file **was** removed rather than absorbed: it reset the page number from an effect reacting to
a filter change, which is a genuine synchronous setState-in-effect and reads backwards. Resetting the page
inside the filter setters is both what the rule wants and the clearer expression of "changing a filter
means starting at page 1". The remaining one is the same false positive as below.

**2026-08-03:** 17 → **18**. `components/auth/TwoFactorSettings.tsx` fetches its status on mount, which
is the ordinary shape of a client component that reads an API, and the rule flags it. An attempt to
satisfy it honestly — threading a cancellation flag so the effect cannot write state after unmount —
**did not clear the error**, because the rule flags any call in an effect body that transitively sets
state and cannot see that `load` awaits first. The cancellation flag was kept anyway, since it fixes a
real setState-after-unmount in a component that lives inside a closable modal.

This is the cost of leaving PM-25 open: it is not a static list of 17 legacy problems, it is a tax on
every new component. The alternative would be a `// eslint-disable` comment per component, which trades
a visible count for an invisible one — worse, because the disables would survive the config decision
that makes them unnecessary.

---

### PM-31 — `/refresh` reissues rather than rotates: no token reuse detection ✅ RESOLVED

**Resolved 2026-08-03.** Migration `d4a71f6c8e93` adds three columns to `user_sessions`
(`refresh_token_jti`, `previous_refresh_jti`, `refresh_rotated_at`); refresh tokens now carry a `jti`, and
`session_service.classify_refresh_jti` decides what a presented one means.

| Presented `jti` | Outcome |
|---|---|
| Matches `refresh_token_jti` | **Current** — rotate and issue a new pair |
| Matches `previous_refresh_jti` within the grace window | **Grace** — hand back the current token, do **not** rotate again |
| Anything else | **Reuse** — revoke the whole session (`reuse_detected`) |
| No `jti`, or the session has none | **Unknown** — refuse |

**Reuse revokes the session rather than merely refusing the request**, and that is the point. If a
superseded token is being presented, either the client replayed it or somebody else holds it. Letting the
*current* token carry on would leave the attacker one rotation behind rather than locked out.

#### The grace window, and why strict rotation alone is a trap

Strict rotation plus reuse detection has a well-known failure mode: two browser tabs refreshing at the
same instant. The second presents a token that was valid microseconds earlier, is judged a replay, and the
session dies — **signing out a legitimate user for having two tabs open**. A 30-second window
(`REFRESH_ROTATION_GRACE_SECONDS`) honours the immediately-previous token *without rotating again*, so
concurrent requests converge on one token instead of each invalidating the others. An attacker gains only
those seconds, on a token they would already have to hold.

#### No backfill, deliberately

Pre-rotation sessions have a NULL `jti` and are refused. Accepting one "until the first rotation" would
leave a window in which a pre-rotation stolen token still works, which is exactly the hole being closed.
Those users sign in again — the same fail-closed choice made for `sid`, for the same reason.

#### Verified 2026-08-03

Refresh with the current token returned `200` and **the token changed**; the new one worked; replaying the
original after the grace window returned `401`; **and then the good token also returned `401` and `/me`
returned `401`** — the session really was revoked, with `revoked_reason = reuse_detected` and an
`refresh_token_reuse_detected` audit row naming the account. Separately, two back-to-back refreshes with
the same token both returned `200` and the session stayed alive, with no second rotation.

Original entry follows.

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

### PM-32 — No audit log; LeapDesk has one ✅ RESOLVED

**Fully resolved 2026-08-03.** Recording in `app/services/activity_service.py`; reading via
`GET /api/activity` gated on a new **`activity-view`** permission, with an Activity Log index at
`/dashboard/activity` matching LeapDesk's.

The full coverage list — every wired event and where it fires — lives in
[`../core/AUTHORIZATION.md`](../core/AUTHORIZATION.md) § Audit Trail Coverage, so a reviewer can check it
against the routes. That matters because recording is explicit rather than a global hook, and explicit
calls can be forgotten.

**Read-only structurally, not by policy.** No create, update or delete route exists and no service
function sits behind one; every write verb returns `405` (verified). An audit trail a privileged user can
edit is not evidence of anything, so tampering is prevented by the absence of a code path rather than by a
permission someone could later widen without knowing why it was narrow.

**Not scoped by actor** — `activity-view` is the whole authorisation, because a partial view of an audit
trail is worse than none when someone is reviewing an incident. **This is the first query to revisit when
partner scoping lands (PM-5)**: a partner must never read another partner's history.

`activity-view` went to Admin and above, **not** to Staff, which is a read-across-modules role — the trail
carries failed-login attempts with addresses and IPs for every account. Note that adding it to the catalog
granted it to every Admin automatically via the `"*"` wildcard, which is the documented consequence of the
choice made earlier that day.

Sorted by `id` rather than `created_at`: rows written in one transaction share a timestamp, and an unstable
sort lets a row appear on two consecutive pages or on neither.

**Verified 2026-08-03:** 42 entries paginated across 11 pages with actor names resolved in one query per
page; 15 event names discovered from the data for the filter; filters correct (`log_name=auth` → 34,
`event=failed_login` → 5, `search=granted` → 2); `POST`/`PUT`/`PATCH`/`DELETE` all `405`; `activity-view`
absent from the Partner role and present for Admin.

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

#### Export and retention (added 2026-08-03)

`GET /api/activity/export` streams the trail as CSV, gated on the same `activity-view` permission.
**Streamed, not assembled in memory:** this is the one read with no upper bound — "everything, for the
audit" is the point of it — so materialising a year of rows would be the request that exhausts the
process. Oldest-first, unlike the paginated view, because a file is read top to bottom as a chronology
where a screen is read newest-first. `properties` goes into one column as compact JSON: the shape differs
per event so it cannot be flattened, and truncating it would silently drop the before/after diff that
makes an export worth having. The filename carries a UTC timestamp, or the second export overwrites the
first in a downloads folder and two audits get confused.

`activity_service.purge_older_than(days)` exists and **nothing calls it on a schedule**, deliberately.
There is no scheduler, and more importantly *how long who-did-what is kept* is a policy decision — legal,
contractual, or simply how far back you want to be able to answer questions.
`ACTIVITY_LOG_RETENTION_DAYS` (default 730) is a default for whoever runs it, not an active policy.

Two guards, because this function deletes evidence: a non-positive `days` raises rather than being read as
"everything", so a stray `0` in a config file cannot destroy the trail; and a value too large for
`datetime` returns 0 instead of crashing — found by passing `999999` while testing the first guard, which
raised `OverflowError` from `timedelta`. The purge records itself in the trail it truncated, so the gap is
explained rather than looking like data loss.

**Still open:** the export has no UI button — it is an API call today.

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

### PM-33 — No security response headers ✅ RESOLVED

**Fully resolved 2026-08-03.** Backend in `backend/app/core/headers.py`, registered in `main.py`;
frontend in `next.config.mjs`'s `headers()` block, verified present on `/sign-in`.

The frontend set omits HSTS deliberately: it belongs on the TLS terminator, which does not exist yet,
and emitting it from a dev server reachable over plain HTTP would pin `localhost` to HTTPS in every
developer's browser for a year with no server-side way to undo it.

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

Both halves were needed because the Next.js app is a separate origin serving the actual HTML: a header
on the API does nothing for a page the API did not serve, and framing and sniffing protections matter
far more on the HTML than on a JSON response.

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

### PM-34 — No two-factor auth (Fortify parity) ✅ RESOLVED

**Resolved 2026-08-03.** `app/services/two_factor_service.py`, `app/core/encryption.py`, five endpoints,
migration `c8f42e7b91d5`. Full design and the verified lifecycle are in
[`../core/AUTHENTICATION.md`](../core/AUTHENTICATION.md) § Two-Factor Authentication.

**Ecosystem answer first, since it was the question:** there is **no Fortify for FastAPI**.
`fastapi-users` is the nearest analogue — registration, login, password reset, email verification,
OAuth — but it has **no 2FA at all**, and adopting it means it owns the user model and replaces an auth
layer that was just audited. Rejected. One new dependency instead: `pyotp`. Encryption reuses Fernet
from `cryptography`, already installed as a `python-jose` extra, and no QR library was needed because
the API returns the `otpauth://` URI for the frontend to render.

Columns use Fortify's exact names — `two_factor_secret`, `two_factor_recovery_codes`,
`two_factor_confirmed_at` — plus `user_sessions.password_confirmed_at` for the `confirmPassword` gate.

**Also closes the gap nobody lists:** password confirmation. `confirmPassword => true` implies Laravel's
`password.confirm` middleware, which guards enabling and **disabling** 2FA. Without it, someone holding
a stolen session could quietly remove the second factor protecting the account.

**Found while wiring it:** `POST /api/auth/accept-invitation` still called `set_auth_cookies` with the
pre-sessions two-argument signature and would have raised on the first invitation accepted. Caught by
reading the file, not by a test — PM-11 earning its severity.

**Admin reset added 2026-08-03:** `POST /api/users/{id}/reset-two-factor`. The support path for the case
recovery codes exist to cover and sometimes do not — a lost phone with every code spent. It clears the
enrolment **and revokes every session**, and that pairing is the point: if the phone was stolen rather
than lost, clearing only the secret would remove the second factor and leave the attacker signed in.
Gated on `user-update` plus the same protection rule as an edit, so a non-super-admin cannot strip a
super-admin's 2FA (verified `403`), refuses with `400` when there is nothing to reset rather than
no-oping, and is recorded with the actor.

**Still open for 2FA:** no frontend. The endpoints work and nothing in the UI reaches them, which is the
same state the RBAC API was in before 2026-07-31.

---

### PM-35 — Email verification is not enforced anywhere ✅ RESOLVED

**Resolved 2026-08-03.** Stateless signed tokens, two endpoints, and a gate at *approval* rather than at
login. This closes the last Fortify feature LeapDesk has and we did not — and it is built **enforced**,
which LeapDesk's is not.

#### Where the gate goes, which was the real design question

Registration already lands INACTIVE pending approval, so blocking the **user** on verification would add
a second gate telling them nothing new. Blocking the **approver** is different and useful: activating an
unverified account hands a live password-reset path to an address its owner may not control.

So `POST /api/users/{id}/approve` answers **409** when the address is unconfirmed, with
`?force_unverified=true` for an administrator who has confirmed identity out-of-band. The override is
recorded distinctly — `unverified_override: true` in `properties` and "(email NOT confirmed —
overridden)" in the description — so *who approved an unverified account* stays answerable.
`REQUIRE_VERIFIED_EMAIL_FOR_APPROVAL` can switch the requirement off wholesale.

#### Tokens are stateless and bound to the address

No columns, no cleanup, nothing to leak — the same approach Laravel takes with signed URLs. The token
carries `sub`, `email` and `type: "email_verification"`, and verification requires the claimed address to
**still match the row**. That gives a property a stored token would not: changing the address invalidates
every outstanding token for the old one, so a link mailed to a typo'd address cannot verify the corrected
one. **Verified:** after an admin changed the address, the outstanding token returned `400`.

Not single-use, deliberately — verifying twice is harmless, so a column and a write to prevent it would
buy nothing. **Verified:** the second click returns `200`.

24-hour TTL rather than the password reset's 1 hour. A reset link is a live credential and should be
short-lived; a verification link proves an address and grants nothing on its own, so the balance tips
towards the person who reads their email the next morning.

#### `/resend-verification` says nothing

Answers identically whether the address exists, is already verified, or the send failed — same reasoning
as `/forgot-password`. Distinguishing those cases would be an enumeration oracle, and would additionally
reveal which addresses are pending. Both endpoints are in the rate limiter's `sensitive` tier;
`resend-verification` especially, since it mails an address the caller names and would otherwise be a
free relay for mailbombing a third party.

#### Verified 2026-08-03

Register → link appeared in the log · approve before verifying → **409** with a message naming the
override · verify → `200` · verify again → `200` (idempotent) · approve → `200` · override path → `409`
then `200` with the audit row flagging it · address changed → outstanding token `400`. Both probe accounts
deleted afterwards.

Original entry follows.

**Where:** `users.email_verified_at` is written but never checked

The column is set for Google sign-ups and by an admin creating an account, and **nothing reads it**. A
partner who self-registers with a typo'd or someone else's address gets an account whose address was
never proven; the approval gate catches it only if a human notices.

**LeapDesk does not enforce it either, which is worth knowing before copying it.**
`config/fortify.php` enables `Features::emailVerification()`, but `app/Models/User.php` has
`// use Illuminate\Contracts\Auth\MustVerifyEmail;` **commented out** and the class does not implement
it. So the routes exist and the gate does not. Matching LeapDesk here would mean matching a half-wired
feature — build it enforced instead.

**Fix:** a `verify-email` token on the same pattern as the password reset (which already works), a
`mail_service` message, and a decision about *where* it gates. Registration already lands INACTIVE
pending approval, so the honest question is whether verification should be a precondition of approval
rather than a separate block — otherwise it adds a second gate that says nothing new.

---

### PM-36 — Every emailed link landed on a 404 ✅ RESOLVED

**Found and resolved 2026-08-03**, while adding the verification page. The backend's email-driven flows
all worked; **not one of them could be completed by a user**, because none of the landing pages existed.

| Link we mailed | Landed on |
|---|---|
| Password reset (`/reset-password?token=…`) | **404** |
| Invitation (`/accept-invitation?token=…`) | **404** |
| Email verification (`/verify-email?token=…`) | **404** — created by PM-35 an hour earlier |
| "Forgot password?" on the sign-in form | `href="#"`, and **suppressed** by `hideForgotPassword` |

The last row is the one worth dwelling on: the link was hidden *because* the page did not exist, so
nothing looked broken. A user locked out of their account had no route to a reset at all, and no error to
report. That is the failure mode where the UI's tidiness hides the gap.

Four pages now exist, on a shared `AuthCard` frame so they cannot drift apart in width, padding or dark
mode — they are the first thing a new user sees, often before they have an account.

Notable behaviour:

- **Verification verifies on mount**, not behind a button. The user expressed intent by clicking the link
  in their inbox; a second click confirming they meant it is friction for nothing. A `useRef` guard stops
  React strict mode's double-invoke from spending two of the endpoint's rate-limit allowance per load.
- **On a failed verification the page offers to resend**, because the common cause is an expired 24-hour
  link and a dead end there means the account can never be approved.
- **`/forgot-password` makes no claim about whether the address exists**, matching the endpoint. A
  distinguishable success screen would reinstate the enumeration oracle the API carefully avoids.
- **The invitation page previews before asking for anything** — the address, and the role. That is the
  invitee's only signal the link is genuine, and lets them catch a forwarded or wrong link before typing a
  password.
- **Reset tells the user every device has been signed out**, which is what the backend actually does, and
  sends them to sign in rather than pretending to log them in — there is deliberately no session to inherit.
- All three token pages set `robots: { index: false }`. The URLs contain live credentials.
- A `422` from Pydantic is a list of field errors, not a string. Both password forms unwrap it, because
  rendering the object prints `[object Object]` at the user.

**Verified 2026-08-03** by a full round trip: `forgot-password` → link captured from the log → the page
served `200` → reset succeeded → **the old password returned `401`** → the new one worked → original
restored. All four routes return `200` and render their own copy rather than a 404 page.

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
11. **PM-20** (brand colour in 242 places) — **re-scoped 2026-08-05**; it now gates the Viho rebrand
    the owner approved, so it moves ahead of "everything else". Do
    [`SCAFFOLD_CLEANUP_PLAN.md`](./SCAFFOLD_CLEANUP_PLAN.md)'s frontend deletions **first** — that
    retires 35% of it without migrating anything
12. **PM-11** (tests) — **deliberately last**, see below
13. Everything else as the surrounding code is worked on

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

---

## PM-45 — the drift `--autogenerate` proposes, and what is left of it

Found 2026-08-18 while adding the directory tables: `alembic revision --autogenerate`
proposed **80 operations against tables the change did not touch**, and four of
them dropped the unique constraints on `permissions`, `roles`,
`permission_groups` and `user_invitations` to recreate them as unique indexes.

**Uniqueness was never at risk** — `pg_constraint` showed the UNIQUE constraint
present on all four throughout, and a full-row clone is still rejected by
`permissions_name_key`, `roles_name_key` and `permission_groups_name_key` by
name. It was redundancy, not a hole: each column carried a unique constraint
*and* a separate plain index, so every insert and update paid for an index that
served no query the constraint's own index did not.

The risk was that a future migration would sweep it in. A change named after
something else would have dropped and recreated the constraints protecting the
RBAC tables as a side effect — which is exactly what nearly happened.

**Closed:** `index=True` removed from the four columns (`unique=True` already
provides an index), and migration `ae8cee95c547` drops the four orphaned
indexes. Drift went 80 → 74 and constraint operations 4 → **0**.

**Closed in three separate changes, one purpose each:**

| Change | What | Ops |
|---|---|---:|
| `ae8cee95c547` | Dropped four indexes redundant with a unique constraint | 4 |
| `0e6d123d0fa3` | Applied 116 model column comments to the database | 116 |
| *(models only, no DDL)* | Declared indexes the database already had | 8 |

**A generated migration is now empty — `pass` in both directions.**

### The third one is the finding worth keeping

`--autogenerate` wanted to **drop two indexes on `user_sessions`**:
`ix_user_sessions_refresh_token_jti` and `ix_user_sessions_user_id_revoked_at`.
Both were created deliberately, with reasons recorded in their own migrations —
the jti index because reuse detection looks that column up and it is highly
selective. They were simply absent from the model, so the tool proposed removing
them.

Taking that suggestion would have been a **silent performance regression dressed
up as tidying**, and it would have looked like drift cleanup in the diff.

The rule it produced, which is the transferable part:

> **When the model and the database disagree about an index the database is right
> about, correct the model.** Converging the other way deletes work somebody did
> on purpose, and `--autogenerate` cannot tell the difference.

The same reasoning settled the webhook index: the database's name was kept and
declared, rather than renaming a working index to match a generated default.

⚠️ **A generated migration being empty is the point of all this** — it means the
next real change produces a diff short enough to read, which is how four
constraint drops nearly rode into a migration named after something else.

## PM-46 — the partner write surface is not tenancy-scoped ✅ RESOLVED

**Found 2026-08-20**, by writing the HTTP-level wrong-tenant suite that
`CORE_EXTRACTION_PLAN.md` § 3.7 asked for. Severity 🟠 for the shape of the
defect, not for present exposure: **it is not exploitable in the shipped
configuration.**

### The asymmetry

Reads of a partner row are tenancy-scoped. Writes are not.

| Path | Guard | Narrows to the actor's tenant? |
|---|---|---|
| `get_partner_for` (read) | `scoping.assert_can_read` | **Yes** — 404 for another organisation |
| `can_edit` → `PATCH /partners/{id}` | `actor.has_permission(PARTNER_UPDATE)` | **No** |
| `can_delete` → `DELETE /partners/{id}` | permission + refuses the actor's **own** org | No |
| `can_change_status` → `POST /{id}/status` | permission + refuses own org | No |
| `can_verify` → `POST /{id}/verification` | permission + refuses own org | No |

The three `own org` checks are easy to misread as tenancy scoping. They are the
opposite: they stop **self**-approval — lifting your own suspension, verifying
yourself. None of them stops an actor acting on **someone else's** organisation.

`Partner` *is* registered for scoping (`scoping.register_scope(Partner,
owner_column=Partner.id, …)` in `partner_service`), and the read path honours
that registration. The write path never consults it.

### Why it is not exploitable today

`partner-update`, `partner-delete`, `partner-approve` and `partner-verify` are
reachable **only through the four wildcard roles** — Admin, BackendDeveloper,
RootUser, SuperAdmin — and no account holding any of them has an
`organisation_id` (verified against the database, 2026-08-20). For those roles,
"edit any partner" is the intended meaning of the permission; `api/partners.py`
says so where it explains why `/partners/me` uses `ORGANISATION_MANAGE` instead.

So the safety of the whole surface rests on a configuration fact that nothing
enforced.

### What was done

Not a behaviour change — narrowing an authorization rule is the owner's call, and
the same judgement was applied to `list_grants` on 2026-08-13 (flag, recommend,
then close on the owner's word). What landed instead:

* **`tests/test_partner_write_permissions.py`** turns the configuration fact into
  an enforced invariant. It fails if any of those four permissions is granted to
  a named (non-wildcard) role, with the reasoning in the failure message. It is a
  registry test, so it runs in CI without a seeded database.
* **`TestTheTenantWallHoldsOverHTTP`** in `tests/test_visibility_paths.py` proves
  the read side over HTTP — a valid session from the wrong organisation gets 404
  on the detail route and does not see the row in the index — and pins the write
  side as a **403 by permission**, documenting that the refusal comes from the
  permission gate rather than from scoping.

### ✅ Closed 2026-08-21

The owner asked for the outstanding code-level items to be finished, so the
narrowing was implemented. **It changes no behaviour in the shipped
configuration** — which is what made it safe to do without a further decision:
`assert_within_tenant` returns immediately for `has_admin_access` or a NULL
`organisation_id`, and that is every account holding these permissions today. It
removes the dependency on that staying true; it removes no ability.

**One helper, five call sites.** `partner_service._writable_or_404` replaces the
bare `get_or_404` in `update_partner`, `change_status`, `set_verification`,
`set_listed` and `delete_partner`. `get_partner_for` was deliberately left alone —
it already calls `assert_can_read`, which is stronger.

**Not a new rule.** `scoping.assert_within_tenant` already existed and was already
used by `user_service.update_user` for precisely this, so this is the established
way rather than a second expression of it. It raises **404**, matching the read
path, for the reason `get_partner_for`'s docstring gives: a 403 confirms the row
exists, and in a directory that discloses a competitor.

**`can_edit` is still permission-only, deliberately.** The predicate feeds the
per-row flags, and those are only ever computed for rows the actor could already
read — so narrowing it would duplicate the guard rather than add one. The
asymmetry the original finding described is gone because the *write path* closed,
not because the predicate changed.

**Tests:** `TestTheWritePathNarrowsToTheTenantOnItsOwn` in
`tests/test_visibility_paths.py` — three tests going straight to the service, past
the router, which is the only way to see the inner layer. It asserts 404 for a
cross-tenant edit, 404 for the other four writes, and **403 for the actor's own
organisation** — that last one matters, because a narrowing that refuses
everything is trivially "secure" and useless. Note the actor in those tests is not
given `partner-update`: it no longer needs it, which is the whole improvement.

`test_partner_write_permissions.py` stays. The invariant it enforces is now
belt-and-braces rather than the only protection, and it still catches the
configuration mistake earlier and more cheaply than a service test would.

### The decision the owner still owns

**Should `can_edit` and its three siblings narrow to the actor's tenant?**

* **Argument for:** defence in depth. The read and write paths currently disagree
  about the same row, and the only thing keeping them from contradicting each
  other in production is that nobody has granted a permission. Yesterday's work
  (splitting `ORGANISATION_MANAGE` out of `PARTNER_VIEW`) is exactly the kind of
  change that grants one.
* **Argument against:** these permissions *mean* "staff acting across all
  partners". Adding a tenancy check would need an explicit carve-out for staff —
  who have `organisation_id = None` — and getting that carve-out wrong locks
  staff out of partner administration entirely. The check is not free.
* **Recommended:** leave the predicates alone and keep the invariant test. Revisit
  the moment any partner-facing role is proposed for one of these permissions,
  and treat the test failing as the trigger for that conversation.

## PM-47 — the enquiry state machine is half-built, and the trust metric pays for it ✅ RESOLVED

**Found 2026-08-20**, while looking for what would make the Enquiries module more
useful. Severity 🟠: it silently corrupts the only trust measure the product has,
and that measure feeds partner ranking.

### What is specified versus what exists

`PARTNER_DIRECTORY_PLAN.md` § 10 (line 683) and the schema table (line 1772) both
give the machine as:

    NEW → VIEWED → RESPONDED → WON | LOST | CLOSED | SPAM

and § 10 calls `first_viewed_at` and `first_responded_at` *"the two timestamps the
entire trust system depends on"*. § 19.9 adds that both are **write-once** and
that `SPAM` is reachable from any state.

What is actually built:

| Specified | Built | Consequence |
|---|---|---|
| `VIEWED` status | ❌ absent from the `enquiry_status` enum | "time to first view" cannot be measured at all |
| `first_viewed_at` | ✅ **added 2026-08-20** (`d4a71b93c8e2`), stamped write-once on the recipient partner's read | — |
| `SPAM` status | ❌ absent from the enum | **see below — this is the defect** |
| `first_responded_at` | ✅ present, write-once, tested | the half that works |
| A transition table | ❌ `set_status` accepts any of the five, in any order | `RESPONDED → NEW` is reachable and is a lie about history |

### The defect, stated plainly

Enquiries are created by **anonymous public visitors** through a rate-limited,
honeypot-protected form. Some of them will be junk — that is what a public form
means. There is no `SPAM` status to put them in, so a junk enquiry stays
`first_responded_at IS NULL` for ever, and `enquiry_service.partner_metrics`
counts exactly that as `unanswered`.

So a partner's response rate is dragged down by spam they were right to ignore,
and § 9 ranks partners on that number. The only alternatives available to them
today are `CLOSED` or `LOST`, which are legitimate commercial outcomes and would
misreport the pipeline instead.

**`partner_metrics` is also entirely dead** — zero call sites. So the corrupted
number is not on screen anywhere yet, which is the only reason this is 🟠 and not
🔴. It becomes visible the moment `/dashboard/entitlements` or a partner dashboard
consumes it.

### Why it was not fixed on discovery

Adding the two enum values is a hand-written `ALTER TYPE … ADD VALUE` migration —
`DATABASE_MIGRATIONS.md` § 201 anticipates exactly this case and says so. That
part is small. The reason it stopped is that **a new status the frontend cannot
render is a half-shipped change**: `frontend/lib/api/directoryApi.ts` narrows
`EnquiryStatus` to the five current values deliberately, and the label and tone
maps live in `EnquiriesModule.tsx` — which was being actively edited by another
agent at the time (along with `EnquiryThread.tsx`). Shipping the backend half
would have produced unlabelled grey badges for a status nobody could set.

The same reasoning applies to the missing transition table: forbidding
`RESPONDED → NEW` is correct, but it changes what the existing status dropdown is
allowed to do, and that dropdown is in a file owned elsewhere right now.

### The fix, specified

### ✅ Done 2026-08-20 — the timestamp half

Split out and shipped because it needed **no enum change and no UI change**, which
is what made it safe to do while the enquiries screens were owned elsewhere. The
measure needs a *timestamp*; the `VIEWED` badge is presentation.

* Migration `d4a71b93c8e2` adds `enquiries.first_viewed_at`, nullable, no
  backfill — NULL means "not opened yet", which is honestly true of every row
  that predates it. Inventing a view time from `created_at` would fabricate the
  measure the column exists to report (§ 16.4's honest zero). It round-trips:
  `upgrade → downgrade → upgrade` verified against the live database.
* `enquiry_service.mark_viewed` stamps it write-once, and **only for the
  recipient partner** — `actor.organisation_id == enquiry.partner_id`. Staff have
  no organisation, so they are excluded by construction rather than by being
  named. Without that rule the measure would become "how fast does Leapswitch
  read its own mail". Two tests cover exactly these two rules.
* Exposed on the authenticated enquiry shapes only. It was briefly added to
  `PublicEnquiryStatus` by mistake, which would have told an anonymous buyer when
  the partner opened their enquiry **and** broken that page — the field is
  required and `api/public.py` does not pass it. Caught by inspecting where the
  edit landed, then confirmed by calling the public route: 200, and the field
  absent.

### What remains — the enum half

One migration on head `d4a71b93c8e2`:

1. `ALTER TYPE enquiry_status ADD VALUE 'VIEWED'` and `… ADD VALUE 'SPAM'`,
   hand-written — SQLAlchemy emits no DDL for an enum value addition, and the
   inserts simply fail. PostgreSQL 16 permits this inside a transaction provided
   the new value is not *used* in the same one.
2. `downgrade()` **cannot remove them** — PostgreSQL has no `DROP VALUE`. Follow
   the precedent of `e7b41c9a2d10` and `c1e70a5d94b2` and raise
   `NotImplementedError` with that reason rather than half-reversing.

Then:

3. `mark_viewed` additionally moves `NEW → VIEWED` (the stamp already happens).
4. `set_status` gains `SPAM` (reachable from any state) and a transition table for
   the rest, mirroring `listing_service._TRANSITIONS`, so `RESPONDED → NEW` stops
   being reachable.
5. `partner_metrics` excludes `SPAM` from both numerator and denominator — spam is
   not an enquiry a partner failed to answer, it is not an enquiry. **This is the
   defect; everything else here is the scaffolding for it.**
6. Widen `EnquiryStatus` in `directoryApi.ts` and add the label/tone entries in
   `EnquiriesModule.tsx`. **This is the half to coordinate**, not to race — and
   note the tone map may be an exhaustive `Record`, in which case widening the
   union breaks that file's build until the entries are added.

### ✅ Closed 2026-08-21 — the enum half, and what it turned up

All six steps shipped. Migration `f8c2e91a44d7` on head `c1f7a03b5e42` (not
`d4a71b93c8e2` as this section predicted — the per-user theme migration landed in
between), `ALTER TYPE ... ADD VALUE IF NOT EXISTS` for both values, and a
`downgrade()` that raises with the reason. **Verified against the live type:**
`['NEW','RESPONDED','CLOSED','WON','LOST','VIEWED','SPAM']`.

`_TRANSITIONS` mirrors `listing_service`, and the rule it encodes is worth
stating because it is narrower than "some moves are illegal": **never contradict
a recorded timestamp.** That is what made `RESPONDED → NEW` wrong — the enquiry
carries a write-once `first_responded_at` proving a reply was sent, so a status
saying otherwise puts the row in disagreement with the column § 16.1 computes
from. `WON`/`LOST`/`CLOSED` are mutually reachable *because* none of them
contradicts a timestamp: correcting a mis-click is not rewriting history.

`partner_metrics` now excludes `SPAM` from the numerator **and** the denominator,
and reports it as its own count. Excluding it from only `unanswered` would have
been worse than leaving it in — the answered *share* would still be computed
against an inflated denominator, so attracting spam would still cost a partner
their rating, just less visibly.

**Three things this section did not anticipate, all found in the code:**

1. **`reply()` promoted only from `NEW`.** Adding `VIEWED` would therefore have
   *introduced* the exact defect the transition table exists to prevent: a partner
   who opened an enquiry before answering would sit at `VIEWED` for ever with
   `first_responded_at` set. Now promotes from either open state, with a test that
   fails if the check narrows again.
2. **`SPAM` would have leaked to the anonymous buyer.** `api/public.py` passed
   `enquiry.status` straight into `PublicEnquiryStatus`, so the sender's
   capability URL would have reported `SPAM` — handing a spammer the feedback loop
   they need to iterate past the filter, and telling a *misclassified* real buyer
   something worse than silence. `enquiry_service.public_status` masks it as `NEW`.
   **And it masks `VIEWED` for the same reason `first_viewed_at` was kept off that
   schema**: passing the status through would have leaked the view timing in
   coarser form, and the field would have been withheld for nothing. Confirmed
   over HTTP against a real SPAM-marked row: 200, `status: NEW`, neither `SPAM`
   nor `first_viewed_at` present in the body.
3. **Marking spam had to be reversible.** `SPAM` is one click from every state, so
   it *will* be applied to a real enquiry by accident. An irreversible
   classification would destroy a genuine lead permanently — a worse defect than
   the one this item was raised for. `SPAM → NEW` is the only edge out, because
   nothing records what it was before.

**Also fixed while here:** the status dropdown no longer holds its own copy of the
lifecycle. `EnquiryDetailResponse.allowed_transitions` sends the legal moves, so
the page cannot offer one the API refuses with a 409 — which an operator reads as
a broken page rather than an illegal move. The 409's message (which names what
*is* allowed) is now surfaced in the toast instead of a generic failure.

**Tests:** 23 in `tests/test_enquiry_lifecycle.py` (no database — the table and the
public mask are pure functions of a status string, so they run in CI on the code
alone) and 7 in `TestTheStateMachineAndTheTrustMetric`. The defect test was
**proven to fail against the pre-fix code** — reverted the two counting queries,
ran it, got `assert 1 == 0` on `unanswered`, restored.

**Still open, deliberately:** `partner_metrics` has zero call sites, so the number
this fixes is not yet on screen anywhere. `/dashboard/entitlements` or a partner
dashboard is what makes it visible.

---

## PM-48 — the moderation queue returned a 500 for every non-empty queue ✅ RESOLVED

**Found and fixed 2026-08-21.** Severity 🔴 for what it did — the most important
staff screen in the directory was unusable the whole time it had anything to do —
and recorded as resolved because the fix shipped in the same change.

### What happened

```python
item = ModerationQueueItem.model_validate(listing)   # ← fails here
item.partner_name = ...                              # ← never reached
item.entitlement = ...
```

`partner_name` and `entitlement` are required on `ModerationQueueItem` and neither
is a column on `ServiceListing`, so `model_validate` raised two `missing` errors
before the assignments that would have supplied them ever ran. Introduced
2026-08-20 with the entitlement/blockers work.

### Why nobody noticed for a day

Four separate things agreed the screen was fine:

1. **The empty-queue early return.** `if not listings: return []` runs first, so a
   queue with nothing in it answered `200 []`. The only queue anyone had loaded was
   an empty one.
2. **The page renders an empty state that looks deliberate** — "An empty queue is
   the healthy state" — so a broken fetch and a genuinely clear queue look
   identical.
3. **The test suite covered the service, not the route.** `pending_queue` was
   asserted; `api/moderation.review_queue`, which builds the response, never was.
   997 tests passed with the endpoint 500ing.
4. **The browser pass agreed.** `/dashboard/moderation` PASSED — the text probe
   matched the error/empty state. It had also never been in the check's page list at
   all until the same day, which is its own finding (see below).

### The fix

Assign onto the ORM row **before** validating, which is the shape
`partner_service.decorate` already uses for its per-row flags — one pattern rather
than two. Verified over HTTP: **200, 7 rows, 2 carrying blockers**, against 500
before.

### What was added so it cannot recur

* **`TestTheModerationQueueRouteAssemblesItsResponse`** — three route-level tests,
  two rows each so a single-row special case cannot pass. **Proven to fail against
  the pre-fix code**: `ValidationError: entitlement Field required`.
* **Four screens added to `scripts/browser-check.mjs`** — categories, listings,
  moderation and enquiries had never been visited. The directory staff UI was added
  to that list for partners and tiers only on 2026-08-13 and the rest was missed,
  and the omission was invisible because a route that is never visited cannot fail.
  The pass count went 59 → 63.

### The generalisable rule

**A response model with required fields that are not columns needs a route-level
test.** The service can be entirely correct and the endpoint still 500 — and if the
route has an early return for the empty case, the failure will look like "nothing
to show" rather than like an error. Written into
`system-design/FASTAPI_STANDARDS.md` § 5.

---

## PM-49 — the partner dashboard was unreachable for everybody ✅ RESOLVED

**Found and fixed 2026-08-21.** Severity 🔴: a whole screen — the one § 20.6.1
calls the partner's landing content — had never rendered for a single account.

### The defect

`CurrentUserResponse.organisation_id` was added on 2026-08-17 with a default:

```python
organisation_id: str | None = None       # ← the default is the bug
```

`rbac_service.current_user_payload`, which builds the dict every one of the six
construction sites passes in, was never given the key. So the field validated
happily and serialised as `null` for every account on every request.

`DashboardHome` decides whether an account is a partner from that one value:

```ts
const organisationId = useAppSelector((s) => s.auth.user?.organisation_id);
const isPartner = Boolean(organisationId);      // ← always false
```

So `PartnerOverview` was mounted for nobody. Every entitlement figure, unanswered
count and "waiting on you" banner behind it was dead code.

### Why it survived four days

**The wrong answer was also the common answer.** Most accounts genuinely have no
organisation, so `null` is what the majority *should* see — there was no account
for which the bug produced an obviously silly value. Nothing logged, nothing
500'd, and the field was present in the response so a schema diff looked correct.

**And no test could see it**, because the two halves were tested separately: the
column was covered by the tenancy suite, the component by typecheck. Nothing
asserted that the identity *payload* carried the field.

### How it was actually found

Not from a log or a failing test. The browser pass reported `/dashboard` as
passing — it always had — so **the screenshot was read**. The partner block simply
was not on the page. `curl`ing `/auth/me` then showed `organisation_id: null`
against a database row that had it set.

Worth recording as a method: for a change whose whole purpose is that something
appears on screen, "the page returned 200 and contains the expected word" is not
evidence. Look at the picture.

### The fix

* `current_user_payload` now includes `organisation_id`.
* **The schema field is required** — no default. A default on a field the payload
  builder owns converts a missing key into a wrong answer; without one it is a 500
  on the first request. All six construction sites go through the same payload
  function, so making it required is safe.
* `TestTheIdentityPayloadCarriesOrganisationMembership` — three tests: a partner
  member reports their organisation, an internal account reports `None` (the two
  were indistinguishable before), and `model_fields["organisation_id"].is_required()`
  is asserted directly so restoring the default fails loudly rather than quietly
  re-killing the dashboard.

Verified over HTTP: both `/auth/login` and `/auth/me` now return the id.

---

## PM-50 — CI had been red for environmental reasons, so nobody read it ✅ RESOLVED

**Found 2026-08-21** immediately after pushing, by looking at why the previous two
commits on `main` were also red. Severity 🟠: nothing was broken in the product,
but the only automated check on the repository had been failing for days, which
means it had stopped being able to report that anything *else* was broken.

### Two independent causes

**1. CI migrated the database and seeded nothing.**

```yaml
- name: Migrate the test database
  run: alembic upgrade head
- name: Test
  run: pytest              # ← against an empty schema
```

Five tests failed for want of reference data, not for want of correctness:

| Test | Wanted |
|---|---|
| `test_seed_credentials` ×3 | provider rows — the credential seeder `SystemExit`s without them |
| `test_ai_safety` redaction | at least one `users` row to prove a column comes back redacted |
| `test_route_enforcement` invitation-outranking `[Admin]` | the `Admin` role to exist |

And **86 more skipped** rather than ran: the local gate reported 1003 passed / 5
skipped where CI reported 912 passed / 91 skipped. So roughly 8% of the suite was
not being executed anywhere except a developer's machine, which is the half of
PM-11 that a CI file alone does not discharge.

Fixed by seeding what `README.md` § Seeding calls required: `seed_rbac`,
`seed_partner_tiers`, `seed_api_providers`. All idempotent; the provider seed
carries labels and placeholders only, no secrets, which is what makes it safe in a
public repository.

**2. The frontend build needed an API it had no way to reach.**

`/partners/[slug]` and `/services/[category]` enumerate their pages in
`generateStaticParams`, which runs at build time against the live API. CI has no
backend, so `next build` died on `TypeError: fetch failed` — the check PM-24
existed to restore had therefore been failing since the directory pages were added.

Fixed with `lib/public/buildParams.ts`, and the design of that fix is the part
worth reading:

* It wraps **only** `generateStaticParams`, never a data fetcher.
  `lib/api/public.ts` promises that a page fails visibly when the backend is down,
  and `DIRECTORY_BUILD_PUNCHLIST` 6.2 tests it. Page *rendering* still throws.
* Without `BUILD_WITHOUT_API=1` it **rethrows**, with the route name and the cause
  attached. That matters because these routes set `dynamicParams = false`: a build
  that enumerates nothing serves a hard 404 for every partner page. A silent `[]`
  would turn a missing backend into a directory that builds cleanly and serves
  nothing, which is strictly worse than a failed build.
* **The first attempt set that flag in CI, and it was wrong.** The build then
  failed further along — `/sitemap.xml` and the `/for/*` pages read the API while
  prerendering too. Wrapping each of those in turn would grow a new exception every
  time a public page learned to read anything, and each one chips at the guarantee
  that a page fails visibly when the backend is down.

  So the frontend job now **runs a real API**: postgres service, `alembic upgrade
  head`, `seed_rbac` + `seed_partner_tiers` + `seed_directory`, then `uvicorn` in
  the background with a readiness poll. That makes the step strictly more than it
  ever was — it prerenders real partner and category pages from real rows, so it is
  now a smoke test of the public surface rather than only a compile check.

  `seed_directory`'s demo partner logins stay off: they are gated behind
  `ALLOW_DEMO_PARTNER_LOGINS`, which is not set, because a build needs public data
  and no accounts.

  The flag survives as an escape hatch for building locally with the stack down.
  **Nothing in the repository sets it**, and a build made with it is not deployable.

### Verified against a fresh database, not the dev one

The local gate could not see any of this — a seeded dev database makes all five
tests pass. So the CI path was reproduced: a throwaway role and database, migrate,
the three seeds, then `pytest`. **995 passed, 13 skipped, 0 failed.** The
remaining skips are honest ones that name what they want (`test_data_access` needs
a RootUser plus two other active accounts, which `seed_users` provides and which is
gitignored because it holds real addresses).

The probe role and database were dropped afterwards; only `postgres` and the dev
database remain.

### The generalisable point

A green local gate and a red CI is not "CI being fussy" — it is the two
environments disagreeing about what the software needs, and the environment that
matters is the one you did not configure by hand. Worth re-reading § 4 of
`AGENTS.md` with that in mind: it lists the commands, and it cannot tell you that
the database they run against is not the one CI has.

---

## PM-41 — the frontend fetch-on-mount sweep ✅ COMPLETE 2026-08-21

The data layer was built on 2026-08-18 and then only the partner modules used it.
This is the record of finishing it, because "RTK Query is wired" and "the
application reads through it" were nine days apart and the register said the first
while meaning the second.

### What moved

**Every component that fetched on mount.** Measured at the start of the sweep as 26
files; the true figure was 23 — three were false positives my own detector produced
and they are worth naming, because the same measurement will be run again:

* `SettingRowEditor` matched on the *word* `useEffect` inside a comment explaining
  why it does not use one. It is presentational and takes its `save` as a prop.
* `WelcomeBanner`, `ConfirmDialog` and `DeleteDialog` matched a client name inside a
  docstring — `ConfirmDialog`'s is a usage example.

**Grep for a call, not for an import or a word.** An import can be type-only and a
mention can be prose.

### Where the value actually was

Not the boilerplate — the deleted `useResourceList` had already collapsed that. It
was in the four things a component cannot do for itself:

| | Found in |
|---|---|
| A write refreshing screens the writer does not know about | `CloneRoleModal` depended on its opener reloading; `RoleMatrix` reloaded only itself while the roles table showed a per-role permission count; a recycle-bin restore refreshed the bin and not the list the record returned to |
| One request where there were several | `/partners/me` was fetched by three screens mounted together; the role picker by three; assistant availability by two |
| Deduplication across screens | Opening a row from a table it was just listed in |
| Not defending against races by hand | `GlobalSearch` kept a sequence counter to discard out-of-order responses; keying the query on the term makes that structural. Six components carried their own `live`/`cancelled`/`alive` unmount guards |

### The pattern that came up in five separate files

Loading a record and copying it into local state inside an effect —
`react-hooks/set-state-in-effect`. The rule is right for a reason none of these
components could hit before: **the cache now refetches after any write**, including
one made by somebody else, so a copy is silently overwritten mid-typing. Derived
instead, with "untouched follows the server, touched holds its own":
`ListingForm`, `RoleForm`, `OrganisationModule`, `PartnerForm` (via RHF `reset`),
`GlobalSearch`.

### The one deliberate exception

`AcceptInvitationClient` previews an invitation by token. A cache key is the query
argument, so caching it holds a single-use credential in the store after the
invitation is consumed — and the page is a dead end with no second reader. Reason
recorded at the call site.

### A wrong justification I committed and had to retract

`ab0a882` kept `uploadBrandAsset` direct, claiming a `File` in a mutation argument
would trip the store's `serializableCheck`, and instructed the next reader not to
change it. **False.** RTK's default `ignoredActionPaths` is
`["meta.arg", "meta.baseQueryMeta"]` — exactly where RTK Query puts mutation
arguments. `usersEndpoints.sendUserEmail` had been built on that all along.
Corrected in `ffe391f`.

Two lessons, and the second is the one that cost the time: **check the installed
package before writing a confident mechanism in a comment** — one grep would have
settled it — and **look for a precedent in the repository before concluding
something cannot be done here.**

### What this did not fix

Cache *keys* are right and invalidation is right; nothing here re-examined whether
each screen asks for the right data. `TeamModule` still asks for `per_page: 100`
and renders all of it with no paging, so an organisation with more than a hundred
members silently sees a hundred — noted at the call site and unfixed, because it
needs the screen to paginate rather than a different fetch.

---

## PM-39 — nothing mechanical verifies anything ✅ CLOSED 2026-08-21

The row said "floor laid" for fifteen days, which was true on 2026-08-06 and
understated things badly by the end. What exists now:

* **1003 backend tests**, and CI runs them against a migrated *and seeded*
  database. Until 2026-08-21 it seeded nothing, so 86 of them were skipped there
  and five failed for want of reference data — the suite existed and CI was red for
  environmental reasons, which is arguably worse than no CI (see PM-50).
* **Both CI jobs green**, including the production build — which had never once
  succeeded in CI, because two public routes enumerate their pages at build time
  against a live API the job did not have.
* **A 68-screen browser pass** that signs in, walks every screen, and asserts URL,
  sidebar, text floor, console errors and failed requests. It was 59 screens this
  morning; nine screens had never been opened by it, which is why three separate
  defects reached this week's review with a green tick beside them.

**The thing worth carrying forward** is not the count. It is that on three separate
occasions this week a check reported success about something it was not looking at:
a page absent from the pass list, a route whose failure matched the empty state's
text, and a WARN that would have recurred for ever. Coverage of the *checks* turned
out to matter more than coverage of the code.

PM-11 stays open: this is a floor over behaviour, not a coverage measurement, and
nothing here reports a percentage.
