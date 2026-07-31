# Technical Debt Register

> Defects and inconsistencies carried in from the inherited scaffold, ranked by severity.
> **Everything here is known.** Don't re-report an item as a new discovery; do reference its ID.
>
> Planning docs are reference only — verify against the code before acting.

**Last audited:** 2026-07-31, after the auth/RBAC rebuild.
**Since then:** PM-25 added 2026-07-31 (containerisation); PM-26/27/28 added 2026-07-31
during the auth/RBAC rebuild, which also closed PM-1, 3, 6, 7, 9, 14, 15, 16, 17 and 18.

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
| [PM-2](#pm-2--auth-cookies-set-with-securefalse) | 🔴 | Auth cookies set with `secure=False` | Auth |
| [PM-3](#pm-3--any-admin-can-create-a-super-admin--resolved) | ✅ | ~~Any admin can create a super-admin~~ | Authz |
| [PM-4](#pm-4--seed-credentials-in-a-public-repo) | 🔴 | Seed credentials in a public repo | Auth |
| [PM-5](#pm-5--no-row-level-scoping-pattern-exists) | 🟠 | No row-level scoping pattern exists | Authz |
| [PM-6](#pm-6--six-admin_users-columns-are-never-written--resolved) | ✅ | ~~Six `admin_users` columns are never written~~ | Data |
| [PM-7](#pm-7--three-auth-guards-are-defined-but-unused--resolved) | ✅ | ~~Three auth guards are defined but unused~~ | Authz |
| [PM-8](#pm-8--no-rate-limiting-and-no-lockout--partially-resolved) | 🟡 | ~~No lockout~~; still no HTTP rate limiting | Auth |
| [PM-9](#pm-9--cors-origins-hardcoded-to-localhost--resolved) | ✅ | ~~CORS origins hardcoded to localhost~~ | Infra |
| [PM-10](#pm-10--no-error-logging-or-monitoring) | 🟠 | No error logging or monitoring | Infra |
| [PM-11](#pm-11--no-automated-tests) | 🟠 | No automated tests | Quality |
| [PM-12](#pm-12--root-readmemd-is-wrong-in-twelve-places--resolved) | ✅ | ~~Root `README.md` is wrong in twelve places~~ | Docs |
| [PM-13](#pm-13--token-decoding-duplicated-in-routers) | 🟡 | Token decoding duplicated in routers | Auth |
| [PM-14](#pm-14--inconsistent-password-validation-rules--resolved) | ✅ | ~~Inconsistent password validation rules~~ | Schemas |
| [PM-15](#pm-15--patch-endpoints-require-every-field--resolved) | ✅ | ~~`PATCH` endpoints require every field~~ | API |
| [PM-16](#pm-16--no-change-password-endpoint--resolved) | ✅ | ~~No change-password endpoint~~ | Auth |
| [PM-17](#pm-17--emails-are-not-normalised--resolved) | ✅ | ~~Emails are not normalised~~ | Data |
| [PM-18](#pm-18--health-check-doesnt-check-the-database--resolved) | ✅ | ~~Health check doesn't check the database~~ | Infra |
| [PM-19](#pm-19--no-error-boundaries-or-route-suspense) | 🟡 | No error boundaries or route suspense | Frontend |
| [PM-20](#pm-20--brand-colour-hardcoded-in-components) | ⚪ | Brand colour hardcoded in components | UI |
| [PM-21](#pm-21--stale-product-naming-throughout--mostly-resolved) | ✅ | ~~Stale product naming throughout~~ (2 items deferred) | Housekeeping |
| [PM-22](#pm-22--unused-tailwind-v4-dependency) | ⚪ | Unused Tailwind v4 dependency | Frontend |
| [PM-23](#pm-23--two-dead-virtualenvs-in-the-tree) | ⚪ | Two dead virtualenvs in the tree | Housekeeping |
| [PM-24](#pm-24--production-build-failed-on-a-type-error--resolved) | ✅ | ~~Production build failed on a type error~~ | Build |
| [PM-25](#pm-25--npm-ci-fails-react-19-against-next-14s-peer-range) | 🟠 | `npm ci` fails — React 19 against Next 14's peer range | Build |
| [PM-26](#pm-26--no-http-rate-limiting-successor-to-pm-8) | 🟠 | No HTTP rate limiting | Auth |
| [PM-27](#pm-27--no-email-transport-so-invitations-and-resets-are-manual) | 🟠 | No email transport — invitations/resets are manual | Infra |
| [PM-28](#pm-28--google-sso-is-unverified-against-real-google) | 🟠 | Google SSO implemented but never run against Google | Auth |

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

### PM-2 — Auth cookies set with `secure=False`

**Where:** `backend/app/api/auth.py` `_set_auth_cookies()`

Both cookies are issued with `secure=False`, so they will be transmitted over plain HTTP. The source
already carries the reminder: `# set True behind HTTPS in production`.

**Fix:** drive it from `Settings` (e.g. `COOKIE_SECURE: bool = False`) so local stays HTTP and
deployed environments get `True`. Verify with
`curl -si … | grep -i set-cookie` — `Secure` must be present.

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

### PM-4 — Seed credentials in a public repo

**Where:** `backend/app/db/seed_admin.py:13-15`, and the inherited `README.md:114-118`

`abc@gmail.com` / `Abc@1234` as a `super_admin`. The README additionally publishes a different
(non-existent) pair, `admin@example.com` / `admin123`.

**Fix:** acceptable as an obviously-fake local placeholder, but the seeder must never run in a reachable
environment. The README's credentials block was removed when it was rewritten (PM-12), so the seeder
is now the only place these appear.

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

### PM-10 — No error logging or monitoring

**Where:** whole backend

No exception handlers, no structured logging, no alerting. An unhandled exception becomes a bare 500
with a traceback on stdout — and in a deployed environment, effectively invisible.

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

### PM-19 — No error boundaries or route suspense

No `error.tsx`, `loading.tsx`, or `not-found.tsx` anywhere in `app/`. A render error in a client
component produces a blank screen; loading is handled ad hoc per component.

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

### PM-26 — No HTTP rate limiting (successor to PM-8)

**Where:** `backend/app/main.py` — no limiting middleware

Per-account lockout now exists (PM-8), but nothing limits requests per IP. An attacker can still
spray one attempt each against thousands of accounts without ever tripping a lockout, and the
`/api/auth/forgot-password` and `/api/invitations/preview` endpoints are unauthenticated.

**Fix:** a reverse-proxy limit (nginx `limit_req`) or `slowapi` middleware, keyed on IP, tightest on
`/api/auth/*`.

---

### PM-27 — No email transport, so invitations and resets are manual

**Where:** `backend/app/services/invitation_service.py`, `auth_service.begin_password_reset`

There is no mail configuration. Consequences, both deliberate and visible rather than silent:

- `POST /api/invitations` **returns** `accept_url` for the administrator to send by hand
- `POST /api/auth/forgot-password` always answers "if an account exists…" but the token is only
  reachable by reading `users.password_reset_token` in the database

**Fix:** add SMTP settings and a small mail service, then stop returning `accept_url` in the response.
Until then the behaviour is honest but not self-service.

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

## Suggested Order of Work

The 2026-07-31 auth/RBAC rebuild closed the four original blockers except PM-2 and PM-4. What is left,
in order:

1. **PM-11** (tests) — the auth surface is now large and verified only by a shell script
2. **PM-26** (rate limiting) + **PM-2** (`secure` cookies) — both required before public exposure
3. **PM-27** (email) — invitations and password reset are not self-service without it
4. **PM-28** (verify Google SSO end to end against a real OAuth client)
5. **PM-5** (row-level scoping) — still required before any partner-owned data exists
6. **PM-4** (seed credentials), **PM-10** (logging), **PM-19** (error boundaries)
7. **PM-25** (React/Next peer mismatch) — a framework-version decision
8. Everything else as the surrounding code is worked on

## Related Documentation

- [`../core/AUTHENTICATION.md`](../core/AUTHENTICATION.md) — PM-1, PM-2, PM-6 in depth
- [`../core/AUTHORIZATION.md`](../core/AUTHORIZATION.md) — PM-3, PM-5, PM-7 in depth
- [`../system-design/DEPLOYMENT.md`](../system-design/DEPLOYMENT.md) § 0 — the deploy blocker list
- [`SCAFFOLD_CLEANUP_PLAN.md`](./SCAFFOLD_CLEANUP_PLAN.md) — retiring inherited code
- [`MARKETPLACE_DOMAIN_PLAN.md`](./MARKETPLACE_DOMAIN_PLAN.md) — what must exist regardless of domain
