# Partner Marketplace Core — Authorization System

**Rebuilt:** 2026-07-31 · **Status:** implemented and verified

> Authorization is **declarative per route**: every protected endpoint names the permission it needs
> via `Depends(require_permission(...))`. An endpoint without one is ungated — and obvious in review.

---

## Overview

`Users → Roles → Permissions`, the LeapDesk model, ported to FastAPI.

```
users ──user_roles──> roles ──role_permissions──> permissions ──> permission_groups
                        │                                              (display only)
                        └─ RootUser · SuperAdmin · Admin · Staff · Partner · User
```

| Aspect | Implementation |
|---|---|
| Where it's enforced | `core/dependencies.py` guards, declared on each route |
| Super-admin bypass | `RootUser` / `SuperAdmin` pass every check, in **one** place: `User.has_permission` |
| Model-level rules | `user_service` predicates and `rbac_service` guards |
| Data visibility | `User.has_admin_access` — admins see all rows, others see only their own |
| Vocabulary | `core/permissions.py` — the single source of truth the seeder writes from |
| Frontend | `permissions` resolved server-side into `GET /api/v1/auth/me`, read via `usePermissions()` |

### The one deliberate divergence from LeapDesk

LeapDesk derives the permission from the route name (`users.index` → singular `user` + verb map
`index→view` → `user-view`), with a `$routePermissionMap` for anything non-standard. That is clever
but fails **silently** when a path doesn't match the convention.

FastAPI's idiomatic equivalent is explicit and better:

```python
@router.get("", response_model=PaginatedUsers)
def list_users(actor: User = Depends(require_permission(USER_VIEW))):
```

It appears in OpenAPI, cannot mis-match, and an ungated route stands out. The trade is losing
automatic derivation — which, given the silent-failure mode, is a gain.

---

## Roles

Seeded as `is_system = True` and referenced by name in code, so they cannot be renamed or deleted.

| Role | Bypass | Admin access | Seeded permissions |
|---|:---:|:---:|---|
| `RootUser` | ✅ | ✅ | all (wildcard) |
| `SuperAdmin` | ✅ | ✅ | all (wildcard) |
| `Admin` | — | ✅ | all (wildcard, but **no bypass**) |
| `Staff` | — | — | dashboard, view users/roles/permissions, create invitations |
| `Partner` | — | — | dashboard only |
| `User` | — | — | dashboard only (default for a new account) |

**`Admin` holds every permission but does not bypass.** That distinction is what makes the protection
rules meaningful: an Admin can manage users, yet still cannot touch a SuperAdmin or grant a
super-admin role.

Three constants in `core/permissions.py` drive this:

```python
SUPER_ADMIN_ROLES  = {RootUser, SuperAdmin}          # bypass every check
ADMIN_ACCESS_ROLES = {RootUser, SuperAdmin, Admin}   # see all data, not just own
PROTECTED_ROLES    = {RootUser, SuperAdmin, User}    # cannot be renamed or deleted
```

---

## Permissions

Naming, inherited from LeapDesk: **`{resource}-{action}`, resource singular, kebab-case.**

**43 permissions in 12 groups**, counted from the running database on 2026-08-10. Actions are
`view` / `create` / `update` / `delete`, plus domain verbs where they earn their place
(`user-approve`, `partner-verify`).

| Group | Count | Permissions |
|---|---|---|
| `dashboard` | 1 | `dashboard-view` |
| `users` | 6 | `user-view`, `user-create`, `user-update`, `user-delete`, `user-approve`, `user-email` |
| `roles` | 5 | `role-view`, `role-create`, `role-update`, `role-permissions`, `role-delete` |
| `permissions` | 1 | `permission-view` |
| `invitations` | 4 | `invitation-view`, `invitation-create`, `invitation-resend`, `invitation-cancel` |
| `activity` | 1 | `activity-view` |
| `settings` | 3 | `settings-manage`, `settings-view`, `settings-update` |
| `partners` | 9 | `partner-view`, `partner-create`, `partner-update`, `partner-delete`, `partner-approve`, `partner-verify`, `partner-publish`, `partner-tier-view`, `partner-tier-manage` |
| `data-access` | 2 | `data-access-view`, `data-access-manage` |
| `api-credentials` | 8 | `api-credential-*` (4), `api-provider-*` (4) |
| `search` | 1 | `search-entity-manage` |
| `ai-assistant` | 2 | `ai-assistant-use`, `ai-assistant-query-database` |

> This table previously read "23 permissions in 7 groups" and listed `categories` and `candidates` —
> groups whose **tables and permissions were deleted on 2026-08-06**. It had been wrong since then.
> Re-measured rather than incremented, which is the only way a count like this stays true.

**The `partners` group splits three verbs the obvious design would have merged into `partner-update`**,
and the split is the point:

| Permission | Grants |
|---|---|
| `partner-approve` | Activate / suspend. **Gates login for every account in that organisation** |
| `partner-verify` | Sets `verification_level` — what Leapswitch publicly vouches for. `PARTNER_DIRECTORY_PLAN.md` § 9 ranks it above any paid placement, so whoever holds it hands out the platform's credibility |
| `partner-publish` | Flips `is_listed`. The only permission whose effect is visible to the **anonymous internet** |

Four of the twelve groups (`data-access`, `api-credentials`, `search`, `ai-assistant`) are **seeded
ahead of their code** — deliberately, so each module starts with its guards available. A permission
with no route behind it is inert.

**Permissions are reference data, not user-editable.** There is no write endpoint: a permission no
route checks grants nothing, and one the code references must exist. The catalog lives in code; the
database follows it. Administrators compose **roles**.

`user-approve` is separate from `user-update` on purpose — approving is the gate that SSO does not
open, so it can be delegated without handing over full editing.

---

## The Guards

`core/dependencies.py`. Every guard raises; none returns `None`.

| Guard | Checks | Failure |
|---|---|---|
| `get_current_user` | valid access token → row exists → **status is ACTIVE** | 401 / 403 |
| `require_permission(p)` | …plus holds `p` (super admins bypass) | 403 |
| `require_any_permission(*p)` | …plus holds at least one | 403 |
| `require_roles(*names)` | …plus holds one of the roles | 403 |
| `require_super_admin` | …plus is RootUser/SuperAdmin | 403 |
| `require_admin_access` | …plus sees all data | 403 |

All are wired to real routes (they were dead before — PM-7). Prefer `require_permission`: a role check
bakes org structure into a route.

**Status is re-read from the database on every request**, never trusted from the token. Suspending an
account therefore ends live sessions at once — verified.

---

## Protection Rules

The rules that make the difference between "has a permission" and "may do this to this target".
Enforced in `user_service`, as predicates shared by both the write paths and the `can_*` flags — so
the UI and the API cannot disagree.

| Rule | Effect |
|---|---|
| Cannot delete your own account | 400 |
| Cannot change your own status | 400 — no locking yourself out, no self-approval |
| Cannot change your own roles | 400 — no self-promotion |
| A super-admin target may only be edited by a super admin | 403 |
| A super-admin target can never be deleted through the API | 403 |
| Only a super admin may **grant** a super-admin role | 403 — closes PM-3 |
| Only admin-access actors may set `status` or `role_ids` | 403 |
| A protected role cannot be renamed or deleted | 400 |
| A role with users assigned cannot be deleted | 400 — reassign first |
| Only a super admin may edit a super-admin role's permissions | 403 |

Bulk operations **skip** protected targets and report why, rather than failing the whole batch:

```json
{ "requested": 5, "affected": 3, "skipped": 2,
  "skipped_reasons": ["root@…: super-admin accounts are protected",
                      "self@…: cannot delete your own account"] }
```

Surface `skipped_reasons` in the UI. Swallowing them makes a partial success look total.

---

## Data Visibility

```python
if not actor.has_admin_access:
    stmt = stmt.where(User.id == actor.id)      # see only yourself
```

Applied in `user_service.list_users` and `invitation_service.list_invitations` (own invitations only).
`GET /api/v1/users/{id}` returns **404**, not 403, for someone else's record — a 403 would confirm it
exists.

⚠️ **There is still no central partner-scoped ownership model** (TECH_DEBT PM-5), and as of
2026-08-10 the first table that needs one exists. `partner_service.list_partners` and
`get_partner_for` filter on `actor.partner_id` **by hand**, which
[`../planning/MARKETPLACE_DOMAIN_PLAN.md`](../planning/MARKETPLACE_DOMAIN_PLAN.md) § Row-Level Scoping
rule 1 explicitly forbids — *"never write `where(partner_id == ...)` in a service"*. Both sites are
marked `# PM-5` so they can be found and replaced when `app/services/scoping.py` lands.

Two things that hand-rolled filter does get right, and any replacement must keep:

- **It reaches the SQL.** Post-filtering a page corrupts the count — the caller is told there are 40
  rows and handed 12.
- **A staff account without admin access and without a `partner_id` sees `WHERE id IS NULL`, i.e.
  nothing.** Scoping them on `partner_id` would have matched every row, which is the failure mode
  worth naming: the conservative branch has to be the *default*, not the exception.

The directory adds a second axis this section does not yet cover — **anonymous reads**. See
[`../planning/PARTNER_DIRECTORY_PLAN.md`](../planning/PARTNER_DIRECTORY_PLAN.md) § 7 and § 7.1: every
guard here resolves to a `User`, and a public route has no user at all.

### The organisation gate

Since 2026-08-10 `get_current_user` performs a **fourth** check, after the account's own status:

```python
# app/core/dependencies.py
_assert_organisation_active(user)   # partner_id IS NULL (staff) falls straight through
```

A user whose `partners.status` is `PENDING` or `SUSPENDED` is refused with **403**, whatever their own
`users.status` says. That is what makes suspending a partner **one action** rather than a hunt through
every login that belongs to it — and the one you forget is the one that matters. Suspension also
revokes the members' live sessions, so reinstating an organisation does not silently restore sessions
opened before it was stopped.

---

## Route Authorization Matrix

| Method | Route | Requires |
|---|---|---|
| GET | `/api/v1/users` | `user-view` (scoped) |
| GET | `/api/v1/users/{id}` | `user-view` (self only without admin access) |
| POST | `/api/v1/users` | `user-create` |
| PATCH | `/api/v1/users/{id}` | `user-update` + protection rules |
| DELETE | `/api/v1/users/{id}` | `user-delete` + protection rules |
| POST | `/api/v1/users/{id}/approve` | `user-approve` |
| POST | `/api/v1/users/{id}/toggle-status` · `/unlock` | `user-update` |
| POST | `/api/v1/users/bulk-delete` · `bulk-status` | `user-delete` · `user-update` |
| GET | `/api/v1/roles` · `/api/v1/roles/{id}` | `role-view` |
| POST/PATCH/DELETE | `/api/v1/roles*` | `role-create` / `role-update` / `role-delete` |
| GET | `/api/v1/permissions` | `permission-view` |
| GET | `/api/v1/invitations` | `invitation-view` (own only without admin access) |
| POST | `/api/v1/invitations` · `/bulk` | `invitation-create` |
| POST | `/api/v1/invitations/{id}/resend` | `invitation-resend` |
| DELETE | `/api/v1/invitations/{id}` | `invitation-cancel` |
| GET | `/api/v1/invitations/preview` | **none** — the invitee has no account yet |
| GET | `/api/v1/partners` | `partner-view` (own organisation only without admin access) |
| GET | `/api/v1/partners/{id}` | `partner-view` — **404**, not 403, for another organisation |
| POST | `/api/v1/partners` | `partner-create` — always creates PENDING |
| PATCH | `/api/v1/partners/{id}` | `partner-update` — cannot reach status, verification or listing |
| DELETE | `/api/v1/partners/{id}` | `partner-delete` — 409 while the organisation still has users |
| POST | `/api/v1/partners/{id}/status` | `partner-approve` — suspension revokes member sessions |
| POST | `/api/v1/partners/{id}/verification` | `partner-verify` |
| POST | `/api/v1/partners/{id}/listing` | `partner-publish` — 409 unless the partner is ACTIVE |
| GET | `/api/v1/partners/tiers` | `partner-tier-view` |
| PATCH | `/api/v1/partners/tiers/{id}` | `partner-tier-manage` |

> The `categories` / `candidates` row that used to close this table has been removed: those routes and
> their permissions were **deleted on 2026-08-06** with the inherited test-platform domain.

`/api/v1/invitations/preview` is the only intentionally unauthenticated data route. It returns the
invited email, role name, account type and expiry — nothing about the inviter or the wider system.

---

## Frontend Authorization

`GET /api/v1/auth/me` returns `permissions` already resolved, and **for a super admin it is the full
catalog**, expanded server-side. So the frontend has no bypass rule to know about:

```tsx
const { can, hasAdminAccess, isSuperAdmin } = usePermissions();
{can("user-create") && <Button>Add user</Button>}
```

Rows additionally carry `can_edit` / `can_delete` / `can_toggle_status` / `can_approve`, computed per
row against the requesting actor, so the UI never offers an action the API would reject.

**These gate rendering only.** The API re-checks every request and is the authority. A hidden button
is not a security control.

---

## Two Rules That Are Not Route Guards

**Added 2026-08-03**, both from comparing against LeapDesk's `PermissionSeeder` and `RolePolicy`.

### `role-permissions` is separate from `role-update`

LeapDesk splits these — `role-update` for edit/update, `role-permissions` for `updatePermissions` — and
it is right to. **Renaming a role and rewriting what it grants are different risk levels.** Conflated,
anyone who can tidy up a label can also hand out every permission in the catalog.

`PATCH /api/v1/roles/{id}` still declares `role-update`; the service additionally requires
`role-permissions` when the payload carries `permission_ids`. That is the same shape as `update_user`,
where the route requires `user-update` and the service additionally requires admin access to touch
`status` or `role_ids` — **the route states the minimum, the service enforces the rest.**

### The privilege ceiling: you cannot grant what you do not hold

A non-super-admin may only grant a role permissions **they themselves hold**. Super admins bypass,
because a ceiling below your own level is not a ceiling.

This closes a real escalation path. Someone holding a custom role that grants `role-update` could add
`user-delete` to that same role and immediately have it — and **no route guard can catch it**, because
they legitimately hold the permission the route requires. The escalation is in the payload, not the
route.

This code previously carried a comment arguing no ceiling was needed *"because the catalog currently
holds nothing more dangerous than the role-management permissions themselves"*. That stopped being true
the moment `user-delete` and `activity-view` existed. **Reasoning from the current contents of a list
that grows is how a safe assumption expires without anyone noticing** — worth remembering next time an
argument depends on what is in a catalog today.

Verified: an actor holding only `Staff` was refused `user-delete` with a 403 naming it, allowed
`dashboard-view` which they do hold, and a super admin was allowed `user-delete`.

---

## Seeding

Two seeders, deliberately separate — the vocabulary and the people change on different schedules.

| Command | Seeds |
|---|---|
| `python -m app.db.seed_rbac` | Permissions, groups, system roles, and one bootstrap root account. Reconciles against `core/permissions.py` on every run |
| `python -m app.db.seed_users` | A team roster from a gitignored JSON file — the equivalent of LeapDesk's `PermissionSeeder::createUsers()` |

**`seed_rbac` now fails rather than warns when `ROLE_PERMISSION_MATRIX` names a permission absent from
`PERMISSION_CATALOG`.** It previously printed a warning, which scrolls past six role lines and gets
missed — and the consequence surfaces weeks later as an unexplained 403 that nobody connects back to a
typo. Both sides of that comparison live in the same file, so a mismatch is an inconsistency between two
literals and should never reach a deploy. Ported from LeapDesk's `createRoles()`, which throws for the
same reason.

**Neither seeder ever assigns a permission directly to a user.** This schema has no user-permission
table, so the bypass LeapDesk's own seeder warns about — direct grants defeating role-based access —
is structurally impossible here rather than merely avoided by convention.

---

## Audit Trail Coverage

**Added 2026-08-03 (PM-32).** Recording is **explicit at the call site**, not a global ORM hook. A hook
cannot be forgotten, which is its advantage — and it would log the inherited test-platform domain and
every session `last_seen_at` touch, burying the role grants in noise. The trade-off for choosing explicit
calls is that they *can* be forgotten, so the wired paths are listed here and a reviewer can check this
list against the routes.

> **Rewritten 2026-08-13.** The list below was written for PM-32 and then not touched while seven
> modules shipped their own logging — exactly the drift it exists to catch, caught by the § 8.2
> sweep rather than by a reader. The same sweep found **twelve write paths that logged nothing**
> (role create/clone/delete and rename, both invitation-acceptance paths, self-registration,
> self-service password change, both ends of password reset, profile self-edit, a revoked
> data-access grant silently restored by re-granting, assistant-conversation deletion, and the
> session evictions after a password change or reset); all were wired the same day. When you add a
> write path, add its row here **in the same change** — this note is the precedent for what happens
> otherwise.

### Auth and sessions (`log_name: auth`)

| Action | Event | Where |
|---|---|---|
| Sign-in succeeded | `login` | `api/auth.login`, after the session exists |
| Sign-in failed | `failed_login` | `auth_service.authenticate` — 4 reasons: unknown email, bad password, locked, status-blocked |
| Wrong 2FA code | `failed_login` | `api/auth.two_factor_challenge` |
| Sign-out | `logout` | `api/auth.logout`, only when a session was actually revoked |
| Self-registration | `registered` | `auth_service.register_partner` — the causer is the registrant |
| Own profile edited | `updated` | `auth_service.update_own_profile`, same diff treatment as the admin edit |
| Own password changed | `password_changed` | `auth_service.change_own_password`, with `via`: current password or email OTP |
| Password reset requested | `password_reset_requested` | `auth_service.begin_password_reset` — **no causer**: the requester has proved nothing yet |
| Password reset completed | `password_reset_completed` | `auth_service.complete_password_reset` — also notes the lockout it clears |
| Password OTP sent / failed / verified | `password_otp_*` | `auth_service` OTP flow |
| Session revoked (one) | `session_revoked` | `api/auth` `/me/sessions/{id}` |
| Sessions revoked (bulk) | `sessions_revoked` | `api/auth`: revoke-others button, password change (spares the current session), password reset (spares nothing) — each with the count |
| Refresh anomaly | — | `api/auth.refresh` |
| 2FA enrolled / enabled / disabled | `two_factor_*` | `api/auth` 2FA routes |
| Recovery code used | `recovery_code_used` | `api/auth.two_factor_challenge` |
| Email verified / link sent | `email_verified`, `email_verification_sent` | `api/auth` |

Admin-triggered mass evictions (`revoked_by_admin` on suspend/delete, `password_change` on an
admin-set password) deliberately do **not** write their own row: each rides inside an action that
already logs (`status_changed`, `deleted`, `password_changed`), and a second row per action is the
noise this design rejects.

### Users

| Action | Event | Where |
|---|---|---|
| Account created | `created` | `user_service.create_user` |
| Account edited | `updated` | `user_service.update_user`, with a before/after diff |
| Account deleted | `deleted` | `delete_user` and `bulk_delete`, **with a snapshot** — after a hard delete there is nothing left to describe |
| Status changed | `status_changed` | `toggle_status`, `approve_user`, `bulk_set_status` |
| **Roles granted or revoked** | `roles_changed` | `update_user`, with explicit `granted`/`revoked` lists |
| Lockout cleared | `lockout_cleared` | `unlock_user` |
| Password set by an admin | `password_changed` | `update_user` |
| 2FA reset by an admin | `two_factor_reset_by_admin` | `user_service.reset_two_factor` |
| Email sent to a user | — | `user_service.send_user_email` |

`roles_changed` gets its own event rather than hiding inside an `updated` diff, because in an RBAC system
a role grant is the change most likely to be the subject of *"who did that, and when?"*.

### Roles

| Action | Event | Where |
|---|---|---|
| Role created / cloned | `created` | `rbac_service.create_role`, `clone_role` — the clone records `cloned_from` |
| **Grants changed** | `permissions_changed` | `rbac_service._apply_permissions` — all three writers funnel through it. Before/after by **name**. ⚠️ Gated on the `security.audit.permission_changes` setting |
| Role renamed / re-described | `updated` | `rbac_service.update_role` |
| Role deleted | `deleted` | `rbac_service.delete_role`, with a grant-list snapshot |
| Nav preferences changed | `updated` | `navigation_service.set_role_nav_preferences` |

### Invitations

| Action | Event | Where |
|---|---|---|
| Created / resent / cancelled | `invitation_*` | `invitation_service` |
| **Accepted** | `invitation_accepted` | both paths: `accept_with_credentials` (mints an ACTIVE account + role) and `apply_to_google_user` (replaces the role set, may activate) — the causer is the invitee |

### Data Access

| Action | Event | Where |
|---|---|---|
| Granted / level changed / revoked | `data_access_*` | `data_access_service` |
| **Revoked grant restored by re-granting** | `data_access_granted` with `restored: true` | `create_grant`'s upsert — the un-binning that used to happen silently |

### Everything else

| Module | What logs | Where |
|---|---|---|
| API Credentials | provider + credential CRUD; **every reveal** (`credential_revealed`, ⚠️ gated on `security.audit.credential_decrypt`) | `credential_service` |
| Global Search registry | entity create / update / toggle / delete. Queries themselves go to `search_logs`, a separate table, by design | `search_service` |
| AI Assistant | enable/disable; conversation deletion (**metadata only** — content stays unreadable to others by design) | `ai_service` |
| Recycle bin | restore, purge | `recycle_bin_service` |
| Settings & branding | every write | `settings_service`, `setting_service` |
| Feature flags / webhooks / API consumers / partners | CRUD and state changes | each module's service |

**Deliberately unlogged**, so nobody re-reports them: invitation expiry sweeps (a timer, not an
actor), assistant feedback thumbs, per-message assistant chat (the conversation tables are the
record), and worker runs (`worker_runs` is its own table).

### Reading it

`GET /api/v1/activity` requires the **`activity-view`** permission and filters on log name, event, subject,
actor, description substring and date range. `GET /api/v1/activity/events` lists the event names actually
present, so the filter dropdown is built from the data rather than a hardcoded list that goes stale.

**The read surface is read-only structurally, not by policy.** There is no create, update or delete route
and no service function behind one — every write verb returns `405`. An audit trail a privileged user can
edit is not evidence of anything, so tampering is prevented by the absence of a code path rather than by a
permission that someone could later widen without knowing why it was narrow.

**Not scoped by actor**, deliberately: `activity-view` is the whole authorisation. A partial view of an
audit trail is worse than none — someone reviewing an incident needs to know they are seeing everything.
**This is the first query to revisit when partner scoping lands (PM-5)**, because a partner must never
read another partner's history.

`activity-view` went to Admin and above and **not** to Staff. Staff is a read-across-modules role, and the
trail contains failed-login attempts with addresses and IP addresses for every account.

> Note: adding `activity-view` to the catalog granted it to every **Admin** automatically, because
> `ROLE_PERMISSION_MATRIX` gives Admin `"*"`. That is the documented consequence of the wildcard the owner
> chose to keep on 2026-08-03 — a new sensitive permission must be reviewed against it deliberately.

---

## Adding a Permission

1. Add the constant and a catalog entry in `core/permissions.py`
2. Add it to `ROLE_PERMISSION_MATRIX` for the roles that should hold it (wildcard roles get it free)
3. `python -m app.db.seed_rbac` — idempotent; it reconciles groups, permissions and system-role grants
4. Declare it on the route: `Depends(require_permission(NEW_PERMISSION))`
5. Gate the UI with `can("new-permission")`

The seeder never touches an administrator-created role, so re-running is safe.

---

## What This System Still Lacks

| Missing | Consequence |
|---|---|
| Row-level / partner scoping | PM-5 — the big one before partner data exists |
| Audit trail of authorization decisions | Nothing records who changed what; `created_by`/`updated_by` only |
| Permission dependencies | `user-update` doesn't imply `user-view`; grant both explicitly |
| Per-field permissions | Granularity is per endpoint |
| Automated tests | PM-11 — verified by a shell script, not a suite |

---

## Common Issues and Solutions

| Symptom | Cause / Fix |
|---|---|
| 403 "requires the 'x-view' permission" | The role lacks it. Grant via `PATCH /api/v1/roles/{id}`, then re-login or refetch `/me`. |
| Admin gets 403 editing another admin | Target holds a super-admin role. Only a super admin may. |
| 403 assigning a role | Granting `RootUser`/`SuperAdmin` requires being one. |
| Permissions look stale in the UI | `authSlice` caches from `/me`. Refetch after a role change. |
| New route needs no auth by accident | Nothing catches this automatically — grep the router for `require_permission`. |
| Seeder warns nobody holds a super-admin role | Exactly what it says: grant one before locking yourself out. |
| `.filter(Role.is_protected)` fails | Python property, not a column. Filter on `Role.name` or `Role.is_system`. |
| Bulk action reports fewer affected than requested | Protected targets were skipped. Read `skipped_reasons`. |

---

## Related Documentation

- [`AUTHENTICATION.md`](./AUTHENTICATION.md) — how identity is established
- [`USERS.md`](./USERS.md) — the unified account table
- [`../system-design/FASTAPI_STANDARDS.md`](../system-design/FASTAPI_STANDARDS.md) — router/service conventions
- [`../planning/TECH_DEBT.md`](../planning/TECH_DEBT.md) — PM-5 and PM-11 remain open

---

## Pending

> **Authorization work still outstanding.** Last audited **2026-08-06**. Enforcement *coverage* is
> complete — every one of the 56 routes is permission-gated and every ungated one is intentionally
> public — so nothing below is about a missing guard. What is missing is a **scoping model**, and the
> means to prove any of it stays true.

### 🔴 The one that blocks the marketplace

- [ ] **PM-5 — there is no row-level scoping pattern anywhere.** This is the largest open item in the
      project. Today every authenticated caller with a permission sees **every row** for that resource;
      users and invitations are scoped admin-or-self, and that is the only ownership logic that exists.
      Three things make it urgent rather than merely missing:
  - [ ] **A scoping bug does not raise.** It returns another partner's rows. Nothing in the toolchain
        — `tsc`, `ruff`, `next build`, or the 74 tests — would notice.
  - [ ] **`has_admin_access` already exists and is the intended hinge** (`ADMIN_ACCESS_ROLES`,
        `require_admin_access`). It is a Python property, so it **cannot appear in a SQL filter** —
        the scoping layer has to translate it into a query predicate, not a post-filter. Post-filtering
        a paginated list silently corrupts the page count.
  - [ ] **Design it centrally, once.** Improvising per route is how tenants leak into each other. See
        [`../planning/MARKETPLACE_DOMAIN_PLAN.md`](../planning/MARKETPLACE_DOMAIN_PLAN.md)
        § Required Regardless.
- [ ] **The activity log is the first query to revisit when scoping lands.** `activity-view` is
      currently the entire authorisation, deliberately — a partial view of an audit trail is worse than
      none when someone is reviewing an incident. That reasoning **stops holding** once partners exist:
      a partner must never read another partner's history. This is a documented decision that becomes a
      defect on a known date, so it needs revisiting rather than rediscovering.

### 🟠 Provability

- [ ] **PM-11 — nothing tests enforcement.** The 74 tests added 2026-08-06 cover authentication
      primitives, not authorization. The suite this document needs asserts, per route, that a caller
      **without** the permission gets 403 and a caller **with** it gets 200 — table-driven off the same
      permission constants the guards use, so a new route with no test is visible.
- [ ] **Nothing catches an accidentally-ungated route.** § *Common Issues* says to "grep the router for
      `require_permission`", which is a human step that has to happen every time. A test that walks
      `app.routes` and asserts every non-allowlisted path carries a permission dependency would make it
      structural. The allowlist becomes the explicit record of what is intentionally public.
- [ ] **Audit-trail coverage is recorded by hand.** § *Audit Trail Coverage* lists every wired event so
      a reviewer can check it against the routes — necessary precisely because recording is **explicit
      calls, not a global ORM hook** (a deliberate trade-off, documented in the service docstring).
      Explicit calls can be forgotten, and the list can drift from them. There is no check that they
      agree.

### 🟡 Granularity the model does not have

- [ ] **No permission dependencies.** `user-update` does not imply `user-view`; both must be granted
      explicitly. Workable, and a real source of "why is this 403" confusion — a role granted only
      `user-update` can save a user it cannot list.
- [ ] **No per-field permissions.** Granularity is per endpoint. A partner-facing API that must expose
      some columns and not others will need either separate endpoints or a serialisation layer that
      takes the actor into account.
- [ ] **No authorization decision log.** The audit trail records *what changed*
      (`roles_changed`, `status_changed`, with granted/revoked lists), which covers the important half.
      It does not record *denials* — a burst of 403s against one account is a signal nothing currently
      captures.
- [ ] **`require_roles` exists and hardcodes org structure into routes.** Its own docstring says prefer
      `require_permission`. Worth a periodic grep to confirm it has not spread beyond the cases where
      the rule genuinely is about the role itself.

### 🟡 Consistency

- [ ] **The super-admin bypass is not expanded into `permission_names`.** `has_permission` applies it;
      the raw property does not. Any new code that reads `permission_names` directly instead of calling
      `has_permission` will silently under-authorise a super admin. There is no lint or test for this.
- [ ] **The frontend caches permissions in `authSlice` from `/api/v1/auth/me`.** They go stale after a role
      change until a refetch — listed under § *Common Issues* as a symptom, but there is no invalidation
      mechanism, so it will keep being reported. PM-41's data layer is where a fix would live.
