# LeapDesk Core Parity Plan

**Status: IN PROGRESS — the module count is now 18 + Recycle Bin.** Spec below is unchanged except
where a decision has been settled; see § Progress for what is actually built.

> **Modules 11–18 were added on 2026-08-11** — Configuration, Security, Feature Flags, Webhooks, API
> Documentation, Queue Monitor, Error Tracking, System Health, plus Recycle Bin. They are a **different
> kind of module** from 1–10: operations surfaces that observe or configure the running system, not
> business objects a user authors. Read
> [§ Modules 11–18](#modules-1118--the-platform-operations-tier--researched-2026-08-11) before assuming
> the Users CRUD shape applies to them — for six of the nine, it does not.
>
> ---
>
> Scope was settled on 2026-08-04: replicate LeapDesk's **core admin shell** — the modules in its
> two lower sidebar sections, plus the self-service Settings area — in Partner Marketplace's stack.
> The marketplace domain ([`MARKETPLACE_DOMAIN_PLAN.md`](./MARKETPLACE_DOMAIN_PLAN.md)) is **parked**
> until this lands.
>
> Planning docs are reference only — once code exists, the code is the truth. Everything below was read
> from LeapDesk source at `/opt/lampp/htdocs/LeapDesk` on 2026-08-04, not from memory.
>
> **The scope grew on 2026-08-10.** LeapDesk shipped a tenth module — **Platform API** — on 2026-08-09,
> five days after this plan was written. It was researched and specced on 2026-08-10 against LeapDesk
> source and its own tracker; see [§ Module 10](#module-10--platform-api--entirely-new-added-to-the-reference-after-this-plan-was-written).
> Nothing about it is built here. A reference that is still under active development will do this
> again, so treat this plan's module list as a snapshot with a date, not a fixed set.

---

## Progress

**Last worked: 2026-08-04.** Five commits, `0054e64` → `807ab65`. Per-change detail is in
[`../DAILY_CHANGES.md`](../DAILY_CHANGES.md); this is the map.

| # | Module | State |
|---|--------|-------|
| 1 | **Settings** (Profile / Password / Appearance) | ✅ **Done.** OTP recovery verified 13/13 end to end. One decision open — see below |
| 4 | **Navigation** (server-driven + per-role collapse) | ✅ **Done** end to end; Sidebar consumes the tree |
| 2 | Invitations admin index | ✅ **Done 2026-08-11** — index, bulk create, stats, cooldown. This row read "nothing committed" until the 2026-08-12 audit; it had shipped |
| 3 | Users `user-email`; Roles matrix / clone / role-users / route split | ✅ **Done — completed 2026-08-12.** Matrix, clone, role-users and `user-email` had already shipped and were mismarked. Closed on 2026-08-12: attachments on `user-email` (magic-byte validated) and § 3e, `PUT /roles/{id}/permissions` as its own route — which found `security.audit.permission_changes` reading nothing and wrote the missing audit entry |
| 6 | Activity Log parity gaps | ✅ **Done 2026-08-12** — `source` stamped on write and filterable, module labels, clickable subject URLs, causer-name search, sort, scoped filter options, and the causer sandbox on both the list and the export. `tinker`/`job` deliberately not ported |
| 5 | Data Access | ✅ **Done 2026-08-11** (parallel agent) — grants, scoping helpers, admin screen at `/dashboard/data-access` |
| 7 | API Credentials | ✅ **Done 2026-08-11** (parallel agent) — 4 tables, Fernet at rest via the existing HKDF path, masked by default, startup self-test. Unblocks module 9 |
| 8 | Global Search | ✅ **Done 2026-08-11** (parallel agent) — configurable entities, model+field allowlists probed against hostile input, search logging |
| 9 | AI Assistant | ✅ **Done 2026-08-12** — 3 tables, 3 tools, permission-gated tool registry, a read-only connection Postgres enforces, output guard, chat widget + settings screen. Off by default. **The model call itself is unproven** — no valid API key exists here, so everything up to and including the network request is verified and a real answer is not. `tinker`/`job` sources and the QMAS pricing tools are deliberately not ported |
| 10 | **Platform API** (machine consumers + tokens) | ✅ **Part I done 2026-08-12** — 3 tables, SHA-256 token hashing, the `active` kill switch ahead of the token, six logged rejection reasons behind one 401, a retention policy, and the `Principal` union this plan asked to be introduced once. **Part II (the resource engine) deliberately not ported.** Nothing accepts a token yet — the gate is written and tested, waiting for the first machine-facing endpoint |
| 11 | **Configuration** (settings registry) | ✅ **Done 2026-08-11** — table, service, 2 endpoints, seeder, screen. 10 settings registered. Gates 12 and 13, which are now unblocked |
| 12 | **Security** (`security.*` settings) | ✅ **Done 2026-08-11** — namespace-guarded router, tabs per group, audit panel over `auth` + `settings`. Found and did not copy a reference bug that hides two of its own settings |
| 13 | **Feature Flags** | ✅ **Done 2026-08-11** (parallel agent) — full CRUD + toggle, role/user targeting, unknown key is OFF |
| 14 | **Webhooks** | ✅ **Done 2026-08-12** — 2 tables, HMAC-SHA256 over `{timestamp}.{body}`, backoff `[30,120,600]`, 4xx-permanent/5xx-retried, circuit breaker, delivery log with redeliver, secret rotation. **Adds an SSRF guard the reference has no equivalent of.** Two limits: no call site emits the four events yet, and delivery is inline because there is still no queue |
| 15 | **API Documentation** | ✅ **Done 2026-08-12** — a reader over the live route table rather than a second registry, showing the **permission that gates each route**, which OpenAPI cannot express for us. Turned into a guard rail: a test fails if any route is reachable with no auth and no permission and is not on an explicit list of the seventeen that are public by necessity |
| 16 | **Queue Monitor** | 🚫 **Blocked — we have no queue.** Not portable until something runs in the background |
| 17 | **Error Tracking** | ✅ **Done 2026-08-11** — fingerprinting, regression reopen, recorder wired into the 500 handler, triage screen |
| 18 | **System Health** | ✅ **Done 2026-08-11** — database, storage, errors live. Queue and provider panels report **not configured** rather than a fake zero |
| — | **Recycle Bin** | ✅ **Done 2026-08-11** — soft deletes on 4 tables, allowlisted restore/purge, every auth and scoping path filtered |

### Re-audited 2026-08-11 — measured, not inherited

The block that used to sit here warned its own rows were stale and asked for a re-audit before anyone
started from them. **That audit is this section.** Everything below was measured against the running
system on 2026-08-11; the numbers the old block flagged as wrong are corrected.

| Claim as it stood | Measured 2026-08-11 |
|---|---|
| "Permissions: 0 of 14" | **43 permission constants in `permissions.py`, 43 rows in the database** — the two agree |
| "34 permissions live in the database" | **43.** The partner directory added nine on 2026-08-10 |
| "Migrations: 2 of 7", head `f5a3c81b7d29` | Head is **`b3d7e02f4c19`**. Two more landed since: `a9f2c71e5b64` (partners) and `b3d7e02f4c19` (user status) |
| Modules 2, 3, 5, 6 "not started" | All four have shipped work. See the routers below |

**Routers that exist** (`backend/app/api/`): `auth`, `google`, `users`, `roles`, `permissions`,
`invitations`, `activity`, `navigation`, `settings`, `partners`. **Ten.** No router exists for data
access, API credentials, global search, the AI assistant, the platform API, or any of modules 11–18.

> **Superseded 2026-08-12.** That sentence was true when written and is now wrong in both halves:
> there are **21 routers** and 124 operations, including `data_access`, `api_credentials`, `search`,
> `configuration`, `security_settings`, `feature_flags`, `errors`, `health_status` and
> `recycle_bin`. What has **no** router is the AI assistant (module 9), the platform API (10),
> webhooks (14) and API documentation (15). Left in place rather than rewritten, because the point
> of the paragraph below it — that a ⬜ in this table means "nobody ticked it", not "nobody built
> it" — is exactly what the 2026-08-12 audit proved again.

**Frontend index modules that exist and are on the shared shape:** Users, Roles, Invitations, Activity
— all four brought to parity on 2026-08-11, see [`MODULE_PARITY_PLAN.md`](./MODULE_PARITY_PLAN.md).

> **What this re-audit does not do is re-verify the *quality* of modules 2–6 against their specs
> below.** It establishes that code exists and that the permission and migration counts are right. Each
> module's gap list — the Roles matrix, the Activity Log's four filters, the invitation cooldown — was
> **not** re-checked line by line, and the ⬜/✅ marks in the table above predate that work. Treat them
> as "something landed here", not as "this spec is satisfied".

### Correction — the Activity Log has no over-exposure

Working notes during this session claimed that anyone holding `activity-view` reads the
whole organisation's audit trail, called it live, and used it to reorder the queue. **That
was wrong on both counts**, and it is recorded here because it affected decisions:

- `activity-view` is held only by **Admin, RootUser and SuperAdmin** — verified against the
  seeded matrix. All three are `has_admin_access` roles, which is exactly who LeapDesk's
  `$viewAll = has_admin_access()` grants full visibility. The two systems behave
  **identically** today; no non-admin role can reach the endpoint.
- The non-scoping is **deliberate and documented** in `list_entries`' docstring, which also
  names itself as the query to revisit when PM-5 lands.

Module 6 therefore drops to ordinary priority: `source` filter (needs write-side stamping
first), `hide_system`, module labels, clickable subject URLs, and the causer sandbox as
**defence in depth** so behaviour stays correct if a non-admin role is ever granted
`activity-view`.

### Decisions settled while building

| Decision | Taken | Where it shows |
|---|---|---|
| Permission naming | LeapDesk's dotted names verbatim | Not yet exercised — no new permissions seeded |
| Password OTP grace | `users.password_otp_verified_at` + two sibling columns | `e2b8d5c31f47` |
| `role-permissions` as its own route | Still pending — deferred to module 3 | — |
| 2FA in the settings sub-nav | Left out, matching LeapDesk | `SettingsNav.tsx` |
| Self-delete on profile | Not built; contradicts PM's protection rules | — |
| Nav preference backfill | **Diverges from LeapDesk** — nothing backfilled, NULL means use code defaults | `f5a3c81b7d29` |
| OTP storage | **Diverges from LeapDesk** — hashed, not plaintext | `auth_service` |

### Still open — one of these blocks calling module 1 finished

1. **Profile email: editable (LeapDesk parity) or read-only (PM's rule)?** Currently
   read-only with the reason shown inline, because changing it breaks the Google account
   and invitation links. LeapDesk edits it and clears the verification stamp. **Module 1
   is not truly "done" until this is settled.**
2. **`.claude/settings.json`** — commit it or keep it out of the public repo? Still the
   only untracked file. `settings.local.json` is already gitignored.
3. The five product questions in `MARKETPLACE_DOMAIN_PLAN.md` § Still Open remain parked
   with that plan.

### Known-unverified

**Nothing built this session has been clicked in a browser.** Routing, typecheck, lint and
`next build` are green, and the OTP flow is verified at the API. But the profile card, edit
form, appearance tabs and the whole sidebar are client components gated on the hydrated
store — absent from server HTML *by design*, so fetching HTML cannot confirm them.
Confirming them needs the Chrome-DevTools-Protocol harness used on 2026-07-31. This is the
single largest gap in confidence right now.

---

## Why these eight modules

The list isn't arbitrary. LeapDesk's `NavigationService` builds seven sidebar sections; the last two are
exactly this scope, and the Settings area is the user-menu counterpart:

| LeapDesk sidebar section | Items | Permission |
|---|---|---|
| **User Management** (collapsible) | Users → `/users` | `user-view` |
| | Roles → `/roles` | `role-view` |
| | Data Access → `/roles/data-access` | `data-access.view` |
| | Activity Log → `/activity-log` | `activity-view` |
| **System Settings** (collapsible) | API Credentials → `/api-credentials` | `api-credentials.index` |
| | Invitations → `/invitations` | `invitation-view` |
| | Global Search → `/settings/search` | `search.entities.manage` |
| | **Platform API** → `/settings/api/consumers` | `api.consumers.index` |
| | AI Assistant → `/settings/ai-assistant` | `api-credentials.index` |

Source: [`app/Services/NavigationService.php:211-226`](/opt/lampp/htdocs/LeapDesk/app/Services/NavigationService.php).
**Platform API was added to that method on 2026-08-09** and is why the count moved from eight to nine
items across the two sections, and from nine modules to ten here.
The **Settings** area (`/settings/profile`, `/settings/password`, `/settings/appearance`) is a separate
layout with its own sub-nav — heading "Settings", description "Manage your profile and account settings".

**Two-Factor Auth is deliberately commented out of LeapDesk's settings nav** even though the route
exists (`layout.tsx:29-33`). PM already has 2FA working; keep it out of the settings sub-nav to match,
or surface it — that's an open decision below.

---

## Translation rules

LeapDesk is Laravel 12 + Inertia + Spatie Permission + Fortify. PM is FastAPI + REST + a Next.js client.
Behaviour, data model, permission semantics and UX are replicated exactly. Architecture is translated.
These mappings apply to every module and are not restated per-module:

| LeapDesk | Partner Marketplace |
|---|---|
| Controller method | Thin router in `backend/app/api/` + logic in `backend/app/services/` |
| `Route::middleware('can:x')` | `Depends(require_permission(X))` — appears in OpenAPI |
| Inertia page + props | Client component + a typed `lib/api/*.ts` call |
| Eloquent model | SQLAlchemy 2 typed declarative model |
| `FormRequest` validation | Pydantic v2 request schema |
| Blade/Inertia flash message | `MessageResponse` + the existing `Toast` component |
| `Str::slug`, `data_get`, helpers | Explicit Python — no helper layer |
| Spatie `HasRoles` | PM's existing `roles` relationship + `has_permission()` |

**Four things do not survive the translation intact.** Each needs a decision, flagged in place below:

1. **Session state.** LeapDesk's password-OTP flow stores `otp_reset_pending_grace` in the session. PM is
   stateless JWT — no session bag exists.
2. **`Cache::remember`.** `CredentialManager` and `GlobalSearchRegistry` cache in Laravel's cache store.
   PM has no Redis (compose is `db` + `adminer` + `backend` + `frontend`).
3. **Laravel Scout.** Global Search uses Scout with `SCOUT_DRIVER=database` — SQL `LIKE`, no external
   engine. Ports to Postgres directly.
4. **`Laravel\Ai` package.** The AI Assistant uses Laravel's AI agent abstraction. PM needs the
   Anthropic Python SDK's tool runner instead.

---

## Permission naming — a convention split to resolve

LeapDesk's own [`AUTHORIZATION.md:856-887`](/opt/lampp/htdocs/LeapDesk/documentation/core/AUTHORIZATION.md)
documents `{resource}-{action}`, singular, kebab-case — which is exactly what PM already uses. But its
**newer modules ignore that doc** and use dotted namespacing. Extracted from
`database/seeders/PermissionSeeder.php`:

| Style | Permissions |
|---|---|
| `{resource}-{action}` (matches PM) | `user-view/create/update/delete/email`, `role-view/create/update/delete`, `role-permissions`, `invitation-view/create/resend/cancel`, `activity-view`, `dashboard-view`, `settings-view/update` |
| **Dotted** (diverges) | `data-access.view`, `data-access.manage`, `api-credentials.index`, `api-credentials.providers.{index,create,edit,delete}`, `api-credentials.credentials.{index,create,edit,delete}`, `search.entities.manage`, `ai-assistant.use`, `ai-assistant.query-database`, and — added 2026-08-09 — `api.consumers.{index,create,edit,delete}`, `api.tokens.manage` |

> ### ✅ Settled in code on 2026-08-07 — **normalised**, not verbatim
>
> This section's recommendation (*"adopt LeapDesk's names verbatim"*) was **not** what shipped, and
> `git` is the truth here. `backend/app/core/permissions.py` defines the new permissions in PM's own
> `{resource}-{action}` convention — `data-access-view`, `api-credential-view`, `search-entity-manage`,
> `ai-assistant-use` — and carries a reversible reference→ours mapping table in comments so a future
> LeapDesk port still has one. **34 permissions are seeded in the database.**
>
> That file's own comment already notes this document contradicts itself — § Decisions settled records
> "dotted names verbatim" while § Open decisions still lists the question as open, so neither line
> settled anything. **The code did.** Both places are corrected here; Module 10's five permissions
> follow the same convention.

Also note: LeapDesk has **no `permission-view`** and **no `user-approve`**; PM has both. Keep PM's — they
gate real endpoints that LeapDesk gates differently.

---

## Module 1 — Settings (Profile / Password / Appearance)

**PM state:** backend complete; frontend has no `/settings` route group at all. Profile, 2FA and active
sessions are crammed into one `/dashboard/profile` view driven by a section switch in
[`DashboardClient.tsx`](../../frontend/app/dashboard/DashboardClient.tsx). **Change-password has a
working endpoint and no UI.**

### The good news: no migration needed

PM's `users` table already carries **every** field LeapDesk's profile form edits — verified against
[`backend/app/models/user.py:69-100`](../../backend/app/models/user.py): `first_name`, `last_name`,
`designation`, `employee_id`, `personal_mobile_number`, `personal_email`, plus
`profile_photo_path`, `company_name`, `account_type`, `timezone_preference`, `sidebar_preference`.

### Routes to build

| LeapDesk route | PM route | Notes |
|---|---|---|
| `GET /settings` → redirect `/settings/profile` | same | |
| `GET|PATCH /settings/profile` | `/settings/profile` + existing `PATCH /api/v1/auth/me` | |
| `GET|PUT /settings/password` | `/settings/password` + existing `POST /api/v1/auth/me/change-password` | **UI is the whole gap** |
| `POST /settings/password/otp/send` \| `/verify` | new | see OTP note below |
| `GET /settings/appearance` | `/settings/appearance` | |
| `DELETE /settings/profile` (self-delete) | **skip** | see below |

### Profile page anatomy (replicate exactly)

Two cards, per [`pages/settings/profile.tsx`](/opt/lampp/htdocs/LeapDesk/resources/js/pages/settings/profile.tsx):

1. **ID card** — 64px initials avatar with a green check badge when `status === 'ACTIVE'`; full name;
   designation (falling back to "Partner"/"Employee" by role); role badges; a status pill. Below it a
   1/2/3-column info grid: Employee ID (mono), Email, Personal Email, Mobile (mono), Member Since —
   each row conditional on the value being present.
2. **Edit Profile form** — `first_name`/`last_name` row, `email` row, `employee_id`/`designation` row,
   `personal_email`/`personal_mobile_number` row, an amber unverified-email banner with a resend link,
   then a footer with Save and a fading "Saved successfully." transition.

**Partner-role users see the ID card only** — the whole edit form and the employee fields are hidden,
and `ProfileUpdateRequest::authorize()` returns `false` for them, so the API refuses too. Replicate both
halves; a UI-only hide is not parity.

**Skip self-delete.** LeapDesk renders a `DeleteUser` card. PM's `user_service` already forbids
self-delete as a protection rule (ported 2026-07-31) — adding a self-delete endpoint would contradict a
deliberate decision. Flag rather than build.

### Password page + the OTP-recovery translation

LeapDesk lets a signed-in user who *doesn't know* their current password prove email ownership by OTP
and then set a new one — covering post-OTP-login partners, SSO users with no fallback password, and
plain forgetfulness. Flow: `POST otp/send` (60s cooldown, 6-digit code, 10-minute expiry, emailed) →
`POST otp/verify` → sets `otp_reset_pending_grace` in the session →
`PasswordUpdateRequest` **skips the `current_password` rule** while that flag is set →
`PasswordController@update` clears it on success.

`password_reset_otps` table: `id`, `email` (indexed), `otp` char(6), `verified` bool, `expires_at`,
timestamps.

**⚠️ Translation decision.** PM has no session. Three options:

| Option | How | Trade-off |
|---|---|---|
| **A. Column on `users`** (recommended) | `password_otp_verified_at TIMESTAMPTZ NULL`; treat non-null and < 10 min old as the grace window; clear on password change | One nullable column; survives restarts; auditable |
| B. Reuse `password_reset_token` | Issue a short-lived token at verify, require it on change-password | No migration, but overloads a column with two meanings |
| C. Short-lived JWT | Mint a scoped `pwd_grace` token | Statelessly pure; another token type to reason about |

PM already has `pyotp` and a mail service, so the OTP half needs no new dependency.

### Appearance page

`AppearanceTabs` — a three-way segmented control, Light / Dark / System, each with a lucide icon
(`Sun`/`Moon`/`Monitor`). PM's `ThemeToggle` is a two-state toggle with `localStorage` persistence and
an OS fallback already; it needs a **System** state added and re-housing as a tabbed control.

---

## Module 2 — Users (gap: `user-email`)

PM is at parity except LeapDesk's ad-hoc email-to-user action.

`POST users/send-email`, throttled `5,1`, permission `user-email`. Validates `recipient_email`,
`recipient_name`, `subject`, `message` (all required), `bcc_sender` (optional bool), and
`attachments.*` — `max:25600` KB, mimes `pdf,doc,docx,xls,xlsx,jpg,jpeg,png`. Renders the
`emails.custom-user-email` Blade view with `nl2br(e($message))`, sends `from` the configured address
but with the **sender's name**, optionally BCCs the sender, attaches each file with its original name
and mime. Returns JSON `{success, message}`; catches and logs failures, returning a 500 with a generic
message.

**Port notes:** PM's `mail_service` exists. File upload needs `python-multipart` (already installed).
The 25 MB per-attachment cap and mime allowlist must be enforced server-side, not just in the picker.

---

## Module 3 — Roles (four gaps)

PM has CRUD + a permission-group matrix inside the role editor. Missing:

### 3a. Roles matrix — `GET roles-matrix`, `POST roles-matrix/cell`

Roles as rows, permission groups as columns. Each cell is `{id, state, granted, total}` where `state` is
`empty` (group has no permissions) \| `none` (0 granted) \| `partial` \| `full`. Clicking a cell toggles
**every** permission in that group on or off (`state: on|off`), then flushes the permission cache.
Groups are ordered by `module`, then `display_order`.

### 3b. Role clone — `GET|POST roles/{role}/clone`

Clone form shows `{id, name, guard_name, permissions_count}` and suggests `"{name} (Copy)"`. POST
validates name `required|max:255|unique|regex:/^[\pL\s\-]+$/u` — **letters, spaces and hyphens only** —
creates the role with `created_by`/`updated_by`, syncs the source role's permission IDs, flushes cache.
Wrapped in try/catch that logs and returns a generic failure.

### 3c. Role users — `GET roles/{role}/users`

JSON: `{role: name, users: [{id, name, email, level, department, status}]}`, ordered by first name.
**`level` and `department` do not exist on PM's `users` table** — either add them or drop those two
fields. Recommend dropping; they're LeapDesk HR-chart fields with no PM equivalent.

### 3d. Per-role nav preferences — `POST roles/{role}/nav-preferences`

A JSON column `nav_preferences` on `roles`, migration `2026_05_01_100000`. Shape:
`{"<section-slug>": {"collapsible": bool}}`.

- **Catalog** is a class constant (`NavigationService::COLLAPSIBLE_SECTION_CATALOG`) — the single source
  of truth for the seeder defaults, the UI toggle list, and the overlay step. PM's catalog is just
  `{"user-management": "User Management", "system-settings": "System Settings"}` until more sections exist.
- **Defaults:** both PM-relevant sections `collapsible: true`.
- **Resolution:** iterate the user's roles *reversed* and merge, so the **first-listed role wins** on
  conflicts. Roles with NULL prefs contribute the global default.
- **Validation** strips any key not in the catalog — defence-in-depth on top of the validator, so the
  stored JSON stays clean even if a stale client posts junk.
- `RootUser`/`BackendDeveloper` bypass filtering entirely and see every section.

**PM's sidebar is currently a hardcoded client-side component.** Nav preferences require the same
inversion LeapDesk made: build and filter the nav tree **server-side** and have the client render what
it receives. That is a prerequisite, not an add-on — budget for it.

### 3e. One divergence to settle

LeapDesk exposes `POST roles/{role}/permissions` as its own route. PM enforces the same
`role-permissions` permission as a **conditional field check inside**
[`rbac_service.update_role`](../../backend/app/services/rbac_service.py#L233). It works, but unlike PM's
other 34 permissions it doesn't appear in OpenAPI — which contradicts the principle recorded in
`VERSION_SUMMARY.md` ("declarative per route … an ungated route is obvious in review"). Recommend
splitting it into its own route while the Roles module is open.

---

## Module 4 — Activity Log (three gaps)

PM has list + CSV export + events + retention purge — ahead of LeapDesk on export. Gaps:

### 4a. Non-admin rows are not sandboxed — fix this one first

LeapDesk: `$viewAll = has_admin_access();` and if false, `$query->where('causer_id', auth()->id())` —
a non-admin can audit **their own** actions but not colleagues'. PM's
[`activity.py:59`](../../backend/app/api/activity.py#L59) gates on `ACTIVITY_VIEW` and then **binds the
actor to `_actor`, unused** — so anyone holding `activity-view` reads the whole org's trail. This is a
parity gap *and* a privacy regression against the reference implementation.

### 4b. Missing filters

| Filter | LeapDesk | PM |
|---|---|---|
| `search`, `event`, `causer_id`, `log_name`, `subject_type` | ✅ | ✅ |
| `subject_id`, `date_from`, `date_to` | — | ✅ (ahead) |
| **`source`** — `web`/`seeder`/`tinker`/`command`/`job`, via a JSON path predicate on `properties->source` | ✅ | ❌ |
| **`hide_system`** — drops rows with no human causer (sync jobs, seeders, CLI) | ✅ | ❌ |

`source` requires the writer to *record* it. PM's `activity_service` must stamp a source on write before
the filter is meaningful.

### 4c. Presentation layer

- **Module labels** keyed by `log_name`: `core → "LeapDesk Core"`, `auth → "Authentication"`,
  `system → "System"`, `default → "General"`. PM's equivalents are `auth` and `default`.
- **Clickable subject column** — a `subject_type → URL template` map with `{id}` substitution
  (`App\Models\User → /users/{id}`, `App\Models\Role → /roles/{id}`), with a per-model
  `resolveSubjectUrl()` fallback so "what URL points at this record" lives next to the model.

---

## Module 5 — Invitations (backend at parity, no admin UI)

PM's backend already has list, preview, create, accept, resend, cancel, own-only visibility for
non-admins, elapsed-expiry reflection, and `resent_count`/`last_sent_at` columns. Deltas:

| Behaviour | LeapDesk | PM |
|---|---|---|
| Create shape | **Bulk** — `invitations: [{email, role_id}, …]`, min 1; silently skips addresses with a pending invite; reports `"{n} invitation(s) sent"` | Single |
| Stats cards | `pending` / `expired` / `accepted` counts, scoped the same way as the list | ❌ |
| Resend cooldown | 60s, returns an error flash | ❌ (verify) |
| Role picker | Excludes `RootUser` | check |
| Admin index UI | 543-line page | ❌ — only the public accept page exists |

The public accept page (174 lines) is already ported as
[`AcceptInvitationClient.tsx`](../../frontend/components/auth/AcceptInvitationClient.tsx).

---

## Module 6 — Data Access ⭐ entirely new

Universal "who can see/manage whose records" delegation, mounted **inside** the Roles module.
~375 backend lines. This is the smallest of the four new modules and a good first build.

### Schema — `data_access_grants`

| Column | Type | Notes |
|---|---|---|
| `id` | PK | LeapDesk `bigint`; PM should match `users` and use `String(36)` UUID |
| `grantee_id` | FK → `users.id`, **cascade delete** | the user *receiving* access |
| `subject_id` | FK → `users.id`, **cascade delete** | the user whose records are exposed |
| `scope` | `String`, default `'*'` | module slug, or `*` = all modules |
| `access_level` | `String`, default `'view'` | `view` \| `manage` |
| `granted_by` | FK → `users.id` nullable, **null on delete** | |
| timestamps | | |

Constraints: `UNIQUE(grantee_id, subject_id, scope)`, index on `subject_id`, index on `scope`.

### The `HasDataAccess` semantics — get these exactly right

From [`app/Concerns/HasDataAccess.php`](/opt/lampp/htdocs/LeapDesk/app/Concerns/HasDataAccess.php):

- **`accessibleUserIds(scope, level='view')`** → creator IDs this user may read. **Always includes self.**
  A grant applies when its scope equals the requested module **or** is the `'*'` wildcard. Requesting
  `manage` skips `view`-only grants. Memoised per instance, keyed `"scope|level"`.
- **`manageableUserIds(scope)`** → `accessibleUserIds(scope, 'manage')`, but **returns `[]` when the
  result has ≤ 1 entry**. The subtlety: only a *manage-delegate* — someone granted manage access to at
  least one **other** user — gains manage rights, and it then covers their **own** records too (a senior
  approving their team's quotes can approve their own). A plain user with no delegation gets `false`
  even for their own records; those follow each module's owner rules.
- **`canManageDataOf(userId, scope)`** → membership test against `manageableUserIds`. Does **not**
  account for module admin-access permissions; callers OR it with their own admin check.
- **`isDataDelegate(scope, level)`** → `count(accessibleUserIds) > 1`.

Adoption pattern in a consuming service:

```python
# list — own + delegated records
if not actor.has_permission(QUOTE_ADMIN_ACCESS):
    stmt = stmt.where(Quote.created_by.in_(accessible_user_ids(db, actor, "qmas")))

# admin-level action on one record
can_manage = actor.has_permission(QUOTE_ADMIN_ACCESS) or can_manage_data_of(
    db, actor, record.created_by, "qmas"
)
```

With no grants, `accessibleUserIds` returns `[self.id]` — so an adopting module behaves exactly as
"own data only" until an admin creates a grant. That property is what makes it safe to adopt
incrementally.

### Endpoints

| Route | Permission | Notes |
|---|---|---|
| `GET roles/data-access` | `data-access.view` | search across grantee+subject name/email (incl. `CONCAT(first_name,' ',last_name)`), filter by `scope` / `access_level`, sort whitelist `scope`/`access_level`/`created_at`, `per_page` default 25. Returns `canManage` so the UI knows whether to render write controls |
| `POST roles/data-access` | `data-access.manage` | **`grantee_id` + `subject_ids[]`** — one grantee, many subjects, `updateOrCreate` per pair so re-granting updates the level instead of erroring. Rejects self-grants with *"A user cannot be granted access to their own records."* |
| `DELETE roles/data-access/{grant}` | `data-access.manage` | |

Scope options are a controller constant: `*` "All Modules", `qmas`, `presales`, `inventory`. **PM's list
is `*` plus whatever modules exist** — initially just `*`. Subject/grantee pickers list `status = 'ACTIVE'`
users only.

**Route ordering matters:** `roles/data-access` must be declared **before** `roles/{role}`, or the
wildcard swallows it. FastAPI has the same first-match-wins behaviour.

### Relationship to PM-5

I earlier called this "LeapDesk's answer to PM-5". That was **half right and worth correcting**:
Data Access delegates by **record creator** (`created_by`), while
[PM-5](./TECH_DEBT.md#pm-5--no-row-level-scoping-pattern-exists) and
[`MARKETPLACE_DOMAIN_PLAN.md`](./MARKETPLACE_DOMAIN_PLAN.md) § Row-Level Scoping specify scoping by
**partner organisation** (`partner_id`). They are **complementary, not equivalent** — a marketplace
still needs tenant isolation, and delegation sits on top of it. Building Data Access closes the
"no row-scoping pattern exists anywhere" half of PM-5; it does not close the tenant half.

---

## Module 7 — API Credentials ⭐ entirely new, largest

~1,040 backend lines + 4,057 frontend lines across 8 pages. Encrypted, schema-driven credential storage
for third-party integrations, plus Slack notification channels.

### Schema — four tables

**`api_service_providers`** — `id`, `name`, `slug` unique, `description` text, `icon`,
`documentation_url`, `setup_steps` JSON, `category` default `'general'`, `is_system` bool,
`is_active` bool, `display_order` int, timestamps.

**`api_credential_schemas`** — the field definitions per provider: `provider_id` FK cascade,
`field_key`, `field_label`, `field_type` default `'text'`, `field_options` JSON, `is_required` bool,
`is_encrypted` bool default **true**, `validation_rules` JSON, `placeholder`, `help_text` text,
`default_value`, `display_order`. `UNIQUE(provider_id, field_key)`.

**`api_credentials`** — one row per provider per environment: `provider_id` FK cascade,
`environment` default `'production'`, `name` nullable, `is_active` bool, `last_used_at`,
`last_verified_at`, `verification_status`, `notes` text, `created_by`/`updated_by` FK nullable.
`UNIQUE(provider_id, environment)`.

**`api_credential_values`** — `credential_id` FK cascade, `schema_id` FK cascade, `value` text nullable.
`UNIQUE(credential_id, schema_id)`.

Plus **`slack_notification_channels`** (migration `2026_03_26_170213`).

### Encryption and masking

`ApiCredentialValue` uses Eloquent mutator/accessor pairs: on set, if the field's schema says
`is_encrypted`, `Crypt::encryptString(value)`; on get, `Crypt::decryptString`, **falling back to the raw
value on decrypt failure** (so a key rotation degrades rather than crashes). `getMaskedValueAttribute`
shows the last 4 characters and stars the rest — or stars everything if the value is ≤ 4 chars.
`shouldMask()` is `field_type === 'password' || is_encrypted`.

**Port:** PM already has `cryptography`'s Fernet in use for 2FA secrets — reuse it. **Never return a
decrypted value in an API response**; return the masked form, exactly as LeapDesk does.

### `CredentialManager` — the resolution chain

`get(providerSlug, environment=None, fieldKey=None)`:

1. Requested environment (default `config('app.env')`) — **unless it's marked bad**, in which case skip
   straight to the fallback.
2. Cross-env fallback (`CREDENTIALS_FALLBACK_ENV`) if the primary yielded nothing or was marked bad.
   Intended for local dev where credential rows drift behind production; unset in production, so it's a
   no-op there.
3. Config files (`services.<slug>` then `<slug>`) — legacy behaviour.

`markBad(slug, env)` busts the cache and sets a 1-hour marker so subsequent lookups skip a dead env;
after the TTL the original is retried in case the token was rotated. `clearBadMarker` short-circuits
that wait. Reads are cached 1 hour keyed `api_credentials.{slug}.{env}`, and `markAsUsed()` stamps
`last_used_at` on each resolution.

**⚠️ Translation decision: no cache layer.** Options: (a) skip caching, query per resolution — simplest,
and PM's credential reads are low-frequency; (b) an in-process TTL dict — fine for one worker, wrong
with several; (c) add Redis to compose. **Recommend (a) for the first cut**, with the bad-marker as a
column on `api_credentials` (`marked_bad_until TIMESTAMPTZ NULL`) so it survives restarts and works
across workers.

### Seeded providers

`anthropic`, `google`, `hostbill`, `hubspot`, `mail`, `slack`. **For PM, four are relevant:**
`google` (moves the Google OAuth client out of `.env` — see PM-28), `mail` (SMTP), `anthropic` (gates
the AI Assistant), `slack`. `hostbill` and `hubspot` are Leapswitch integrations with no PM equivalent —
skip.

### Endpoints and pages

Dashboard `GET /api-credentials`; providers CRUD under `/providers`; credentials CRUD under
`/credentials`; Slack channels under `/slack-channels` with `toggle`, `test`, and `fetch-channels`.
Eight frontend pages: `Index`, `Providers/{Index,Form,Show}`, `Credentials/{Index,Form,Show}`,
`SlackChannels/Index`.

**This module unblocks two other things** — the AI Assistant (below) and, incidentally, PM-28: with
provider-managed Google credentials, verifying SSO stops requiring a `.env` edit.

---

## Module 8 — Global Search ⭐ entirely new

A Cmd-K spotlight over admin-configured entities. ~790 lines total. **No external search engine** —
`SCOUT_DRIVER=database` (verified in LeapDesk's `.env`), i.e. SQL `LIKE` against each model's own table.
Ports to Postgres `ILIKE` (or `tsvector` if PM wants ranking) with no new infrastructure.

### Schema

**`searchable_entities`** — `model_class` unique, `label`, `group`, `icon` nullable, **`fields` JSON**
(which columns are indexed), `display_template`, `subtitle_template` nullable, `route_name`,
`route_param_field` default `'id'`, `permission` nullable, `enabled` bool default true,
`sort_order` uint, `created_by`/`updated_by`, timestamps. Index `(enabled, sort_order)`.

**`search_logs`** — `user_id` nullable indexed, `q` varchar(255), `result_count` uint,
`duration_ms` uint, `ip` varchar(45) nullable, `created_at` default now. Indexes `(user_id, created_at)`
and `created_at`.

**The point of `fields` being a JSON column:** which columns are searchable is a **DB change, not a code
change**. The model does not hardcode its own index. Preserve that — it's the module's whole design idea.

### Three permission layers

From [`GlobalSearchService`](/opt/lampp/htdocs/LeapDesk/app/Services/Search/GlobalSearchService.php):

- **L1** — route middleware on the endpoint (`throttle:60,1` on the search route itself).
- **L2** — registry-level permission whitelist: skip an entity if `cfg['permission']` is set and the
  user lacks it (super-admins bypass).
- **L3** — per-row policy check: if the model has a view policy, `Gate::allows('view', $hit)` per hit.

Queries under 2 characters return `[]`. Each entity is queried for `limit * 2` hits, then filtered down
to `limit` post-policy — so policy rejections don't silently shrink a group to nothing. A model class
that no longer exists, or a route name that doesn't resolve, is **skipped rather than fatal**
(`safeRoute` returns null → the hit is dropped). `render()` substitutes `{field}` placeholders from the
model's attributes via a regex on `[a-zA-Z0-9_.]+`.

### Endpoints

`GET api/search` (throttled 60/min) — the spotlight. Admin config under `settings/search`, gated
`search.entities.manage`: index, store, update, `toggle`, `reindex`, `reindex-all` (throttle 2/min),
`purge-broken`, destroy. CLI: `search:reindex`, `search:reconcile`.

**For PM, the initial registry is `User` and `Role`** — LeapDesk's Core group. Marketplace entities join
later, which is exactly the extensibility the config table buys.

Frontend: `global-search.tsx` (421 lines) plus a trigger in the app header.

---

## Module 9 — AI Assistant ⭐ entirely new, depends on Module 7

A platform-wide chatbot answering questions from the app's own database. ~1,130 backend lines.
**Gated at runtime on the Anthropic integration being enabled in API Credentials** — so this cannot
ship before Module 7.

### Architecture

`LeapDeskAssistant implements Agent, Conversational, HasTools` — deliberately thin: tools come from a
`ToolRegistry` and are **filtered to what the current user may use**, so core and every plugin can
contribute tools without the core depending on them.

`ToolRegistry::register(factory, gate)` where `gate` is a permission name, a closure, or null for
everyone; `toolsFor(user)` resolves the permitted set at prompt time.

### Schema

**`agent_conversations`** — `id` char(36) PK, `user_id` nullable, `title`, timestamps,
index `(user_id, updated_at)`.

**`agent_conversation_messages`** — `id` char(36) PK, `conversation_id` char(36) indexed, `user_id`
nullable, `agent`, `role` varchar(25), and text columns `content`, `attachments`, `tool_calls`,
`tool_results`, `usage`, `meta`; index `(conversation_id, user_id, updated_at)`.

**`ai_message_feedback`** — `conversation_id` nullable, `user_id`, `helpful` bool, `comment`.

### Endpoints

`POST ai/chat` (throttle 30/min) — validates `message` `required|max:4000` and optional
`conversation_id` `size:36`; returns 403 with *"The AI assistant is not enabled. Configure Anthropic in
API Credentials."* when disabled, or *"Your role does not have access to the AI assistant."* without
`ai-assistant.use`; retries transient failures **twice with 250 ms backoff** before returning a 502
*"The assistant could not respond right now."*

`POST ai/feedback` (throttle 60/min) — `helpful` required bool, `comment` optional max 1000.

Settings page `GET|POST settings/ai-assistant` gated `api-credentials.index` — a single enable/disable
toggle that writes the `enabled` field on the Anthropic credential, **refusing to enable when no API key
is present**: *"Add an Anthropic API key in API Credentials before enabling the assistant."* Because the
chat gate and the widget's visibility both read that same flag, flipping it shows or hides the widget
app-wide instantly.

### Which tools port

LeapDesk has 8. Five are QMAS-specific (`CalculatePricing`, `QueryAddons`, `QueryBmaasComponents`,
`QueryCloudPePlans`, `RecommendSolution`) and have **no PM equivalent — skip them**. Three port:

| Tool | What it does |
|---|---|
| `DescribeSchema` | No args → every readable table; with a table → its columns. "Discover here, then read with `database_query`." |
| `DatabaseQuery` | Read-only structured query: `table`, optional `columns`, `where[]` of `{column, operator, value}`, `order_by`, `direction`, `limit` |
| `LocateData` | "Where does this live?" — runs Global Search and returns each match with its module label and page URL. **Depends on Module 8** |

### The security design — replicate all five controls

`DatabaseQuery` is the most sensitive code in the whole parity scope. Its controls:

1. **A dedicated read-only DB connection** (`mysql_readonly`). PM needs a second SQLAlchemy engine bound
   to a Postgres role with `SELECT`-only grants. **Not optional** — it is the only control that holds if
   the query builder is ever wrong.
2. **Denied-table regex**: `/(credential|token|password|session|cache|^jobs$|job_batches|failed_jobs|migrations|personal_access|telescope|websockets|oauth_)/i`. For PM add `user_sessions`,
   `api_credential_values`, `password_reset_otps`.
3. **Column redaction** — suffixes `_token`, `_secret`, `_password`, `_key`; exact names `password`,
   `remember_token`, `two_factor_secret`, `two_factor_recovery_codes`. Applied *before results leave the
   database layer*.
4. **Operator allowlist** — `= != <> < <= > >= like in`; every value bound as a parameter.
5. **Output caps** — `MAX_LIMIT = 50` rows, `MAX_OUTPUT_LENGTH = 12000` chars, so a large result can't
   overflow the model's context.

`OutputGuard::sanitize` is a final deterministic pass over the reply: redacts Anthropic (`sk-ant-`),
Slack (`xox[baprs]-`), GitHub (`gh[pousr]_`) and AWS (`AKIA`) key shapes plus PEM private-key headers,
and flags non-INR currency amounts. It deliberately does **not** block PII — this is an internal staff
tool and staff legitimately need customer emails and phone numbers. Flags are logged, not thrown.

The system prompt is ~90 lines and is itself load-bearing — grounding ("answer ONLY from tools, never
invent data"), role-aware access rules, a two-tier statement of what the user may see based on
`ai-assistant.query-database`, an explicit "system secrets are off-limits to **everyone**, regardless of
role", a reasoning procedure, and a confirmation requirement before broad or heavy reads. Port it
adapted, not verbatim — the QMAS pricing playbook section is irrelevant to PM.

### ⚠️ The Anthropic integration must not be copied verbatim

LeapDesk pins `claude-sonnet-4-6` (`AiChatController::DEFAULT_MODEL`) and calls it through
`Laravel\Ai`. Neither transfers. Per the current Anthropic API reference:

| LeapDesk | Partner Marketplace |
|---|---|
| `Laravel\Ai` `Agent`/`HasTools` contracts | `anthropic` Python SDK — `@beta_tool` decorated functions + `client.beta.messages.tool_runner(...)`, which drives the tool loop so no manual `while stop_reason == "tool_use"` is needed |
| `model: 'claude-sonnet-4-6'` | **`claude-opus-5`** — the current default. $5/$25 per MTok |
| — | `thinking={"type": "adaptive"}` and `output_config={"effort": "high"}`. Do **not** use `budget_tokens` (400s on Opus 5) or `temperature`/`top_p` (also 400) |
| `retry(2, …, 250)` | Keep an application-level retry, but the SDK already retries 429/5xx twice with backoff — don't double up blindly |
| — | Handle `stop_reason == "refusal"` **before reading `response.content`**, and opt into `fallbacks: "default"` (beta header `server-side-fallback-2026-07-01`) so a policy decline is re-served rather than surfaced |
| `credentials('anthropic.default_model')` | Same idea — keep the model ID configurable via the credential row, defaulting to `claude-opus-5` |

Keep the model ID in the credential row so it can be changed without a deploy, exactly as LeapDesk does.

---

## Module 10 — Platform API ⭐ entirely new, added to the reference after this plan was written

**R&D 2026-08-10.** LeapDesk shipped this on **2026-08-09**, five days after this plan was scoped, so
it is not a gap we missed — the reference grew. Live at
`https://leapdesk.cloudjiffy.net/settings/api/consumers`. Everything below was read from
`/opt/lampp/htdocs/LeapDesk` source and its own tracker,
[`documentation/planning/LEAPDESK_PLATFORM_API.md`](/opt/lampp/htdocs/LeapDesk/documentation/planning/LEAPDESK_PLATFORM_API.md)
(584 lines, the most complete design record any of these ten modules has).

**What it is: the admin surface for machine identities.** A *consumer* is a system — not a person —
permitted to call the API. It holds tokens; each token carries a set of *abilities* and an optional
expiry. The screen exists so that who holds standing access, what it reaches, and when it last called
are readable without SSHing into production. Before it, LeapDesk minted tokens through
`php artisan api:issue-token` and nobody could answer those questions.

### ⚠️ This is the opposite direction from Module 7 — do not merge them

The single most likely mistake here, and LeapDesk refused it explicitly:

| | Module 7 — API Credentials | Module 10 — Platform API |
|---|---|---|
| Direction | **Outbound** — credentials *we* hold to call third parties | **Inbound** — who may call *us* |
| Secret belongs to | Anthropic, Google, SMTP, Slack | The consumer we issue it to |
| Risk if wrong | We can't reach a provider | A third party reads our data |
| Storage | Encrypted at rest, decryptable (we must send it) | **Hashed, never recoverable** (we only ever compare) |

They sit side by side in the sidebar and both contain the word "API". *"Housing them together would blur
an access-control boundary for the sake of a superficial 'both are API-ish' grouping"* — LeapDesk's
tracker, § Placement. Keep them separate here for the same reason.

### What LeapDesk built, and what it deliberately did not

Its programme has two parts. **Part I is the module; Part II is a data-exposure engine.**

| | Part I — governance surface | Part II — the resource engine |
|---|---|---|
| Scope | Consumers, tokens, abilities, audit reads, docs page | Registry-driven read API over arbitrary models |
| Status in LeapDesk | ✅ Phases 1–4 complete, deployed + verified 2026-08-09 | Phases 5–10, **mostly not started** |
| Tables | `api_consumers` + Sanctum's `personal_access_tokens` | `api_resources` (105 rows), `qmas_api_request_logs` |
| Why it exists there | Auditability of access already being granted | One org project (RIaaS) asked for open-ended data access |

**Recommendation: port Part I only.** Part II answers a question we do not have — the marketplace domain
is greenfield (verified 2026-08-07: 11 tables, none of them domain tables), so there is nothing to
expose and no consumer asking. Building an exposure engine before there is data to expose is
speculative by definition. See § What not to port, below, for the condition that would change this.

### Schema — one table here, one that Sanctum gives LeapDesk for free

**`api_consumers`** (their migration `2026_08_03_120000`) — `id`, `name`, `slug` unique,
`description` text nullable, `owner_name` nullable, `owner_email` nullable *(nullable in the column,
**required** in validation — see below)*, `active` bool default true, `created_by`/`updated_by` FK to
users `nullOnDelete`, timestamps.

Two column-level notes worth carrying over verbatim:

- **`active` is a kill switch that outranks the token.** An inactive consumer is refused at the gate
  even when it presents a valid, unexpired token. That is the "disable an integration at 2am without
  hunting down its credentials" control, and it is why `active` lives on the consumer rather than being
  inferred from whether tokens exist.
- **`owner_email` is required by the FormRequest** with the message *"someone must be contactable when
  this integration needs revoking."* The column is nullable; the rule is not. Keep the rule.

### 🔴 The hard translation — Sanctum does not exist for us

This is the whole of the porting difficulty, and it is bigger than it looks. LeapDesk writes
`$consumer->createToken($name, $abilities, $expiresAt)` and Sanctum supplies, for free: a polymorphic
`personal_access_tokens` table, hashing, per-token `abilities` JSON, `expires_at`, `last_used_at`,
one-time plaintext return, and `PersonalAccessToken::findToken($bearer)`. **We have none of it.** Our
only token machinery is JWT (`core/security.py`), which is the wrong shape — a JWT is stateless and
therefore cannot be revoked, and revocation is the entire point of this screen.

So Module 10 needs a second table, `api_consumer_tokens`, and four decisions Sanctum otherwise makes
for you:

**1. Hash with SHA-256, not bcrypt.** Non-obvious, and the one most likely to be got wrong here because
`security.py` already offers `hash_password`. Bcrypt is wrong for this in three separate ways:

- It is *deliberately slow* — correct for a low-entropy human password, pointless for 256 bits of
  `secrets.token_urlsafe`, which has nothing to brute-force.
- It **salts every hash**, so an incoming bearer token cannot be looked up. You would have to load every
  token row and `checkpw` each one — an O(n) scan on the hot path of every API call.
- It truncates at 72 bytes (`_prepare()` in `security.py` does this explicitly).

SHA-256 of the plaintext, stored in a **unique-indexed** column, is one indexed lookup and is what
Sanctum itself does. The token's entropy, not the hash's cost factor, is the security property.

**2. Give the token a recognisable prefix.** Store `pmp_<32+ url-safe chars>`, generated by the existing
`generate_token()`. A fixed prefix is what makes a leaked token greppable and what lets secret scanners
recognise it — and **this repository is public**, which makes that argument stronger here than at
LeapDesk. Keep the first ~8 characters in a plain `prefix` column so the UI can show
`pmp_a1b2c3d4…` to identify a token it can never re-read.

**3. Abilities as a JSON/ARRAY column**, validated on write against a catalogue (below). Postgres
`ARRAY(String)` is the natural fit and is queryable; JSONB works too. Never free-form.

**4. `last_used_at` is a write on every authenticated request.** LeapDesk does
`$token->forceFill(['last_used_at' => now()])->save()` inline in the middleware. That is one UPDATE per
API call. Acceptable at their volume; worth knowing it is there before it is ours.

Proposed `api_consumer_tokens`: `id` UUID, `consumer_id` FK **CASCADE**, `name`, `token_hash` String(64)
**unique**, `prefix` String(16), `abilities` ARRAY(String), `expires_at` nullable, `last_used_at`
nullable, `created_by` FK `SET NULL`, `created_at`. The CASCADE/SET NULL split is the same reasoning
already applied in `data_access_grants` and should stay consistent: the credential dies with its
consumer; the audit of who issued it outlives whoever issued it.

### 🔴 The finding that outlives this module — a machine consumer is not a `User`

**This is the third independent product requirement in four days for a principal that is not a `User`
row**, and that changes it from a per-module annoyance into a design decision we should take once:

| Source | The non-`User` principal |
|---|---|
| `PARTNER_DIRECTORY_PLAN.md` (2026-08-07) | The **anonymous** visitor on a public directory |
| PM-5 / `MARKETPLACE_DOMAIN_PLAN.md` | A partner **organisation** as a tenant boundary |
| **This module** (2026-08-10) | A **machine consumer** holding a token |

Everything in our stack is typed `actor: User` — `get_current_user`, `require_permission`,
every function in the `data_access_service` written on 2026-08-07, and `activity_service.record`'s
`actor` parameter. A machine consumer has no user row, no role, and no permissions, and it must never
acquire them (that is precisely why LeapDesk hangs tokens off `ApiConsumer` rather than `User` — *"so
integrations never appear in user lists, never hold a role, and can never sign in"*).

The tempting shortcut — a hidden service `User` per consumer — should be refused. It puts machine
identities into user lists, RBAC screens and every `SELECT * FROM users`, and one forgotten filter turns
an integration into a login.

**Recommendation:** before Module 10 or PM-5 is built, introduce a `Principal` union
(`UserPrincipal | MachinePrincipal | AnonymousPrincipal`) and type the scoping seams against it, with
**anonymous as the most restrictive branch by construction**. `PARTNER_DIRECTORY_PLAN.md` already
warned that the obvious `if actor is None: return stmt` would serve unfiltered rows to the internet; the
machine case is the same hazard wearing a different hat. Worth noting that LeapDesk has this problem
too and simply does not apply data access to its API at all — so there is nothing to copy, only to
design.

### The ability catalogue

`ApiAbilityCatalogue` is a static list of grantable abilities, each with a label, group, **sensitivity**
(`low` / `medium` / `high`) and a prose description of what it exposes. The grant screen renders the
description and warns on `high`. Two rules from it are worth keeping regardless of how small our
catalogue starts:

- **Abilities are validated against the catalogue at write time.** *"A typo would otherwise mint a token
  carrying an ability nothing honours, which reads as 'granted' on this screen and fails as 403 at the
  consumer."*
- **An ability's description is authored for the person granting it, not for the developer.** A token is
  standing, unattended access; the grant screen is the only moment anyone reads what it opens up.

We have no abilities to list yet. Start with an empty-but-real catalogue and a single ability when the
first consumer exists — do not invent a taxonomy for a domain that does not exist.

### Audit trail — one place where our architecture is simpler

LeapDesk keeps API traffic in `qmas_api_request_logs`, separate from its activity log, and core reads it
through `class_exists()` guards so that a core screen never hard-depends on a plugin. **We have no
plugin system, so that entire defensive layer disappears** — `api_request_logs` is just a core table.

Keep the two trails separate, though, for reasons that are ours and not inherited: `activity_log` records
*meaningful actions* and its writer commits on its own transaction per row; an API log records *every
request including rejections*, at request volume. LeapDesk's has 11,114 rows for one consumer. Rejections
must be logged — *"a burst of 401s is how a leaked or probed token shows up"* — which means the table
grows fastest exactly when something is wrong. **Give it a retention policy on day one.** LeapDesk has
none, and its tracker does not list one as planned.

### Rate limiting — we have a limiter, but not on this axis

We already have `core/rate_limit.py` (PM-26), which is further along than a Laravel `throttle:` string in
one respect and behind it in another:

- ✅ **Token minting must be added to `SENSITIVE_PATHS`** (or given its own bucket, per the
  `(prefix, suffix, bucket)` mechanism that already exists for `/users/{id}/email`). LeapDesk throttles
  it `10,1` because *"a runaway script should not be able to mint hundreds before anyone notices."* Our
  limiter is explicitly designed so a new route does **not** silently inherit a tier — so this is a
  required step, not an automatic one.
- ❌ **Per-consumer limiting does not exist.** Our buckets key on `f"{tier}:{ip}"`. A machine consumer
  needs a limit keyed on its *token*, at a ceiling far above a browser's. That is a new dimension in the
  limiter, not a new entry in a list.
- ⚠️ **PM-26's known limitation gets worse here.** Counters are per-process memory, so N workers multiply
  every limit by N. For a login form that is an honest speed bump; for an API where the rate limit is
  the advertised contract (LeapDesk returns `x-ratelimit-limit` headers), it is a control that does not
  hold. This is a second, independent argument for **PM-44 (Redis)** — record it there.

### Permissions — five, and the split is deliberate

Under our `{resource}-{action}` convention already established in `core/permissions.py`:

| Reference | Ours |
|---|---|
| `api.consumers.index` | `api-consumer-view` |
| `api.consumers.create` | `api-consumer-create` |
| `api.consumers.edit` | `api-consumer-update` |
| `api.consumers.delete` | `api-consumer-delete` |
| `api.tokens.manage` | `api-token-manage` |

**Token management is separate from consumer editing on purpose** — *"editing a description and minting
standing credentials are not the same act and should not ride on one checkbox."* Keep that split; it is
the one piece of the permission design that is about security rather than tidiness.

> **The naming lesson does not transfer, but its cause does.** LeapDesk originally called it
> `api.consumers.tokens`; its `PresalesViewerRoleSeeder` builds a read-only role by dropping permissions
> whose final dotted segment is a write verb, so a *noun* ending sailed through the filter and handed
> **credential-minting to a read-only role**. We have no such derived-role seeder, so we cannot inherit
> the bug — but we should inherit the wariness: any rule that derives a role from a permission *name* is
> one rename away from a privilege grant. If we ever build one, this is the test case.

Grants: Admin / SuperAdmin / RootUser get all five. **Staff gets none** — not even `api-consumer-view`.
Who holds standing machine access to our data is not general staff information, and unlike
`data-access-view` (which we already granted Staff, and flagged in `data_access_service.list_grants` as
questionable) there is no workflow reason to widen it.

### Endpoints

`{API_PREFIX}/api-consumers`, thin router + `api_consumer_service.py`:

| Method | Path | Permission |
|---|---|---|
| GET | `/api-consumers` | `api-consumer-view` |
| POST | `/api-consumers` | `api-consumer-create` |
| GET | `/api-consumers/{id}` | `api-consumer-view` |
| PATCH | `/api-consumers/{id}` | `api-consumer-update` |
| POST | `/api-consumers/{id}/toggle` | `api-consumer-update` |
| DELETE | `/api-consumers/{id}` | `api-consumer-delete` |
| POST | `/api-consumers/{id}/tokens` | `api-token-manage` **+ rate limit** |
| DELETE | `/api-consumers/{id}/tokens/{token_id}` | `api-token-manage` |
| GET | `/api-consumers/{id}/usage` | `api-consumer-view` |

The listing goes on `run_list` + `ListSpec` + the generic `Page[T]` envelope — all three already exist as
of 2026-08-07, so unlike LeapDesk (which hand-rolls a `LengthAwarePaginator` around a full `get()`) we
get search, sorting, tiebreak and clamped page size for free. LeapDesk loads every consumer unpaginated
on the grounds that there will only ever be a handful; ours costs nothing to do properly.

**The one-time reveal is simpler for us.** LeapDesk pushes the plaintext through an Inertia flash
allowlist (`HandleInertiaRequests`, where an unlisted key is silently dropped — a trap they had to work
around). We just return it in the `POST /tokens` response body, once. Two consequences to handle
deliberately: **that response body must be excluded from any request/response logging**, and the
frontend must not put it in Redux or `localStorage` — render it, offer copy, discard on dismiss.

### Frontend

Four screens, mirroring LeapDesk's (`Index` 461 lines, `Form` 283, `Show` 478, `IssueTokenModal` 291):

- **Index** — `DataTable`, stat cards that double as filters (total / active / inactive / **no tokens**).
  That fourth filter is a real insight worth copying: a consumer holding no token *"is the one state that
  is neither active nor disabled but still means it cannot call — the difference between access granted
  and access working."*
- **Form** — create/edit. Slug is kebab-case validated with the message *"lowercase words separated by
  hyphens, e.g. riaas, or riaas-reporting."*
- **Show** — per-token abilities, expiry, last-used; recent calls from the audit table.
- **IssueTokenModal** — abilities grouped by sensitivity with warnings, expiry choice
  (never / 30d / 90d / 1y), then the one-time reveal with a copy button and an explicit *"send it over a
  password manager's share link, not Slack or email; never commit it to a repository."*

Per our own nav conventions this is a sidebar entry under System Settings gated on `api-consumer-view`,
with a sub-nav shell if a second tab (usage/docs) ever lands.

### Naming rule — after the system, never after a person

LeapDesk created its first consumer as `karan-reporting` and **renamed it to `riaas` on live**. The
reasoning transfers whole: a consumer is a machine identity, so naming it after a person breaks when
that person changes role or leaves while the integration keeps running, leaves a second project by the
same person nowhere to go, and makes an audit row read as though a human made the call when a server
did. **The slug names the system; `owner_email` names who to ring about it.** Renaming is safe because
tokens and audit rows key on the consumer id, not the slug.

### What not to port — Part II, and the condition that would change that

Skip `api_resources` and the generic read engine. Beyond "no data and no consumer", LeapDesk's own code
review is the argument against building it casually — read
[`LEAPDESK_PLATFORM_API.md` § Code review findings](/opt/lampp/htdocs/LeapDesk/documentation/planning/LEAPDESK_PLATFORM_API.md)
before ever reviving this:

- **100 of 105 registered resources had no field allowlist**, and NULL means *every column*. A
  `quotes.read` token returned all **81 columns** of `bmaas_services` — the entire internal cost and
  margin model. The design note claiming a new column could not leak by default was true of five rows
  out of a hundred and five.
- Relations bypassed the allowlist entirely — latent only because nothing registered one.
- The fix was an **engine-level deny-list beneath the registry** (`password`, `secret`, `api_key`,
  `access_token`, `refresh_token` stripped no matter what a row says), because *"the registry was the
  only thing standing between a typo and a credential dump."*

If we ever build it: that floor goes in first, not last, and it must include every column our stack
treats as a secret — `password`, `two_factor_secret`, `password_reset_token`, `token_hash`.

**What would change this recommendation** is a product decision that is currently open, not a technical
one: `PARTNER_DIRECTORY_PLAN.md` describes a public, partner-facing surface. If that product is chosen,
partners plausibly want programmatic access to their own listings and enquiries — and at that point a
*scoped* API (per-consumer row-level scope, which is LeapDesk's own unbuilt Phase 6 item) becomes a
product requirement rather than speculation. **Module 10 Part I is worth building either way; Part II
should wait for that decision.**

### One place we start ahead

LeapDesk hand-writes its docs page and generates it from the live registry to stop it drifting — its
Phase 8 wants *"auto-generated OpenAPI 3.1 spec from the registry"* as a future win. **We have that
already**: FastAPI emits OpenAPI, `backend/openapi.json` is committed, and CI fails when it drifts
(PM-42). A consumer-facing reference is closer to free for us than for them.

One caveat before treating it as free: our OpenAPI document describes *every* endpoint including the
admin surface. Handing a machine consumer the whole schema documents our internals. If a public API
lands, it needs its own `APIRouter` and a filtered schema (or a mounted sub-app), not a link to `/docs`.

### Effort

Part I is comparable to Module 6 (Data Access), plus a token subsystem. Two tables, ~450 backend lines
across model/service/router/schemas, four frontend screens, five permissions, one migration, and one
genuinely new piece of security machinery (token hashing + the bearer gate). **The `Principal` type
above is the prerequisite worth doing first**, because it is shared with PM-5 and the directory work and
is much cheaper to introduce before three call sites exist than after.

---

## Modules 11–18 — the platform-operations tier ⭐ researched 2026-08-11

> **The reference grew again.** § Progress predicted this: *"a reference that is still under active
> development will do this again, so treat this plan's module list as a snapshot with a date."* It did.
> Between 2026-08-10 and 2026-08-11 LeapDesk shipped **eight more modules**, and the owner's module
> list on 2026-08-11 named all of them. Read from
> `references/LeapDesk` on 2026-08-11 — routes, migrations, controllers and seeders, not from memory.
>
> **These eight are a different *kind* of module from 1–10**, and that is the most useful thing to say
> about them. Modules 1–10 are business objects a user creates and edits. These are **operations
> surfaces**: they observe the running system, or they configure it. Most have no create form, several
> have no delete, and three are read-only. Applying the Users CRUD shape to all of them uncritically
> would be wrong — see § The CRUD shape does not fit all eight.

### The eight, at a glance

| # | Module | Shape | Tables | Gates |
|---|---|---|---|---|
| 11 | **Configuration** | Registry — edit values, never create rows | `settings` | — |
| 12 | **Security** | A filtered view of Configuration | (same `settings` table) | 11 |
| 13 | **Feature Flags** | Full CRUD | `feature_flags` | 11 |
| 14 | **Webhooks** | Full CRUD + a delivery log | `webhook_endpoints`, `webhook_deliveries` | 10 |
| 15 | **API Documentation** | Generated, read-only | none | 10 |
| 16 | **Queue Monitor** | Read + operate, no CRUD | `queue_job_runs` | — |
| 17 | **Error Tracking** | Read + triage, no create | `error_groups`, `error_occurrences` | — |
| 18 | **System Health** | Read-only dashboard | none | 16, 17 |
| — | **Recycle Bin** | Restore / purge, no create or edit | none — reads `deleted_at` | soft deletes |

**Recycle Bin has no number because it is not a module in the sense the others are.** It is a view over
every table that carries `deleted_at`, and it grows automatically as tables gain soft deletes. Numbering
it would imply it can be "built and finished", which it cannot.

---

### Module 11 — Configuration

**One settings registry, replacing four parallel per-plugin implementations** — LeapDesk's own
docblock says exactly that. This is the module that makes 12 and 13 possible.

```
settings
  id, key (unique, 150), value (json, nullable), type (20, default 'string'),
  group (64, indexed), module (32, default 'core', indexed),
  label (191), description (500, nullable),
  updated_by → users (nullOnDelete), timestamps
  index (module, group)
```

**The design decision worth copying: validation is derived from the row's own `type`.** An `int`
setting rejects `"abc"`, a `bool` rejects a string — and the rule comes from `SettingType`, not from a
per-key validation table someone has to maintain. `value` is JSON so one column holds every type
without a `value_int` / `value_bool` / `value_string` sprawl.

`module` + `group` is what stops this becoming a 200-row list nobody can navigate: the index filters by
module and orders `module → group → label`.

**Endpoints:** `GET settings/configuration`, `PUT settings/configuration/{setting}`. **There is no
create and no delete** — settings are seeded by a registry seeder, because a setting with no code
reading it is dead weight, and code reading a setting that does not exist is a bug. Ours should keep
that: the row set is a migration concern, not a UI one.

### Module 12 — Security

**Not its own table.** It is the `security.*` namespace of Module 11's registry, with its own screen
because these controls need explaining and grouping in a way a generic settings list cannot do.

The controller enforces the namespace: `abort_unless(str_starts_with($setting->key, 'security.'), 404)`
— so the Security screen cannot be used as a back door to write any other setting. **Copy that guard**;
it is the one line that keeps two screens over one table honest.

Real keys, which double as the feature list:

| Group | Key | What it controls |
|---|---|---|
| Authentication | `security.auth.*` | Two-factor requirement, privilege-escalation check |
| Reauth Gates | `security.reauth.window_minutes` | Password-confirmation validity |
| Reauth Gates | `security.reauth.*` | Which actions demand it — credential decrypt, permission change, user delete |
| Audit | `security.audit.credential_decrypt` | Log every API credential decryption |
| Audit | `security.audit.permission_changes` | Log role and permission changes |
| Invitations | `security.invitations.expiry_days`, `.max_resends` | Both are currently **constants** in our code |
| Email | `security.email.recipient_allowlist` | Allowed recipient domains for admin email |
| Headers | `security.headers.csp_mode`, `security.session.force_secure_cookie` | |

> **Every default reproduces today's behaviour**, so the screen changes nothing until someone
> deliberately tightens something. That is the property that makes a security-settings page safe to
> ship, and it is worth stating as a rule rather than rediscovering it.

> ### 🔴 Divergence — the reference's tab list hides two of its own settings
>
> Found while building this, 2026-08-11. The **third** entry in § 1.1's *"where LeapDesk's behaviour is
> a defect"* category, which requires the divergence be written down before diverging.
>
> `Security/Index.tsx` builds its tabs as `const tabs = [...groupNames, 'Audit']`, and
> `SecuritySettingSeeder` registers two settings in a group **called `Audit`**
> (`security.audit.credential_decrypt`, `security.audit.permission_changes`). So the tab list contains
> `"Audit"` twice with the same React key, and the body renders
> `tab === 'Audit' ? <AuditTab/> : <settings for groups[tab]>`.
>
> **The activity panel always wins, so those two settings can never be opened.** Two security controls
> — including *"log every API credential decryption"* — are unreachable from the only screen that
> edits them.
>
> Ours names the activity tab **"Recent activity"**, which cannot collide with a group name. Both
> `security.audit.*` controls stay reachable. This is a one-word fix and it is not worth copying the
> bug for parity's sake: the *contents* of the screen are identical, and the owner-visible difference
> is that ours has one more working tab.

The index also renders a **recent audit list** beside the controls — what was changed, by whom. A
security screen with no record of its own edits is a gap, not a feature.

### Module 13 — Feature Flags

```
feature_flags
  id, key (unique 150), name (191), description (500, nullable),
  enabled (bool, default false, indexed),
  target_roles (json, nullable), target_user_ids (json, nullable),
  updated_by → users (nullOnDelete), timestamps
```

Full CRUD plus a `toggle` endpoint. The two `target_*` JSON columns are what make it a flag system
rather than a boolean table: a flag can be on for one role, or for three named people, without a
schema change.

### Module 14 — Webhooks

**Depends on Module 10** — an endpoint belongs to an `api_consumer`, not to a user.

```
webhook_endpoints
  id, api_consumer_id → api_consumers (cascade), name (191), url (500),
  secret (text), events (json), is_active (bool, indexed),
  last_delivery_at, failure_count (uint, default 0), disabled_at,
  created_by → users (nullOnDelete), timestamps

webhook_deliveries
  id, webhook_endpoint_id → webhook_endpoints (cascade),
  event (100, indexed), payload (json),
  response_status (smallint, nullable), response_body (text, nullable),
  attempts (tinyint, default 0), duration_ms (uint, nullable),
  delivered_at, failed_at, timestamps
  index (webhook_endpoint_id, created_at)
```

**Three mechanics to copy exactly:**

1. **HMAC signing.** `hash_hmac('sha256', timestamp + '.' + json, secret)`, sent as
   `X-LeapDesk-Signature: sha256=…`. The timestamp is **inside** the signed string, which is what stops
   a captured payload being replayed later.
2. **Backoff `[30, 120, 600]` seconds over 3 attempts.** Their comment is the reasoning: *"a receiver
   that is down is usually down for minutes, not milliseconds."*
3. **A 4xx is not retried; a 5xx is.** A receiver rejecting the payload will reject it again.

`failure_count` + `disabled_at` are an auto-disable circuit breaker — an endpoint that has been failing
for days stops being retried forever.

**Endpoints:** full resource, plus `POST {webhook}/test` and
`POST {webhook}/deliveries/{delivery}/redeliver`. The delivery log with a redeliver button *is* the
module; without it, a webhook that failed silently is unrecoverable.

### Module 15 — API Documentation

**Generated, not written.** `ApiDocsController::index` renders the resource catalogue from
`api_resources` (Module 10) plus a constant `OPERATORS` list — so the docs cannot go stale relative to
what the API actually exposes.

**We start ahead here.** We already commit an OpenAPI document (`backend/openapi.json`, PM-42) that is
generated from the FastAPI app and CI-checked for staleness. A docs *page* is a renderer over that
document, and the honest version of this module for us is "serve the OpenAPI spec and a viewer", not
"build a second catalogue".

### Module 16 — Queue Monitor

```
queue_job_runs
  id, job_uuid (36, nullable, indexed), queue (64, indexed), job_class (255, indexed),
  status (20, indexed), attempts (tinyint), queued_at, started_at, finished_at,
  duration_ms (uint, nullable), exception (text, nullable),
  payload_summary (json, nullable), timestamps
  index (queue, status, queued_at)
```

Five read views — index, pending, failed, history, scheduled — and five operations: retry one, retry
all, forget one, purge pending, purge dead. **The permission is split `system.queues.view` vs
`system.queues.manage`**, which is right: seeing the queue is backlogged is an ops concern, purging it
is a destructive one.

> ⚠️ **We have no queue.** There is no Celery, no RQ, no background worker anywhere in this codebase —
> every write is synchronous inside the request. **This module is not portable until something is
> queued**, and building the monitor first would produce a page that says "0 jobs" forever. Its real
> prerequisite is whatever first needs a background job — most likely outbound email, which is
> currently synchronous and is the thing most likely to make a request hang.

### Module 17 — Error Tracking

```
error_groups
  id, fingerprint (32, unique), exception_class (255, indexed), module (32, indexed),
  route_name (191, nullable), method (10, nullable), path (500, nullable),
  file (500), line (uint), latest_message (text),
  status (20, default 'open', indexed), occurrence_count (uint, default 0),
  first_seen_at, last_seen_at (both indexed),
  resolved_by → users (nullOnDelete), resolved_at, notes (text), timestamps
  index (status, last_seen_at)

error_occurrences
  id, error_group_id → error_groups (cascade), user_id → users (nullOnDelete),
  ip (45), url (1000), method (10), message (text), stack_trace (text),
  context (json), occurred_at (indexed), timestamps
  index (error_group_id, occurred_at)
```

**The fingerprint is the whole design**, and it is four fields:

```php
md5(exception_class | file | line | route_name)
```

That is what turns 40,000 log lines into 12 rows you can actually triage. **Note what is deliberately
absent: the message.** Two failures differing only in an interpolated id group together, which is
correct — they are one bug.

Triage is `status` (`open` → resolved), `notes`, and a **"create bug report"** action that opens a
FeedbackHub item from the error. Two-table split is right: the group is what you triage, the
occurrences are the evidence.

### Module 18 — System Health

**No tables.** It composes what the other modules already know: storage, database, third-party provider
reachability, an error summary from Module 17, and queue totals plus **worker liveness** from Module 16.

Its own docblock states the discipline worth copying: *"Deliberately small: queue and error detail live
in their own modules, and this page links across rather than restating them."* The one write is
`POST probe/{slug}` — check a provider on demand and report the round-trip in ms.

### Recycle Bin

**Restore or permanently remove soft-deleted records.** LeapDesk's docblock: *"Before this existed
every delete in the core was permanent."*

Soft deletes were added to exactly four tables: **`users`, `user_invitations`, `api_consumers`,
`searchable_entities`, `data_access_grants`.** Not everything — which is the point. A table gets
`deleted_at` when losing a row is recoverable-worthy, not by default.

**The security detail to copy:** `type` is validated against a service-level allowlist
(`Rule::in(array_keys(RecycleBinService::TYPES))`) — *"a raw string from the request is never resolved
to a class name."* Without that, `type` is an arbitrary-model-load primitive.

Two operations, both `POST`/`DELETE` on a collection with `{type, id}` — no per-model routes, so adding
a restorable table is a service-map entry rather than a new controller.

---

### The CRUD shape does not fit all eight

`UI_PATTERNS.md` § The module CRUD contract makes the Users index the mandatory shape for every
module. **Six of these nine surfaces are not CRUD**, and forcing them into it would produce exactly the
"empty three-dot menu" the Activity Log work already rejected:

| Surface | Index table | Create | Edit | Delete | Notes |
|---|---|---|---|---|---|
| Feature Flags | ✅ | ✅ | ✅ | ✅ | The only full CRUD of the eight |
| Webhooks | ✅ | ✅ | ✅ | ✅ | Plus a nested delivery log |
| Configuration | ❌ grouped cards | ❌ | ✅ inline | ❌ | **Corrected 2026-08-11 — see below** |
| Security | ❌ grouped cards | ❌ | ✅ inline | ❌ | Needs prose per control |
| Error Tracking | ✅ | ❌ | ✅ status/notes | ✅ | Triage, not authoring |
| Queue Monitor | ✅ ×5 | ❌ | ❌ | ✅ purge | Operations, not records |
| Recycle Bin | ✅ | ❌ | ❌ | ✅ purge | Plus restore |
| System Health | ❌ dashboard | ❌ | ❌ | ❌ | Read-only |
| API Docs | ❌ | ❌ | ❌ | ❌ | Generated |

**The contract still applies to all of them — the parts of it that are about consistency.** The table,
the filter row, the column factories, the modal shells, the toast, the ink tokens: those are universal.
What varies is which *actions* exist, and the contract already says so in its own words: *parity means
the same vocabulary, not the same feature list.*

> **Correction, 2026-08-11 — Configuration is not a table, and this section said it was.**
>
> The row above originally read *"Index table ✅"*. Building it disproved that: the reference renders
> **grouped `module · group` sections with an inline editor per row**, not a data table. The reasons
> hold for us too, and they generalise —
>
> - **There is no row to open**, so there is no row action, so a table's principal affordance is
>   missing.
> - **Five types need five editors** — a toggle, a number, a line, a textarea, a JSON box. A table
>   column has one cell renderer.
> - **Nobody compares settings.** A table exists to let you scan rows against each other and pick one;
>   a settings screen is a thing you arrive at already knowing which key you came for. Headings find it
>   faster than a sortable grid.
>
> The general lesson, which is what makes this worth recording rather than just fixing: **the presence
> of an index does not imply the presence of a table.** Security, Recycle Bin and System Health are all
> "list something" screens and none of them wants a `DataTable` either — the question to ask is whether
> rows are *compared* or merely *found*.

---

## New permissions to seed

**19 additions — 14 original plus Module 10's 5.** Names normalised to PM's `{resource}-{action}`
convention, per the correction above. The first 14 were seeded on or before 2026-08-07 (34 permissions
live in the database); Module 10's five are **not** seeded and are listed as specification.

| Group | Permissions | State |
|---|---|---|
| `data-access` | `data-access-view`, `data-access-manage` | ✅ Seeded |
| `api-credentials` | `api-credential-{view,create,update,delete}`, `api-provider-{view,create,update,delete}` | ✅ Seeded |
| `search` | `search-entity-manage` | ✅ Seeded |
| `ai-assistant` | `ai-assistant-use`, `ai-assistant-query-database` | ✅ Seeded |
| `users` | `user-email` | ✅ Seeded |
| `settings` | `settings-view`, `settings-update` | ✅ Seeded |
| **`platform-api`** | **`api-consumer-{view,create,update,delete}`, `api-token-manage`** | ⬜ **Module 10 — not seeded** |

`role-permissions` already exists in PM. Role grants follow LeapDesk: Admin and above get everything;
Staff gets `data-access-view` and `ai-assistant-use`; Partner gets neither the admin modules nor
`ai-assistant-query-database`.

**Module 10 diverges on one grant: Staff gets none of its five**, including view. Who holds standing
machine access to our data is not general staff information, and there is no workflow reason to widen
it — unlike `data-access-view`, which Staff does hold and which
`data_access_service.list_grants` already flags as questionable for the same reason.

---

## Migrations required

| # | Migration | Tables / columns |
|---|---|---|
| 1 | Password OTP grace | `users.password_otp_verified_at` (+ `password_reset_otps` if a table is preferred over reusing the reset token) |
| 2 | Role nav preferences | `roles.nav_preferences` JSON nullable |
| 3 | Data access | `data_access_grants` |
| 4 | API credentials | `api_service_providers`, `api_credential_schemas`, `api_credentials`, `api_credential_values`, `slack_notification_channels` |
| 5 | Global search | `searchable_entities`, `search_logs` |
| 6 | AI assistant | `agent_conversations`, `agent_conversation_messages`, `ai_message_feedback` |
| 7 | Activity source | stamp `properties->source` on write (data/behaviour change, may need no DDL) |
| 8 | **Platform API** (Module 10) | `api_consumers`, `api_consumer_tokens`, `api_request_logs` |

**Module 10's three tables carry constraints the others do not.** `api_consumer_tokens.token_hash` is
`String(64)` and **must be uniquely indexed** — it is the lookup key on every authenticated API request,
and without the index the gate degrades to a scan. `consumer_id` is `CASCADE` (a credential must die
with its consumer) while `created_by` is `SET NULL` (the audit of who issued it outlives them) — the
same split already used in `data_access_grants`. `api_request_logs` needs
`(consumer_id, created_at)` and `(endpoint, created_at)` indexes and, unlike anything else in this plan,
**a retention policy**: it records every request *including rejections*, so it grows fastest exactly
when something is wrong.

**All FKs to `users` are `String(36)`** — PM's `users.id` is a UUID string, not a bigint. Roles use an
Integer PK. LeapDesk's `bigint` IDs do not transfer.

---

## Build order

Dependencies constrain this more than preference does:

```
1. Settings shell (Profile / Password / Appearance)   ← no migration for profile; smallest slice
2. Invitations admin index                            ← backend already done, UI only
3. Users send-email  +  Roles matrix / clone / users   ← small, self-contained
4. Server-driven navigation  →  role nav preferences   ← prerequisite for 3d
5. Data Access                                        ← first new table; closes half of PM-5
6. Activity Log gaps (sandbox first — it's a live leak)
7. API Credentials                                    ← largest; unblocks 9, helps PM-28
8. Global Search                                       ← LocateData depends on it
9. AI Assistant                                        ← needs 7 (Anthropic key) and 8 (LocateData)
10. Platform API (Part I only)                         ← independent of 5–9; gated on a product decision
```

**Two things could jump the queue.** Activity Log 4a is a live over-exposure of other users' audit rows —
arguably it belongs at position 1 as a fix rather than a parity item. And the Password UI closes an
endpoint that exists but is unreachable, which is a real user-facing hole.

**Module 10 is placed last, but not because it depends on anything.** It shares no table and no service
with modules 5–9 and could be built at any point. It is last because **nothing currently needs it**: we
have no machine consumer, no external integration, and no data worth exposing until the marketplace
domain exists. It moves up the moment one of three things happens — a real integration is requested, the
partner-directory product is chosen (a partner-facing API becomes plausible product scope), or we decide
the marketplace domain needs programmatic access from the start.

> **One piece of Module 10 should be pulled forward regardless of when the module is built:** the
> `Principal` type described in its § *a machine consumer is not a `User`*. It is shared with PM-5 and
> with the partner-directory work, and introducing it before three call sites exist is far cheaper than
> retrofitting it after.

---

## Open decisions

Genuinely undecided; none blocks steps 1–3:

1. ~~**Permission naming**~~ — **settled in code 2026-08-07: normalised to PM's `{resource}-{action}`.**
   See the correction under § Permission naming. Kept numbered so the list below does not shift.
2. **Password OTP grace** — column on `users` (recommended), reuse `password_reset_token`, or a scoped JWT.
3. **Credential caching** — no cache (recommended first cut), in-process TTL, or add Redis.
4. **`role-permissions` as its own route** — split it out (recommended) or leave the service-layer check.
5. **Two-Factor in the settings sub-nav** — LeapDesk has it commented out; PM has working 2FA. Match
   LeapDesk (leave it out of the sub-nav) or surface it as a fourth tab.
6. **`level` / `department` on the role-users response** — add the columns or drop the fields
   (recommend drop).
7. **Self-delete on the profile page** — LeapDesk has it; PM's protection rules forbid self-delete.
   Recommend not building it.
8. **Whether Data Access ships before or after the marketplace `partner_id` scoping.** They're
   complementary; building delegation first means the tenant filter arrives later and must compose with it.

**Four more, added 2026-08-10 with Module 10:**

- **Is Module 10 in scope at all right now?** It is real parity work, but it serves no current need —
  see § Build order. **Recommendation: spec it now (done), build it when something asks for it.** The
  alternative reading is that machine access should be designed before the domain exists rather than
  bolted on after, which is a defensible argument for building it early.
- **`Principal` — take it once or three times?** A shared union type for user / machine / anonymous
  callers, versus letting Module 10, PM-5 and the partner directory each solve it locally.
  **Recommendation: take it once, before any of the three.** This is the highest-leverage item on this
  page and the only one whose cost rises with every week it is deferred.
- **Part II — the generic resource engine.** Recommendation is to skip it entirely for now. The
  decision genuinely reopens if the partner-directory product is chosen, since partner-facing
  programmatic access to their own listings becomes plausible scope. **Do not treat "skip" as
  permanent** — treat it as contingent on a product decision that has not been taken.
- **Token expiry default.** LeapDesk allows never-expiring tokens and its owner chose that, noting it
  is *"defensible once the admin UI + rotation reminders exist."* We would ship the UI but not the
  reminders. **Recommendation: default to an expiry (365 days) with never-expires available but not
  preselected** — the opposite of LeapDesk's default, on the grounds that a token nobody remembers
  issuing is the failure mode here.

---

## Verification standard

PM has no test suite ([PM-11](./TECH_DEBT.md#pm-11--no-automated-tests), deliberately deferred), so per
the mitigation recorded there: **every permission or data-visibility path built here gets its
verification recorded in [`../DAILY_CHANGES.md`](../DAILY_CHANGES.md)** — what was run, against which
role, and what it returned. That applies with particular force to Data Access (module 6),
`DatabaseQuery`'s five controls (module 9), and Global Search's three permission layers (module 8),
none of which fail loudly when they're wrong.

---

## Related Documentation

- [`../core/AUTHORIZATION.md`](../core/AUTHORIZATION.md) — the RBAC this extends
- [`../core/USERS.md`](../core/USERS.md) — the unified `users` table
- [`../core/AUTHENTICATION.md`](../core/AUTHENTICATION.md) — PM's invitation and password flows
- [`../system-design/UI_PATTERNS.md`](../system-design/UI_PATTERNS.md) — authoritative for how PM's UI is built
- [`TECH_DEBT.md`](./TECH_DEBT.md) — PM-5 (scoping), PM-11 (tests), PM-28 (Google SSO)
- [`MARKETPLACE_DOMAIN_PLAN.md`](./MARKETPLACE_DOMAIN_PLAN.md) — **parked** until this plan lands
- [`PARTNER_DIRECTORY_PLAN.md`](./PARTNER_DIRECTORY_PLAN.md) — shares Module 10's `Principal` finding
  from the anonymous-visitor angle; the two should be settled together
- LeapDesk source: `/opt/lampp/htdocs/LeapDesk` — read directly; its `documentation/` covers Users,
  Roles, Invitations, Activity Log and UI patterns, but **not** Data Access, API Credentials, Global
  Search or the AI Assistant, which exist only as code
- **LeapDesk's own Platform API tracker:**
  [`documentation/planning/LEAPDESK_PLATFORM_API.md`](/opt/lampp/htdocs/LeapDesk/documentation/planning/LEAPDESK_PLATFORM_API.md)
  — the exception to the line above. 584 lines covering the design, a line-by-line code review with ten
  findings, ten programme phases, a file map, eight owner decisions and a post-deploy production
  verification table. **Read it before building Module 10**; this plan summarises it but does not
  replace it, and it is the only reference module that documents its own mistakes
