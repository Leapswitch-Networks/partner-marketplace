# Core Hardening Plan — FastAPI + Next.js Platform Layer

> **Scope: the core, not the domain.** This plan is about the platform the marketplace will be built
> on — transactions, configuration, contracts, tests, versioning, data fetching. It deliberately says
> nothing about partners, listings or orders; those belong in
> [`MARKETPLACE_DOMAIN_PLAN.md`](./MARKETPLACE_DOMAIN_PLAN.md).
>
> **Written 2026-08-06**, from a read of the code rather than the docs. Every claim below carries the
> file or the command that produced it, because
> [`TECH_DEBT.md`](./TECH_DEBT.md)'s own audit note is the lesson here: *the register is a map, not
> the territory.*

---

## 0. The honest starting position

The security core is in far better shape than `README.md` advertises. The README still says passwords
are stored in plaintext; they are bcrypt at 12 rounds. Measured against the register, **28 of 36
tracked items are closed.** What exists today, verified in code:

| Capability | Where |
|---|---|
| bcrypt hashing, typed JWTs, one decoder asserting `type` | `core/security.py` |
| Server-side sessions with revocation, refresh rotation + reuse detection | `services/session_service.py` |
| RBAC: 56 routes, every one permission-gated; super-admin bypass | `core/dependencies.py` |
| 2FA (TOTP + recovery codes, Fernet-encrypted at rest), password confirmation | `services/two_factor_service.py` |
| Per-IP sliding-window rate limiting, three tiers | `core/rate_limit.py` |
| Per-account lockout, email verification, invitations, Google OAuth | `services/auth_service.py` |
| Audit trail with before/after diffs, CSV export | `services/activity_service.py` |
| Structured logging with request-id correlation, three exception handlers | `core/logging.py`, `main.py` |
| Security response headers, both tiers | `core/headers.py`, `next.config.mjs` |

**So this plan is not a rescue.** The auth *features* are close to complete. What is missing is the
layer underneath them — the parts that make a codebase survive change rather than survive a review.
Eight new items, PM-37 through PM-44.

**The one-line summary:** the core is well-built and undefended. Its correctness lives in prose and in
one developer's memory, and nothing mechanical stops the next change from breaking it.

---

## 1. Summary of new findings

| ID | Sev | Title | Cost |
|----|:---:|-------|------|
| [PM-37](#pm-37--no-environment-concept-so-every-deployment-safety-rule-is-unenforced) | ✅ | ~~No environment concept~~ — `APP_ENV` + startup validator, closed 2026-08-06 | S |
| [PM-38](#pm-38--no-transaction-boundary-49-commits-and-a-session-that-never-rolls-back) | ✅ | ~~No transaction boundary~~ — explicit rollback + `unit_of_work`, closed 2026-08-06 | M |
| [PM-39](#pm-39--nothing-mechanical-verifies-anything-no-tests-no-ci) | ⏳ | Nothing mechanical verifies anything — **217 tests + CI exist**; not coverage | L |
| [PM-40](#pm-40--56-routes-are-unversioned) | ✅ | ~~56 routes are unversioned~~ — `/api/v1`, closed 2026-08-06 | S |
| [PM-41](#pm-41--the-frontend-has-no-data-layer-and-does-no-server-side-fetching) | 🟠 | The frontend has no data layer and does no server-side fetching | L |
| [PM-42](#pm-42--the-api-contract-is-hand-copied-into-typescript) | ✅ | ~~The API contract is hand-copied into TypeScript~~ — generated + asserted, closed 2026-08-06 | M |
| [PM-43](#pm-43--two-purge-functions-exist-and-nothing-runs-them) | ✅ | ~~Two purge functions exist and nothing runs them~~ — closed 2026-08-06 | S |
| [PM-44](#pm-44--three-pieces-of-state-live-in-process-memory) | 🟡 | Three pieces of state live in process memory | M |

Existing register items this plan re-prioritises rather than duplicates: **PM-5** (row-level scoping),
**PM-10** (monitoring half), **PM-11** (tests — see PM-39), **PM-25** (React/Next peer mismatch),
**PM-30** (react-hooks errors — see PM-41 for the cause).

---

## 2. Findings in detail

### PM-37 — No environment concept, so every deployment-safety rule is unenforced

```bash
grep -rn "ENVIRONMENT\|APP_ENV\|is_production\|DEBUG" backend/app/ --include="*.py"
# → no output
```

`Settings` has 60-odd fields and **not one of them says which environment this is.** The consequence
is that [`DEPLOYMENT.md`](../system-design/DEPLOYMENT.md) § 0 carries a seven-row table of
*"configuration that must change per environment"* — `COOKIE_SECURE`, `CORS_ORIGINS`, `SECRET_KEY`,
`MAIL_BACKEND`, `TRUST_PROXY_HEADERS`, `LOG_FORMAT`, `ROOT_PASSWORD` — and **every row is a thing a
human has to remember.** Nothing in the code can tell that it is running in production, so nothing can
object.

Each default is individually correct for local development and individually dangerous in production:

| Default | What it means if it survives to production |
|---|---|
| `COOKIE_SECURE = False` | Session cookies travel in cleartext |
| `MAIL_BACKEND = "console"` | Password-reset links — live credentials — written to the log |
| `CORS_ORIGINS = "…localhost:3000,…3001"` | Real frontend gets CORS-blocked; the *failure* is loud, so this one is self-correcting |
| `LOG_FORMAT = "console"` | Multi-line tracebacks defeat the aggregator |
| `TRUST_PROXY_HEADERS = False` | With a proxy in front, every caller shares one rate-limit bucket |
| `SECRET_KEY` | No length or entropy floor. A short dev key forges tokens for every account |

The register's own history is the argument for fixing this mechanically: PM-2 and PM-4 sat in the
blocker list as live 🔴 items *while the code was already correct*, and DEPLOYMENT § 0 listed five
resolved items as blockers. **Prose about configuration drifts from configuration.** An assertion
cannot.

`MAIL_BACKEND=console` is the worst of them, because it fails silently and successfully. An
unconfigured SMTP host errors and someone notices; `console` works perfectly and quietly writes a
working credential to a file with a different audience than the database has.

**Fix:** an `APP_ENV` field (`development` | `staging` | `production`) and a validator that **refuses
to boot** when the combination is unsafe. Fail at import, not at first request: a process that starts
and then leaks is worse than one that never starts. Implemented — see § 4.

---

### PM-38 — No transaction boundary: 49 commits, and a session that never rolls back

```python
# core/dependencies.py
def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

No `commit`, no `rollback`. So every service commits for itself:

```bash
grep -rc "db.commit()" backend/app/services/*.py
# auth_service 12 · user_service 9 · session_service 7 · invitation_service 7
# two_factor_service 5 · google_service 3 · rbac_service 3 · activity_service 2
# navigation_service 1        → 49 across 9 files
```

Two distinct problems.

**A request has no atomic unit.** `create_user` commits at `user_service.py:186`; the activity-log
write commits separately; role assignment is inside the same commit but the audit row is not. Any
route whose work spans two commits can leave half of it durable. Nothing here is *known* to be broken
— the flows are short and mostly commit once — but the property "a failed request changes nothing" is
not available, and the marketplace's multi-table writes are exactly where it starts to matter.

**Nothing rolls back explicitly.** `Session.close()` does discard an uncommitted transaction, so this
is not silent corruption. But it means a failed request's session is returned to the pool with its
state ended by a side effect rather than by intent, and a service that catches an exception and
carries on is working with a session whose flush state it did not choose.

The audit-log writes are a deliberate exception and must stay one: `activity_service` swallows its own
exceptions, because failing a login because an audit write failed turns observability into an outage.
That reasoning is sound and survives this change — the fix is not "one commit for everything", it is
"one *declared* boundary per unit of work, and audit writes explicitly outside it."

**Fix:** rollback on exception in `get_db`; add an explicit `unit_of_work` context manager for
multi-write flows; leave single-write services alone. Implemented — see § 4.

---

### PM-39 — Nothing mechanical verifies anything: no tests, no CI

```bash
ls .github            # → No such file or directory
find . -name "conftest.py" -o -name "test_*.py" | grep -v venv   # → nothing
ls backend/pyproject.toml backend/pytest.ini backend/ruff.toml   # → nothing
```

This is **PM-11**, which the owner deliberately moved to the end of the queue on 2026-08-03, and that
decision is recorded and respected. This entry does not reopen the argument; it records what the
deferral is now costing, because the cost has grown since the decision.

The verification that *does* exist is extraordinary in quality and unrepeatable in practice. The
register documents measured evidence — 14 spoofed `X-Forwarded-For` headers against a limit of 10, a
canary password checked for absence in the logs through both the normal and the 422 path, a fake SMTP
relay written specially, a refresh token replayed after the grace window to confirm the session dies.
**Not one of those can be re-run by a command.** Every one is a shell session that happened once.

So the register's evidence is a description of behaviour that was correct on 2026-08-03. Nothing
distinguishes that from behaviour that is correct today.

Three concrete costs already visible in the register:

- `set_auth_cookies` was called with a stale two-argument signature on the invitation path and would
  have raised on the first invitation ever accepted. Found by reading the file (PM-34).
- `npm run build` was broken by a type error and stayed broken, unnoticed, because nothing runs it
  (PM-24).
- PM-5 (row-level scoping) is next in the queue and **a scoping bug does not raise** — it returns
  another partner's rows. Nothing in the toolchain would notice.

**Fix:** the smallest suite that would have caught all three, plus CI that runs the four checks which
already exist and are only ever run by hand. Started — see § 4.

---

### PM-40 — 56 routes are unversioned

```bash
grep -c "@router\." backend/app/api/*.py   # → 56
grep -hn "APIRouter(" backend/app/api/*.py # → prefix="/users", "/auth", "/roles", …
# main.py mounts every one at prefix="/api"
```

Every route is `/api/<resource>`. No `v1`. The frontend hardcodes **38** `"/api/…"` string literals
across five files in `lib/api/`.

Today this costs nothing — one client, one repo, deploy both together. It becomes expensive at exactly
one moment: the first partner integrating against this API. After that, any breaking change needs a
version to live in, and adding one retroactively means either breaking every existing caller or
running an unversioned alias forever.

`/api/v1` now is a prefix string and one constant. Later it is a migration.

### ✅ Resolved 2026-08-06

`settings.API_PREFIX = "/api/v1"`; all 9 routers mount there. **No unversioned alias** — nothing was
pinned, so the OpenAPI stays clean. `/health` and `/health/ready` stay **unversioned deliberately**: a
liveness probe should not have to know the API's contract version, and health is not part of that
contract.

On the frontend the version went into `axiosInstance`'s `baseURL`, so the **57** paths across five
`lib/api` modules are now written relative to it — `"/auth/login"`, not `"/api/v1/auth/login"`. A v2 is
one constant instead of 57 string edits. Server-side `fetch` calls, which bypass axios, use a
`SERVER_API_URL` constant.

#### Three things that would have broken silently

The routes moving is the easy part. Three places keyed on the literal path, and each fails in a way
that does not look like a versioning problem:

1. **The refresh cookie's `Path`.** `_REFRESH_PATH = "/api/auth/refresh"` scopes the refresh cookie so
   it is never sent on ordinary requests. Left as a literal, the cookie would have been scoped to a
   path that no longer exists — the browser would never send it, `/refresh` would 401 for everyone, and
   **the symptom is every session dying an hour after sign-in**, which points nowhere near a path
   constant. Now derived from `API_PREFIX`; verified by constructing the response and reading
   `Path=/api/v1/auth/refresh` off the `Set-Cookie`.
2. **The rate limiter's tiering.** 14 absolute paths plus a `path.startswith("/api/auth")` test. Stale,
   every credential endpoint would silently fall from the `sensitive` tier (10/min) to `default`
   (300/min) — rate limiting that looks present and is thirty times weaker. Verified after the move:
   login 10, `/auth/me` 60, `/navigation` 300.
3. **The `axiosInstance` interceptor's own guards.** They test `original.url` for `/auth/refresh` and
   `/auth/logout` to avoid recursing on the refresh call. `original.url` is the path *as the caller
   wrote it* — now relative — so a check for `/api/auth/refresh` would never match and a dead session
   would loop instead of failing.

**Verified:** `/api/v1/settings/branding` → 200, old `/api/settings/branding` → 404, `/health` → 200.
A script cross-checked **all 43 distinct frontend API paths against the live OpenAPI document** — every
one resolves to a real versioned endpoint, which is what makes 57 mechanical edits trustworthy.

**Note `/api/revalidate-branding` was deliberately NOT versioned.** It is a Next route handler served
by the frontend, not the backend. Prefixing it would have broken it, and it is the one `/api/` string
that should stay.

**While in that file:** `constants.ts` defaults `API_BASE_URL` to `http://localhost:8000`, and the
backend runs on **8002**. A developer with no `NEXT_PUBLIC_API_URL` gets connection refused against a
port nothing serves. One-character class of bug, five-minute fix, and it is the first thing a new
developer hits.

---

### PM-41 — The frontend has no data layer, and does no server-side fetching

```bash
find app components -name "*.tsx" | wc -l        # 76
grep -rl '"use client"' app components | wc -l   # 44
grep -rl "useEffect" app components | wc -l      # 22
```

**All 24 files under `app/` that are server components are shells.** Each sets `metadata` and renders
one client component. Not one performs a `fetch` or reads a cookie server-side. So:

- **Every screen is a waterfall.** HTML → JS → mount → `useEffect` → `/api/auth/me` → then the
  screen's own data. The user watches a skeleton for two sequential round trips that a server
  component could have collapsed into zero.
- **Nothing is cached, deduplicated, or cancelled.** Two components needing the same list fetch it
  twice. Navigating away leaves the response to arrive at an unmounted tree.
- **`loading.tsx` almost never renders.** The register already notes this and says it is "not doing
  much work today" — the cause is that the segment resolves instantly because it fetches nothing.
- **PM-30's 20 react-hooks errors are this, not a lint problem.** The register tracks the count
  climbing — 17 → 18 → 19 → 20 — and names the pattern each time: *fetch-on-mount*. It also records
  that an honest attempt to satisfy the rule with a cancellation flag **did not clear the error**. The
  rule is not wrong and the code is not wrong; the *architecture* is what the rule objects to. Every
  new client component adds one. That is a tax with no ceiling.

The register calls this "the cost of leaving PM-25 open". It is only half that. Settling the
React/Next version decides whether the rule *applies*; it does not remove the waterfall, the double
fetches, or the uncancelled requests.

**One more, in `lib/api/axiosInstance.ts`:**

- **No single-flight on refresh.** Four parallel 401s fire four `POST /api/auth/refresh` calls. This
  currently survives *only* because of `REFRESH_ROTATION_GRACE_SECONDS = 30`: the first rotates, the
  rest present the superseded token inside the grace window and are honoured. So the grace window,
  added for concurrent browser tabs, is silently load-bearing for a single tab's parallel requests.
  That is a coincidence holding a correctness property up. A shared promise makes it intentional.
- **`timeout: 5000` applies to every request, including `GET /api/activity/export`** — which the
  register describes as the one read with no upper bound, streamed precisely because it can be large.
  A real audit export will be killed by the client at five seconds.

**Fix:** three separable steps, in order — (1) single-flight refresh and a per-request timeout
override, small and independent; (2) one data-fetching layer (RTK Query is the natural fit, the store
is already Redux Toolkit) so caching, dedup and cancellation exist once instead of 22 times; (3) move
list reads into server components where the httpOnly cookie is already available. Step 2 is what
retires PM-30 by construction.

---

### PM-42 — The API contract is hand-copied into TypeScript

`frontend/types/index.ts` is 161 lines of interfaces mirroring `backend/app/schemas/`. Nothing
connects them. FastAPI publishes an accurate OpenAPI document at `/openapi.json` and the frontend
re-types it by hand.

The failure mode is the quiet one: a backend field renamed or made optional produces a
`tsc --noEmit`-clean frontend that reads `undefined` at runtime. Types that agree by convention give
the *appearance* of an enforced contract, which is worse than no types, because it stops anyone
looking.

### ✅ Resolved 2026-08-06

**Three layers, each of which catches drift on its own.** Verified by injecting a real backend change
and confirming all three failed independently, then reverting.

| Layer | Catches | Fails with |
|---|---|---|
| `python -m app.tools.export_openapi --check` | The committed `backend/openapi.json` no longer matches the routes | *"openapi.json is out of date — the routes have changed"* |
| `npm run codegen:check` | `types/api.d.ts` is stale against the spec, **or is not committed** | *"types/api.d.ts is stale — the API changed"* |
| `types/api-contract.ts` + `tsc` | The hand-written types disagree with the generated ones | `["API sends fields the UI has not modelled:", "injected_field"]` |

**The spec is exported statically, not fetched from a running server.** `app.openapi()` builds the
document from the route definitions, so CI regenerates and compares it **without standing up
Postgres** — and generation stays reproducible from a checkout alone. A build that reaches for a
running backend fails on a laptop with the stack down and, worse, silently generates types from
whatever version happens to be running.

**The hand-written types were kept, not replaced.** `openapi-typescript` generates from Pydantic, which
types several fields more loosely than the UI wants — `account_type` is `string` there and
`"staff" | "partner"` here, because the column is a SQLAlchemy `Enum` that Pydantic serialises as
`str`. Replacing them wholesale would throw away every narrowing, and with them every exhaustive
`switch`. So `types/api-contract.ts` asserts **key-set equality in both directions** instead, plus
one-way assignability for the deliberately narrowed fields.

Both directions matter. A field the backend **removed** is the obvious case; a field the backend
**added** is the one usually missed, and without the second assertion it stays invisible to the
frontend forever — which is how a feature ships half-wired.

The assertions return a **tuple naming the offending key** rather than `false`, because
`Type 'false' does not satisfy the constraint 'true'` tells you nothing.

#### The drift it found on its first run

`CurrentUser.two_factor_enabled` was declared in the frontend and **`/auth/me` never sent it** —
`CurrentUserResponse` omitted it while `UserListItem` had it. Anything reading it off the current user
would have got `undefined`. Fixed on the backend rather than by deleting the field, because the model
property's own docstring says it is named for direct serialisation by schemas, so the omission was
accidental.

That is precisely the failure this item describes: **a `tsc`-clean frontend reading `undefined` at
runtime.** It existed, nobody had noticed, and the guard found it in under a minute.

#### One flaw in the guard, found by testing it

The first `codegen:check` was `npm run codegen:api && git diff --exit-code -- types/api.d.ts`.
**`git diff` is blind to an untracked file**, so while `api.d.ts` was new the check passed
unconditionally — a guard that reports success without checking anything, in exactly the state it
shipped in. Now `git ls-files --error-unmatch` catches "not committed" and `git diff` catches "stale",
as two separate conditions with distinct messages. It stays tolerant of *staged but not yet committed*
so it does not block someone mid-commit; CI checks out committed files, where both are exact.

#### Adding a response type

Add a line to `types/api-contract.ts`. **A schema with no assertion is a schema that can drift** — the
guard only covers what it is pointed at, currently `CurrentUser`, `ManagedUser`, `RoleSummary` and
`Branding`.

---

### PM-43 — Two purge functions exist and nothing runs them

| Function | Deletes | Called by |
|---|---|---|
| `session_service.purge_expired(older_than_days=30)` | `user_sessions` rows past use | nothing |
| `activity_service.purge_older_than(days)` | `activity_log` rows | nothing |

Both are correct, careful, and dead. `purge_older_than` even guards a non-positive `days` so a stray
`0` cannot destroy the audit trail, and returns 0 rather than crashing on an absurd value — a guard
found by passing `999999` and getting `OverflowError`. That care is wasted on a function with no
caller.

Meanwhile `user_sessions` gains **one row per sign-in, kept forever**, and it is on the hot path:
`get_current_user` does `db.get(UserSession, sid)` on every authenticated request. A primary-key
lookup does not care how large the table is, but backups, `VACUUM` and the active-sessions screen all
do.

The register is right that *how long* to keep audit history is a policy decision, not a constant. But
"we have not decided the retention window" and "nothing can ever delete anything" are different
states, and the second one is not implied by the first.

### ✅ Resolved 2026-08-06

`python -m app.db.maintenance` — a command, not a scheduler, meant for a cron line:

```bash
15 3 * * *  docker compose run --rm backend python -m app.db.maintenance
```

**Sessions and the audit trail are treated differently, and that asymmetry is the design.** Expired
sessions are *expired*, so clearing them at 30 days is housekeeping and runs by default. Trimming the
audit log requires `--activity` **explicitly**: retention is a policy decision, and deleting evidence
should be an instruction rather than something a cron line does because a default said so. A test
asserts that default, because it is the one worth protecting.

`--dry-run` reports without deleting, backed by `count_purgeable` on both services. Both the count and
the delete route through one `_purge_cutoff` helper, so a dry run cannot preview a different set of
rows from the delete it preceded — asserted rather than assumed.

**Verified against the running stack:** dry run reported `0 sessions` / `73 audit rows`; the real run
deleted 0 sessions and left the trail alone; `--activity --activity-days 0` was **refused** ("Retention
must be a positive number of days") rather than read as "everything"; and `--sessions-only` overrides
`--activity`, resolving a contradictory invocation toward deleting less.

---

### PM-44 — Three pieces of state live in process memory

| State | Where | What breaks at 2 workers |
|---|---|---|
| Rate-limit counters | `core/rate_limit.py`, in-process dict | Every limit multiplies by N; a restart clears them |
| Nothing else is cached | — | Every request re-reads roles and permissions from Postgres |
| Email sending | `mail_service`, synchronous in-request | A slow relay holds a worker for up to `SMTP_TIMEOUT_SECONDS` |

The rate-limit half is already recorded honestly under PM-26 *Still open* — "honest for the current
single-container deployment, wrong the moment the API scales horizontally." This entry adds the two
next to it, because they have the same answer and the same trigger.

The trigger is the first `gunicorn -w 4`. Not a rewrite — the moment a second worker exists, all
three change behaviour, and the rate limiter changes it in the direction that matters (a limit of 10
becomes 40).

To be precise about what is *not* a problem: RBAC reads are cheap by design. `roles` and
`role.permissions` are both `lazy="selectin"`, so a permission check is two extra queries and never
N+1, and `session_service.touch` is throttled to one write per five minutes rather than a write per
request. Both of those are already right. The gap is that there is no shared cache to put them in when
Postgres becomes the bottleneck — not that they are currently slow.

**Fix:** one Redis dependency, introduced with the production topology (DEPLOYMENT § 1) rather than
before it. It solves rate limiting, gives email a queue, and gives sessions a cache — in that order of
value. **Do not add it while the deployment is a single dev container**; it would be infrastructure
serving no current need.

---

## 3. Recommended order

Sequenced by *what unblocks what*, not by severity.

| # | Item | Status / why here |
|---|---|---|
| 1 | **PM-37** config validation | ✅ Done. Converted 7 remembered rules into assertions. |
| 2 | **PM-38** transaction boundary | ✅ Done. Had to land **before** PM-5's scoped writes. |
| 3 | **PM-39** tests + CI | ⏳ Floor laid — **217 tests** and a CI workflow. Not coverage. |
| 4 | **PM-40** `/api/v1` | ✅ Done. Was cheapest now; unblocks PM-42. |
| 5 | **PM-43** purge entry point | ✅ Done. Small and independent. |
| 6 | **PM-25** React/Next decision | ✅ Done 2026-08-07 — React 18.3.1. **Decided by the code, not by us:** React 19 broke Next 14's App Router runtime and sign-in with it. Did *not* block PM-30 after all. |
| 7 | **PM-42** OpenAPI codegen | ✅ Done. Found a live drift on its first run. |
| **8** | **PM-41** data layer | Largest item here. Retires PM-30 by construction. **Now the biggest open build item**, and PM-25 no longer stands in front of it. |
| 9 | **PM-5** row-level scoping | The gate in front of the marketplace domain. Items 1–4 now make it verifiable. |
| 10 | **PM-44** Redis | With the production topology, not before. |
| 11 | **PM-10** monitoring | With the production topology. Needs somewhere to send to. |

**PM-42 moved ahead of PM-41.** It was blocked on PM-40, which is now done, and it is a fraction of
PM-41's size while removing a whole class of silent failure — a renamed backend field currently
produces a `tsc`-clean frontend that reads `undefined` at runtime. Doing it before the data-layer
rewrite also means that rewrite is typed against a generated contract rather than a hand-copied one.

**PM-5 sits at 8 deliberately.** It is the register's highest open priority and the marketplace's hard
prerequisite, and it is the single change most likely to leak data across tenants. Writing it before
PM-38 means writing scoped multi-table updates with no transaction boundary; before PM-39 means
writing them with no way to prove they scope. Items 1–4 are three days of work that make item 8
verifiable. That ordering is the main recommendation in this document.

---

## 4. What has been implemented

Recorded here, and in [`../DAILY_CHANGES.md`](../DAILY_CHANGES.md) for 2026-08-06.

### PM-37 — `APP_ENV` and startup validation ✅

`core/config.py` gains `APP_ENV` and a `model_post_init` validator that raises on an unsafe
combination. Non-production is unaffected — every existing local default still boots unchanged.

In `production` the following are refused, with the fix named in the message:

| Refused | Because |
|---|---|
| `SECRET_KEY` shorter than 32 chars, or a known dev placeholder | A guessable key forges a token for any account |
| `COOKIE_SECURE = False` | Session cookies would travel in cleartext |
| `MAIL_BACKEND = "console"` | Writes password-reset links — live credentials — to the log |
| `MAIL_BACKEND = "smtp"` with no `SMTP_HOST` | Every send fails |
| A `localhost` entry in `CORS_ORIGINS` | Allows a developer machine to call production with credentials |
| `LOG_FORMAT = "console"` | Multi-line tracebacks defeat the aggregator |
| `RATE_LIMIT_ENABLED = False` | Removes the only per-IP control |
| `ALGORITHM = "none"` | Unsigned tokens |

Warnings rather than refusals, because both are legitimate choices: `HSTS_ENABLED = False`
(the TLS terminator may set it) and `TRUST_PROXY_HEADERS = False` (correct without a proxy — and
enabling it *without* one is the measured bypass in PM-26, so this must never be auto-corrected).

**Why refuse rather than log.** A warning in a startup log is read once, by whoever deployed, if they
scroll. The whole point of PM-2 and PM-4's history is that a written-down rule about configuration is
not a control.

**All problems are reported at once, not the first one.** Otherwise an eight-item checklist becomes
eight failed deploys.

#### The bug the tests found in this feature, one hour old

The first version matched placeholders by **equality**. `"changeme" * 4` is 32 characters, so it cleared
the length floor, matched no placeholder, and **would have signed production tokens.** The test written
to prove the two rules were independent is what caught it.

Two changes followed: placeholders are matched as a **substring** (for strings distinctive enough that a
random key containing one is ~1 in 10¹², with short generic words like `dev` kept to exact match because
a random key containing `dev` is ~1 in 6000 and a false refusal is a confusing outage), and a
**distinct-character floor** of 12 sits behind it for a repeated string nobody thought to blocklist.
`secrets.token_urlsafe(48)` yields around 35 distinct characters; `"changeme" * 4` yields 8.

Worth stating plainly: **the length floor alone is not a control.** It is trivially defeated by
repetition, and that is not an obscure case — a key built by repeating a word is exactly what someone
produces when told "make it at least 32 characters".

#### Verified 2026-08-06, against the running container

| Check | Result |
|---|---|
| Real `.env` + `APP_ENV=production` | **Refused**, 5 problems listed — and it caught that **this project's own development `SECRET_KEY` contains a placeholder string** |
| A fully correct production config | **Booted**, `is_production = True`, with the 2 expected warnings |
| Development defaults untouched | `/health/ready` reports the database reachable; OpenAPI still serves 58 operations across 47 paths |
| `"changeme" * 4` (32 chars) | Refused as a placeholder |
| `"ab" * 20` (40 chars, 2 distinct) | Refused as a repeated pattern |
| 20 × `token_urlsafe(48)` | All accepted — the floor does not reject what the error message tells you to generate |

### PM-38 — Transaction boundary ✅

Three changes, smallest possible:

1. `get_db` rolls back on exception before closing. Explicit, so a failed request's session state is
   ended by intent rather than as a side effect of `close()`.
2. `db/session.py` gains `unit_of_work(db)` — a context manager that commits on success and rolls back
   on any exception, for flows writing more than one table.
3. The 49 existing single-write commits are **left alone**. They are correct, and rewriting them all
   would be a large diff with no behaviour change and real risk. `unit_of_work` is for new multi-write
   flows and for the ones PM-5 is about to add.

`activity_service` stays outside every boundary, deliberately and as documented — an audit write must
never be able to fail the operation it records.

### PM-39 — Test suite and CI ⏳ floor laid, not coverage

**74 tests, 4 skipped, `ruff check .` clean.** Files: `backend/pyproject.toml` (pytest + ruff),
`backend/requirements-dev.txt`, `backend/tests/conftest.py`, four test modules, and
`.github/workflows/ci.yml`.

| Module | Property, and why this one |
|---|---|
| `test_token_types.py` | **The full 4×4 token-kind matrix**, minus the diagonal. Enumerated from a dict rather than hand-written pairs, so a *fifth* token type is covered automatically — the failure mode being guarded is a new kind added without the `type` assertion, and a hand-written list would leave exactly that untested |
| `test_refresh_rotation.py` | All four `RefreshOutcome` branches, the grace-window boundary, and that `UNKNOWN` never collapses into `REUSED` — the two have opposite consequences (refuse a request vs. destroy a session) |
| `test_password_hashing.py` | PM-1's regression, including that a Google account with `password = NULL` cannot authenticate with `""` — which a `stored == plain` comparison would allow |
| `test_config_environment.py` | Each PM-37 rule separately, plus the valid-production case **first**, because a validator that rejects everything is trivially "safe" and useless |

**No database.** `create_engine` opens no socket, so these run anywhere. `conftest.py` sets the
environment before importing `app.*` — load-bearing, because `app.core.config` builds `Settings()` at
module scope, and without it every CI run fails at collection with a Pydantic error that looks like a
broken suite rather than a missing `.env`. A `db` marker exists for the first test that needs one.

Two deliberate compromises in CI, both marked for deletion in the file. **One is now obsolete:**

- ~~`npm ci --legacy-peer-deps`~~, mirroring `Dockerfile.dev`, because plain `npm ci` **failed outright**
  on React 19 against Next 14's peer range. **PM-25 was resolved 2026-08-07** (React 18.3.1) and the tree
  resolves strictly, so the flag can go — and should, since it would now hide a genuine `ERESOLVE`.
- `npm run lint` is `continue-on-error`, because it reports PM-30's 20 react-hooks errors today. A red
  CI nobody can turn green is a CI nobody reads. This one stays until PM-41.

**Not claimed as complete.** This is a floor over three properties. It does **not** touch RBAC
enforcement across the 56 routes — which is the suite **PM-5** needs, and the reason PM-11 stays open.

### PM-41 step 1 — the refresh race and two client-side traps ✅

Not the data layer (that is still open), but three contained fixes in `lib/api/`:

- **Single-flight refresh.** One shared promise instead of N concurrent `POST /refresh` calls. The old
  behaviour worked *only* because the backend's 30-second rotation grace window absorbed the losers —
  a window added for concurrent browser *tabs*. A correctness property of the client was resting on a
  backend tolerance it never asked for, and narrowing that window would have started revoking sessions
  under load: reuse detection kills the whole session, so the symptom is users signed out at random,
  which is close to undiagnosable from the frontend.
- **`LONG_TIMEOUT_MS` exported** for `GET /api/activity/export`, the one read with no upper bound. At
  the 5s global default the client killed a working export of any real size, and the failure looked
  like a server problem.
- **`API_BASE_URL` defaulted to port 8000; the API runs on 8002.**

### A linter incident, recorded because it nearly did real damage

The first ruff config used `exclude` rather than `extend-exclude`. `exclude` **replaces** ruff's
built-in list instead of adding to it, so it linted `backend/.venv` — the dead virtualenv from PM-23 —
and reported **32,488 errors across 1,256 files**.

Before that was noticed, `--fix` reordered the imports in `app/db/migrations/env.py`, a **protected
file**, and hoisted an import above the comment reading *"EVERY model must be imported here or
--autogenerate cannot see it, and may emit a migration that drops its table."* Detaching that warning
from the list it governs is precisely the quiet damage a formatter can do to a comment that is doing
real work. The whole `app/db/migrations` tree is now excluded, with that reason written in the config.

**⚠️ Reverting it with `git checkout` also discarded an uncommitted change that file held at the start
of the session, and unstaged working-tree content is not recoverable.** The file now matches `HEAD` and
is functionally correct — all 8 model imports resolve, no deleted model is referenced, `alembic heads`
reports the single head `c1e70a5d94b2`. The captured diff was a pure 24-line permutation, so the lost
change appears to have been import ordering only. That is an inference, not a certainty: **check
`backend/app/db/migrations/env.py` before committing.**

Also settled while turning linting on: `B008` is ignored because 140 of the 158 first-run findings were
FastAPI's `Depends()` idiom, and `B904` because all 7 sites raise a **pre-built** exception object —
two of them module-level singletons, where `from err` would set `__cause__` on an instance other
requests are raising.

---

## 5. Related

- [`TECH_DEBT.md`](./TECH_DEBT.md) — PM-1 … PM-36; verify against code before acting on any of them
- [`MARKETPLACE_DOMAIN_PLAN.md`](./MARKETPLACE_DOMAIN_PLAN.md) — what PM-5 is a prerequisite for
- [`../system-design/DEPLOYMENT.md`](../system-design/DEPLOYMENT.md) § 0 — the config table PM-37 enforces
- [`../core/AUTHENTICATION.md`](../core/AUTHENTICATION.md), [`../core/AUTHORIZATION.md`](../core/AUTHORIZATION.md)
