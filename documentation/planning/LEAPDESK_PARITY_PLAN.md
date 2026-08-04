# LeapDesk Core Parity Plan

**Status: SPEC — awaiting review.** No code or migrations written yet, deliberately.

> Scope was settled on 2026-08-04: replicate LeapDesk's **core admin shell** — the eight modules in its
> two lower sidebar sections, plus the self-service Settings area — in Partner Marketplace's stack.
> The marketplace domain ([`MARKETPLACE_DOMAIN_PLAN.md`](./MARKETPLACE_DOMAIN_PLAN.md)) is **parked**
> until this lands.
>
> Planning docs are reference only — once code exists, the code is the truth. Everything below was read
> from LeapDesk source at `/opt/lampp/htdocs/LeapDesk` on 2026-08-04, not from memory.

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
| | AI Assistant → `/settings/ai-assistant` | `api-credentials.index` |

Source: [`app/Services/NavigationService.php:211-224`](/opt/lampp/htdocs/LeapDesk/app/Services/NavigationService.php).
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
| **Dotted** (diverges) | `data-access.view`, `data-access.manage`, `api-credentials.index`, `api-credentials.providers.{index,create,edit,delete}`, `api-credentials.credentials.{index,create,edit,delete}`, `search.entities.manage`, `ai-assistant.use`, `ai-assistant.query-database` |

**Decision needed.** "Exactly replicate" means adopting the dotted names — which is what the nav,
middleware and Gate calls actually reference. The alternative is normalising to PM's existing
convention (`data-access-view`, `api-credential-view`, …), which is internally cleaner but diverges
from LeapDesk. **Recommendation: adopt LeapDesk's names verbatim**, including the inconsistency — a
future LeapDesk feature that references `data-access.manage` then ports without a rename table.

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
| `GET|PATCH /settings/profile` | `/settings/profile` + existing `PATCH /api/auth/me` | |
| `GET|PUT /settings/password` | `/settings/password` + existing `POST /api/auth/me/change-password` | **UI is the whole gap** |
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

## New permissions to seed

Adopting LeapDesk's names verbatim (pending the decision above), 14 additions:

| Group | Permissions |
|---|---|
| `data-access` | `data-access.view`, `data-access.manage` |
| `api-credentials` | `api-credentials.index`, `api-credentials.providers.{index,create,edit,delete}`, `api-credentials.credentials.{index,create,edit,delete}` |
| `search` | `search.entities.manage` |
| `ai-assistant` | `ai-assistant.use`, `ai-assistant.query-database` |
| `users` | `user-email` |
| `settings` | `settings-view`, `settings-update` |

`role-permissions` already exists in PM. Role grants follow LeapDesk: Admin and above get everything;
Staff gets `data-access.view` and `ai-assistant.use`; Partner gets neither the admin modules nor
`ai-assistant.query-database`.

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
```

**Two things could jump the queue.** Activity Log 4a is a live over-exposure of other users' audit rows —
arguably it belongs at position 1 as a fix rather than a parity item. And the Password UI closes an
endpoint that exists but is unreachable, which is a real user-facing hole.

---

## Open decisions

Genuinely undecided; none blocks steps 1–3:

1. **Permission naming** — adopt LeapDesk's dotted names for new modules (recommended) or normalise to
   PM's `{resource}-{action}`.
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
- LeapDesk source: `/opt/lampp/htdocs/LeapDesk` — read directly; its `documentation/` covers Users,
  Roles, Invitations, Activity Log and UI patterns, but **not** Data Access, API Credentials, Global
  Search or the AI Assistant, which exist only as code
