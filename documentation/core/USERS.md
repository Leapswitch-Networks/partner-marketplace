# Partner Marketplace Core — Users & Accounts

**Rebuilt:** 2026-07-31 · **Status:** implemented and verified

> **One account table.** `users` and `admin_users` were merged by migration `e7b41c9a2d10`. Do not
> introduce a second identity table — add a role. This document described the dual-table model before
> 2026-07-31; that model is gone.

---

## The `users` Table

`backend/app/models/user.py`

### Authentication

| Column | Type | Notes |
|---|---|---|
| `id` | `String(36)` PK | UUID string |
| `email` | `String(255)` unique, indexed | **Lower-cased** on write and lookup |
| `password` | `String(255)` nullable | **bcrypt digest.** NULL for Google-only accounts |
| `email_verified_at` | `DateTime(tz)` | Auto-set for Google sign-ups and admin-created accounts |
| `auth_provider` | enum | `password` \| `google` (LeapDesk's values) |
| `google_id` | `String(255)` unique, indexed | |
| `google_avatar` | `String(500)` | Source for `avatar_url` |

### Profile & classification

| Column | Notes |
|---|---|
| `first_name`, `last_name` | NOT NULL. Replaced the single `name` column (split on migration) |
| `designation`, `employee_id`, `phone` | Optional |
| `company_name` | The partner's organisation; NULL for staff |
| `account_type` | enum `staff` \| `partner`, indexed — drives **signup policy**, never authorization |
| `status` | enum `INACTIVE` \| `ACTIVE` \| `SUSPENDED`, indexed — only ACTIVE may sign in |
| `timezone_preference` | Default `Asia/Kolkata` |

### Security — all of these are written now

Previously six columns existed and none was ever written (TECH_DEBT PM-6). That is fixed:

| Column | Written by |
|---|---|
| `failed_login_attempts` | `auth_service._record_failure` — incremented per failure |
| `locked_until` | same — set once the threshold is hit; login then returns 429 |
| `last_login_at`, `last_login_ip` | `auth_service._record_success`, IP from `get_client_ip` |
| `password_reset_token`, `password_reset_expires_at` | `begin_password_reset` / `complete_password_reset` |

### Audit

`created_by`, `updated_by` (self-referential FKs), `created_at`, `updated_at`.

### Derived properties — not columns

`full_name`, `initials`, `avatar_url`, `is_active`, `is_locked`, `role_names`, `is_super_admin`,
`has_admin_access`, `permission_names`, plus `has_role()`, `has_permission()`,
`has_any_permission()`, `has_all_permissions()`.

⚠️ **None can be used in a SQL filter.** Filter on `User.status` / `User.account_type`, or join roles.

---

## Relationships

```
users ──user_roles──> roles ──role_permissions──> permissions
```

`roles` uses `lazy="selectin"`, as does `Role.permissions`, so a permission check costs a couple of
queries rather than one per role.

---

## What the Migration Did

`e7b41c9a2d10`, applied 2026-07-31. Verified afterwards: 4 accounts folded, all passwords bcrypt,
legacy columns gone, login still working with a pre-migration password.

| Step | Detail |
|---|---|
| Split `name` | → `first_name` / `last_name` on the first space |
| Lower-cased emails | Closes PM-17 |
| **Hashed every plaintext password in place** | Closes PM-1; no credential lost |
| Activated pre-existing accounts | They worked before the migration, so they still do. Only *new* accounts get INACTIVE-by-default |
| Folded `admin_users` → `users` | **Preserving each row's `id`**, so `tests.created_by` stayed valid |
| Mapped roles | `super_admin` → `SuperAdmin`, `admin` → `Admin`, everyone else → `User` |
| Dropped `admin_users`, `users.role`, `users.name` | Plus the `admin_role` and `user_role` enum types |

Two decisions worth knowing:

- **Old `users.role = 'admin'` mapped to the `User` role, not `Admin`.** No route ever checked that
  column, so it granted nothing — mapping it to `User` preserves actual capability instead of
  inventing privilege.
- **`downgrade()` raises `NotImplementedError`.** Reversal would need the original plaintext
  passwords, which are gone by design. Restore a backup instead.

---

## Endpoints

Self-service lives on `/api/auth/*` — see [`AUTHENTICATION.md`](./AUTHENTICATION.md).
Administration is `/api/users/*`, every route permission-gated:

| Method | Path | Requires |
|---|---|---|
| GET | `/api/users` | `user-view` — paginated, searchable, filterable, sortable |
| GET | `/api/users/{id}` | `user-view` — 404 for someone else's row without admin access |
| POST | `/api/users` | `user-create` — password optional (omit for SSO-only staff) |
| PATCH | `/api/users/{id}` | `user-update` |
| DELETE | `/api/users/{id}` | `user-delete` |
| POST | `/api/users/{id}/approve` | `user-approve` |
| POST | `/api/users/{id}/toggle-status` | `user-update` — ACTIVE ↔ INACTIVE only |
| POST | `/api/users/{id}/unlock` | `user-update` — clears a lockout |
| POST | `/api/users/bulk-delete` | `user-delete` |
| POST | `/api/users/bulk-status` | `user-update` |

`toggle-status` deliberately refuses a SUSPENDED account: un-suspending is a decision, not a flip, so
it goes through `PATCH`.

Every response row carries `can_edit` / `can_delete` / `can_toggle_status` / `can_approve`, computed
against the requesting actor using the same predicates the write paths use.

**End users are fully manageable now** — the old model had no endpoints for `users` rows at all.

---

## Where Partners Fit — Resolved

The question this document used to pose is answered: **one table, `account_type` to classify, roles to
authorize.** Chosen over a separate `partners` table because a third identity would mean a third code
path through `refresh`, `/me` and every guard.

Consequences to respect:

- **A partner is currently one login**, not an organisation with several. `company_name` is a text
  field, not a foreign key. If partners need multiple users under one org, add a `partners` table and
  a `partner_id` FK on `users` — the accounts stay where they are.
- **Suspension works for everyone** — `status` is on the shared table.
- **Row-level scoping still does not exist** (PM-5). Users and invitations are scoped admin-or-self;
  there is no "partner sees their own listings" pattern yet. Design it centrally before partner data
  exists — [`../planning/MARKETPLACE_DOMAIN_PLAN.md`](../planning/MARKETPLACE_DOMAIN_PLAN.md).

---

## Seeding

`python -m app.db.seed_rbac` (from `backend/`, or `docker compose run --rm backend …`). Idempotent.

1. Reconciles permission groups and permissions from `core/permissions.py`
2. Creates system roles and re-syncs their grants — **never touches an admin-created role**
3. Creates a root account **only when the users table is empty**, so it can never silently mint a
   second all-powerful account
4. Reports which accounts hold a super-admin role, and warns loudly if none do

The root password comes from `ROOT_PASSWORD`; if unset, a random one is generated and printed once.
**There is no hardcoded default** — a public repo must not ship a working credential.

⚠️ The four inherited accounts still use their pre-migration passwords, which were stored readable.
Rotate them (PM-4).

---

## Common Issues and Solutions

| Symptom | Cause / Fix |
|---|---|
| `InvalidRequestError: expression 'Role' failed to locate a name` | A module imported `User` without `Role` being registered. Import from `app.models` — its `__init__` registers every model. |
| 403 editing another account | Target holds a super-admin role, or you lack `user-update`. |
| 400 "cannot change your own status" | Intentional — no self-approval, no self-lockout. |
| Bulk action affected fewer than requested | Protected rows were skipped. Read `skipped_reasons`. |
| `.filter(User.is_super_admin)` fails | Python property, not a column. Join `roles` and filter on `Role.name`. |
| A user's permissions look stale | They are cached in `authSlice` from `/api/auth/me`. Refetch after a role change. |
| Created a user with no password and they can't sign in | Correct — that's an SSO-only account, and Google SSO requires a staff-domain address. |

---

## Related Documentation

- [`AUTHENTICATION.md`](./AUTHENTICATION.md) — login, tokens, hashing, signup policy
- [`AUTHORIZATION.md`](./AUTHORIZATION.md) — roles, permissions, protection rules
- [`../system-design/DATABASE_MIGRATIONS.md`](../system-design/DATABASE_MIGRATIONS.md) — the revision chain
- [`../planning/TECH_DEBT.md`](../planning/TECH_DEBT.md) — PM-4, PM-5, PM-11 remain open

---

## Pending

> **Accounts and user-management work still outstanding.** Last audited **2026-08-06**. The unified
> table and its 11 admin endpoints are complete and verified; what follows is the modelling that the
> marketplace will force, plus housekeeping.

### 🔴 Modelling the marketplace will force

- [ ] **A partner is one login, not an organisation.** `company_name` is a **text field, not a foreign
      key**, so two people at the same partner are two unrelated accounts with a string that happens to
      match — and nothing prevents `"Acme Ltd"`, `"Acme Ltd."` and `"acme ltd"` coexisting. When
      partners need several users under one org: add a `partners` table and a `partner_id` FK on `users`,
      keeping accounts where they are. **Do not add a second identity table** — a third code path
      through `refresh`, `/me` and every guard is exactly what migration `e7b41c9a2d10` removed.
- [ ] **PM-5 — row-level scoping (see [`AUTHORIZATION.md`](./AUTHORIZATION.md) § Pending).** For this
      table specifically: `list_users` is the query to design first, because it is paginated. Scoping by
      post-filtering a page corrupts the count; the predicate has to reach the SQL.
- [ ] **Deletion is hard delete, with no soft-delete or anonymisation path.** `created_by` / `updated_by`
      are `ON DELETE SET NULL`, so removing an account **erases attribution on every row it touched** —
      and the activity log stores `causer_id` as a plain `String(36)` with no FK, so those rows survive
      pointing at an id that no longer resolves. Decide deliberately: soft delete, anonymise, or accept
      it. Any GDPR-style erasure request makes this urgent, and the audit trail is the tension.

### 🟠 Housekeeping with a real deadline

- [ ] **PM-4 — rotate the four inherited accounts' passwords.** Their values were stored readable
      before being hashed in place. The code is fixed; the credentials are still historically exposed.
- [ ] **PM-11 — no test covers the protection rules.** `can_edit` / `can_delete` / `can_toggle_status` /
      `can_approve` are the predicates that stop an Admin editing a SuperAdmin, and they are used in
      **two** places each — the write path *and* the serialised row flags. Nothing asserts the two agree.
      A drift there means the UI offers a button the API will refuse, or worse, hides one it would allow.
- [ ] **`toggle-status` refusing SUSPENDED is deliberate and undiscoverable.** Un-suspending goes
      through `PATCH`. Confirm the UI surfaces that rather than showing a disabled control with no
      explanation.

### 🟡 Data quality and lifecycle

- [ ] **No uniqueness on `employee_id` or `personal_email`.** Both are plain nullable strings. If
      `employee_id` is meant to identify a person, two accounts can hold the same one today.
- [ ] **`timezone_preference` is a free-text `String(50)` defaulting to `Asia/Kolkata`.** Nothing
      validates it against the IANA database, so an invalid value fails at render time rather than at
      write time.
- [ ] **`profile_photo_path` is a `String(2048)` and there is no upload endpoint.** The column
      anticipates a feature that does not exist — the same shape as PM-6's dead columns, which
      *"suggest features that don't exist"*. Either build the upload or note in the column comment that
      only `google_avatar` is populated.
- [ ] **Nothing purges anything (PM-43).** `user_sessions` grows by one row per sign-in forever;
      `session_service.purge_expired` exists and no scheduler calls it. Session rows are cheap to look
      up by primary key, but backups, `VACUUM` and the active-sessions screen all notice.

### Documentation accuracy — this file

- [ ] § *Profile & classification* lists **`phone`**; the column is
      **`personal_mobile_number`** (`String(30)`). The table also omits `personal_email`,
      `profile_photo_path`, `sidebar_preference`, and the 2FA and password-OTP column groups — all of
      which exist on the model. A reader sizing up the schema from this table will undercount it.
- [ ] § *What the Migration Did* says folding preserved each row's id **"so `tests.created_by` stayed
      valid"**. The `tests` table was dropped by migration `c1e70a5d94b2` on 2026-08-06. The *reason*
      was sound at the time; the justification now references a table that no longer exists.
- [ ] § *Seeding* attributes the rotate-passwords warning to **PM-4**, which is closed. The rotation
      itself is still genuinely outstanding — keep the item, correct the framing.
