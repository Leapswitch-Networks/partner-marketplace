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
| Frontend | `permissions` resolved server-side into `GET /api/auth/me`, read via `usePermissions()` |

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

23 permissions in 7 groups. Actions are `view` / `create` / `update` / `delete`, plus domain verbs
where they earn their place (`user-approve`).

| Group | Permissions |
|---|---|
| `dashboard` | `dashboard-view` |
| `users` | `user-view`, `user-create`, `user-update`, `user-delete`, `user-approve` |
| `roles` | `role-view`, `role-create`, `role-update`, `role-delete` |
| `permissions` | `permission-view` |
| `invitations` | `invitation-view`, `invitation-create`, `invitation-resend`, `invitation-cancel` |
| `categories`, `candidates` | inherited domain, gated until removed |

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
`GET /api/users/{id}` returns **404**, not 403, for someone else's record — a 403 would confirm it
exists.

⚠️ **There is still no partner-scoped ownership model** (TECH_DEBT PM-5). The current rule is the
conservative one: admin, or self. Before any partner-owned data exists, design row-level scoping
centrally — see [`../planning/MARKETPLACE_DOMAIN_PLAN.md`](../planning/MARKETPLACE_DOMAIN_PLAN.md).

---

## Route Authorization Matrix

| Method | Route | Requires |
|---|---|---|
| GET | `/api/users` | `user-view` (scoped) |
| GET | `/api/users/{id}` | `user-view` (self only without admin access) |
| POST | `/api/users` | `user-create` |
| PATCH | `/api/users/{id}` | `user-update` + protection rules |
| DELETE | `/api/users/{id}` | `user-delete` + protection rules |
| POST | `/api/users/{id}/approve` | `user-approve` |
| POST | `/api/users/{id}/toggle-status` · `/unlock` | `user-update` |
| POST | `/api/users/bulk-delete` · `bulk-status` | `user-delete` · `user-update` |
| GET | `/api/roles` · `/api/roles/{id}` | `role-view` |
| POST/PATCH/DELETE | `/api/roles*` | `role-create` / `role-update` / `role-delete` |
| GET | `/api/permissions` | `permission-view` |
| GET | `/api/invitations` | `invitation-view` (own only without admin access) |
| POST | `/api/invitations` · `/bulk` | `invitation-create` |
| POST | `/api/invitations/{id}/resend` | `invitation-resend` |
| DELETE | `/api/invitations/{id}` | `invitation-cancel` |
| GET | `/api/invitations/preview` | **none** — the invitee has no account yet |
| GET/POST/PATCH/DELETE | `/api/categories*` · `/api/candidates*` | `category-*` / `candidate-*` |

`/api/invitations/preview` is the only intentionally unauthenticated data route. It returns the
invited email, role name, account type and expiry — nothing about the inviter or the wider system.

---

## Frontend Authorization

`GET /api/auth/me` returns `permissions` already resolved, and **for a super admin it is the full
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
| 403 "requires the 'x-view' permission" | The role lacks it. Grant via `PATCH /api/roles/{id}`, then re-login or refetch `/me`. |
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
