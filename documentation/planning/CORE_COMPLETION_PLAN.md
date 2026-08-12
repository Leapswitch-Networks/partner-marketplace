# Core Completion Plan — Partner Marketplace

> **Goal: the core, 100%.** Eight modules, one consistent shape, no duplicated plumbing.
> Written 2026-08-07 from a direct read of the LeapDesk source at `/opt/lampp/htdocs/LeapDesk` and of
> this project's own code — **not from memory, and not from the other planning docs.** Where a claim
> came from measurement, the measurement is shown.
>
> Companion to [`LEAPDESK_PARITY_PLAN.md`](./LEAPDESK_PARITY_PLAN.md), which holds the per-module
> schemas and endpoint specs. **This file holds the shape, the shared layer, and the order.** Read
> this one first; go there for field-level detail.

---

## 1. What LeapDesk is to us, and what it is not

LeapDesk is a **Laravel 12 + Inertia + React 19** app. This project is **FastAPI + Next.js 14 App
Router**. Nothing ports literally; the *conventions* port, the code does not.

**Its structure already draws the line we need:**

| LeapDesk | Contains | For us |
|---|---|---|
| `app/`, `resources/js/pages/` | The **core** — Users, Roles, Data Access, Activity Log, API Credentials, Invitations, Global Search, AI Assistant | ✅ **This is our scope** |
| `app-modules/` | `qmas`, `presales`, `inventory`, `feedbackhub` — its domain | ❌ **Not ours.** Different product, different purpose |

Partner Marketplace serves a different business purpose from LeapDesk. We take its **core admin
shell** because it is a proven, stable core — not its domain, its language, or its data model.

### 1.1 The parity contract — what "exactly like LeapDesk" means

**Owner's instruction, 2026-08-07: these modules must be exactly what LeapDesk has. The only
difference is the tech stack.** That is the standard. It needs one line drawn through it, because the
same owner also asked for DRY, optimised, and "show our backend skills" — and taken literally at the
code level, those two instructions contradict each other.

The line is **behaviour versus implementation**:

| | Standard | Why |
|---|---|---|
| **What the user sees and can do** | 🔒 **EXACT PARITY. No drift.** | Every screen, field, label, filter, sort option, bulk action, row action, empty state, validation rule, permission gate, status transition and edge case. If LeapDesk has it, we have it. If LeapDesk forbids it, we forbid it |
| **How it is built** | ✅ **Ours, and better** | Different language, different framework, different ORM, different rendering model. A 1:1 code port is not possible, and where LeapDesk's internals are weak (§ 1.2) copying them would violate the *other* instruction |

**Worked example — the Users index.** LeapDesk filters by search, status, role, team lead, level and
department; sorts on any column; paginates 10/25/50/100; supports row selection with protected rows;
and offers bulk delete and status change.

- ✅ **We must have every one of those.** Same filters, same options, same defaults, same behaviour.
- ✅ **We must not have it as a 70-line if-chain in the router.** It goes through `ListSpec` (§ 3.1).
- 🔒 **The user cannot tell the difference.** That is the point — identical behaviour, better engine.

**The only sanctioned behaviour differences**, each already agreed:

1. **Visual theme** — our Viho tokens, not LeapDesk's shadcn palette. Explicitly agreed.
2. **QMAS / Presales / Inventory features** — excluded by scope. This product has a different
   purpose, stated by the owner. That is why `slack_qmas` and `slack_presales` are dropped from the
   provider catalogue (Appendix A.2): they notify features this product does not have.
3. **Where LeapDesk's behaviour is a defect, not a feature** — an unrestricted sort column (§ 1.2) is
   not parity worth keeping. **Anything in this category must be written down here before it is
   diverged from.** The list is currently: sort-column allowlist. Nothing else.

Everything else is parity. **If in doubt, match LeapDesk.**

#### Registered divergences

Every entry here was found by a § 8.1 audit and is a deliberate, recorded
decision — not drift.

| Module | Divergence | Why |
|---|---|---|
| Users | **No `team_lead_id`, `level` or `department` filters** | Those columns do not exist here. They model LeapDesk's internal staff org; this product's equivalent axis is `account_type` (staff/partner), which LeapDesk has no concept of. Also the standing recommendation in `LEAPDESK_PARITY_PLAN.md` § Open decisions #6 |
| Users | **Email has no attachments** | The reference accepts 25MB of pdf/doc/xls/image. Needs upload plumbing the endpoint does not have. **Genuine gap, not a decision** — build it when attachments are asked for |
| Users | **Per-page offers 15 as well as 10/25/50/100** | Ours is a superset; 15 is the reference's default but not one of its options, which means its own default is unselectable. Keeping it selectable is strictly better |
| Users | **Extra row actions: Clear lockout, Reset 2FA** | Ours has account lockout and 2FA; the reference does not. Additive, so no behaviour of theirs is lost |

#### Users index — § 8.1 audit, 2026-08-10

Read from `resources/js/pages/Users/Index.tsx` (936 lines) with our screen beside it.
**Brought to parity:** heading (`Users Management` + a users glyph), description
(*"Manage users and their permissions"*), `Add User`, search placeholder
(`Search users...`) with a leading magnifier, filter placeholders (`All Status`,
`All Roles`, `All Types`), the `Role` column header (singular), row-action labels
and order (View → Edit → Approve User → Send Email → … → Delete), the bulk labels
(`Set Active` / `Set Inactive` / `Delete Selected`), the selection counter
(`3 of 137 user(s) selected`), and the empty state (`No users found` /
`No users match your filters` + `Create First User`).

Filters and the column picker already shared one row in the reference; ours were
stacked and were merged the same day, so that now matches too.

**What remains different, and why:**

| Difference | Category | Reason |
|---|---|---|
| Status filter offers **three** options (Active / Pending approval / Suspended), theirs two (Active / Inactive) | Data model | `SUSPENDED` is a real state in our `users` table. Offering two would make a populated status unfilterable |
| `INACTIVE` renders as **"Pending approval"**, theirs renders the raw enum `INACTIVE` | Better, kept | Ours names what the state *means* — the account is awaiting approval. Registered rather than reverted |
| Data columns are **Type · Company · Sign-in · Last login · Created**; theirs are **Level · Department · Updated At** | Data model | Same reason as the filters above — those columns do not exist here, and ours do not exist there |
| Their **`Updated At` column renders `created_at`** | 🔴 **Their defect, not copied** | Header and accessor disagree in the source. Ours is labelled `Created` and shows `created_at`, which is at least self-consistent. **Second entry in the § 1.1 defect category, after the sort-column allowlist** |
| Role badges use our brand tone; theirs hardcodes red/purple/blue per role name | Sanctioned #1 | Visual theme is ours |
| **Row-action items have no icons**; theirs has a lucide glyph per item | ⚠️ **Genuine gap** | `RowActions` has no icon slot and we have no icon library — these are inline SVGs. Additive work, not yet done. **Not a decision — a to-do** |

#### Registered divergences — Users (audit 2026-08-12)

Found by comparing `UserController::index` and `pages/Users/Form.tsx` against ours, LeapDesk source
open beside it. **One was a defect and is fixed; the rest are sanctioned and recorded here so they
cannot drift back into being accidents.**

| Aspect | LeapDesk | Ours | Why |
|---|---|---|---|
| Search covers the **role name** | yes | **now yes — was a gap** | Typing "Admin" returned nothing here and every administrator there. Fixed, not registered: a person notices this on their first day |
| `level`, `department`, `team_lead_id` filters and fields | present | absent | HR-chart columns that do not exist on our `users` table. The parity plan already recommended dropping them for `role-users`; the same reasoning covers the index and the form |
| `account_type` filter (staff / partner) | none | present | Ours. The reference has no partner/staff split; we do, and it is the most useful filter on the screen |
| `company_name` searched | no | yes | Follows from the above |
| Non-admin visibility | users they **created** | **only themselves** | Ours is stricter. There is no team concept and no partner-scoped ownership yet (PM-5); "users I created" would leak accounts across partners the moment there are any |
| Default sort | `id desc` | `created_at desc`, `id` tiebreak | Same result — newest first — with a total order. `created_at` alone is not unique |
| Per-page options | 10 · 25 · 50 · 100 | 10 · **15** · 25 · 50 · 100 | Superset. 15 is the default in both |
| Password on create | required, `min:8`, confirmed | optional, same strength floor | A Google-only account has no password. **Checked during the audit**: `validate_password_strength` is wired to `CreateUserRequest` and enforces `PASSWORD_MIN_LENGTH` |

#### Registered divergences — Roles (audit 2026-08-12)

Compared against `RoleController` and `pages/Roles/*`. **No defect found.** The differences are all
deliberate, and two of them run in opposite directions, which is the useful thing the audit surfaced.

| Aspect | LeapDesk | Ours | Why |
|---|---|---|---|
| `RootUser` in the list | **excluded from the query** | shown, badged **Protected**, uneditable | Concealing a role that holds every permission is worse than showing one nobody can touch. An administrator should be able to see that it exists; the guards, not the query, are what stop them changing it |
| Non-admin visibility | roles they **created** | all roles, to anyone holding `role-view` | **Looser than theirs, deliberately** — the opposite direction from Users, and for the opposite reason. A role is configuration, not a personal record; `created_by` scoping renders the screen *empty* for every reader who has not authored a role, which is worse than useless |
| Pagination and search | server-side, `paginate(15)` | client-side over the whole list | § 4.2's recorded decision: `/api/roles` returns six rows unpaged, so `useResourceList` would mean a round trip per keystroke |
| Sort | `created_at desc` | `is_system desc, name asc` | System roles first, then alphabetical. A role is looked up by name, not discovered by recency — the same reasoning Feature Flags uses |
| `guard_name` searched | yes | n/a | Spatie's concept; we have no guard column |

**Edge cases verified against a live Admin account** rather than read from the source — § 8.1 asks
for "confirmed blocked, not merely hidden":

| Attempt | Result |
|---|---|
| Admin edits the SuperAdmin role | **403** — only a super admin may modify a super-admin role |
| Admin deletes a protected role | **400** — system role, cannot be deleted |
| Admin rewrites SuperAdmin's grants | **403** — same guard, via the new `role-permissions` route |

#### Registered divergences — API Credentials (audit 2026-08-12)

Compared against `ApiCredentialController`, `ApiCredentialValue` and the `api-credentials` route
group. **No defect found, and ours is stricter in three places** — each recorded here because "we
were stricter" is only a defence if someone wrote down that it was on purpose.

| Aspect | LeapDesk | Ours |
|---|---|---|
| Route gating | The whole group sits under `['auth','verified','admin.access']` with **no `can:` middleware of its own** — the data-access group two lines below has one | **Every route** carries `api-credential-*` or `api-provider-*`, proven by `test_route_enforcement.py` |
| Re-auth before decrypting | `reauth:credential_decrypt` is registered on `show`/`edit` and, in their own comment, **"defaults to off"** | Reveal **always** requires a fresh password confirmation, and writes an audit row naming the field and the IP |
| The edit form | `edit()` decrypts **every** value into the form — a provider's whole key set in an HTML response, on a page load meant to change a label | Encrypted fields arrive **empty**; blank on save means "leave it alone" |
| Masking | Their model's `maskedValue()` keeps the last N characters; their `show()` **bypasses it** for a fixed `••••••••` | Their model's algorithm, translated faithfully — including the short-value case — so the screen can say *which* key is stored without revealing it |

**Not ported, deliberately:**

* **Slack notification channels** (`slack-channels` — list, store, update, toggle, test, destroy). A
  LeapDesk alerting feature with no equivalent here; we hold Slack only as a credential provider row.
* **A `verify` / test-connection action.** Recorded when the module was built: none of the four
  seeded providers has a safe probe — `google` and `anthropic` need a real billed request, `mail` an
  SMTP connection, `slack` posts a visible message into someone's channel. `verification_status` and
  `last_verified_at` exist, so a per-provider verifier is a service function away.

### 1.2 What we deliberately do NOT copy

This matters as much as what we do copy. Each of these was measured today:

| Do not copy | Evidence | What we do instead |
|---|---|---|
| **Fat controllers with hand-rolled filter chains** | `UserController@index` is a **70-line** if-block chain; the file is **620 lines**. `RoleController` 482, `ApiCredentialController` 339, `ActivityLogController` 277 | Thin routers → services → a **shared list pipeline** (§ 3) |
| **Unrestricted sort columns** | `$sortBy = $request->input('sort_by', 'id'); $query->orderBy($sortBy, $sortOrder);` — any column, including ones never meant to be exposed | Per-resource **allowlist**. We already do this in `user_service._SORTABLE`; generalise it |
| **Index pages of ~1000 lines** | `pages/Users/Index.tsx` is **936 lines**, with its filter bar inline. There is **no shared Filters component** in LeapDesk — `components/` has only `filter-reset-button.tsx` | A shared `ResourceIndex` + `FilterBar` (§ 4) |
| **Its DataTable's pagination contract** | Takes Laravel's `PaginationData` with `links[]` and `onPageChange(url: string)` — Inertia-coupled | **Keep ours.** It is already at feature parity and better suited (§ 4.1) |
| **Its colour theme** | shadcn/neutral + per-tone hardcoded palettes in `show-page.tsx` | Our Viho token layer — `brand`, `surface-wash`, `ink`, `night` |
| **`components/datatable/`** | Dead directory — **0 references**. `components/data-table/` is the live one (12 refs) | Ignore it entirely |

> **The honest summary:** LeapDesk's *core scope and conventions* are excellent and worth adopting
> wholesale. Its *implementation of the shared layer* is the weakest part of it — because there
> mostly isn't one. That gap is precisely where this project can be better, and it is what "show our
> backend skills" means in practice.

---

## 2. The module contract — every module has the same three pages

Stated in Laravel terms first, since that is the mental model, then translated.

| Laravel | Route | Purpose | Our FastAPI + Next.js |
|---|---|---|---|
| `index()` | `GET /users` | Filters + datatable | `app/(app)/<module>/page.tsx` → `GET /api/v1/<module>` |
| `create()` | `GET /users/create` | Empty form | `app/(app)/<module>/new/page.tsx` — **same component as edit** |
| `store()` | `POST /users` | Persist new | `POST /api/v1/<module>` |
| `show()` | `GET /users/{id}` | Detail view | `app/(app)/<module>/[id]/page.tsx` → `GET /api/v1/<module>/{id}` |
| `edit()` | `GET /users/{id}/edit` | Prefilled form | `app/(app)/<module>/[id]/edit/page.tsx` — **same component as create** |
| `update()` | `PUT /users/{id}` | Persist edit | `PATCH /api/v1/<module>/{id}` |
| `destroy()` | `DELETE /users/{id}` | Delete | `DELETE /api/v1/<module>/{id}` |

### 2.1 One Form component, two modes

LeapDesk's pattern, verified in `pages/Users/Form.tsx`, and the one we adopt:

```tsx
export default function UserForm({ user }: { user?: User }) {
    const isEditMode = !!user;
    const form = useForm({ first_name: user?.first_name ?? '', /* … */ });
    // submit branches on isEditMode: PATCH /users/{id}  vs  POST /users
}
```

The record is **optional**. Present → edit; absent → create. Defaults, page title, breadcrumb and
submit target all derive from that single boolean. **One component, never two.**

### 2.2 ⚠️ This is a real change from what we do today

We are **modal-based**, not page-based. Verified:

- `UsersModule.tsx` carries `type ModalMode = "create" | "edit" | "delete" | null` and renders
  `<UserFormModal>` for both create and edit.
- `/dashboard/add-user/page.tsx` is **not a form page** — it renders `<UsersModule initialModal="create" />`,
  i.e. the index page with a modal auto-opened.
- **There are no Show pages anywhere in the project.**

So adopting Index/Form/Show is not a gap-fill; it is a **deliberate migration** of the two modules we
already have. Decide it once, here, and apply it to all eight.

> **Recommendation: adopt pages, keep modals for confirmations only.** A modal cannot hold the field
> count that Users, API Credentials or Data Access need, cannot be linked to, cannot be deep-linked
> from an email, and loses its state on reload. Keep `Modal` for delete confirmation and quick
> actions — which is what LeapDesk does (`delete-confirmation-modal.tsx`, `quick-view-modal.tsx`).

### 2.3 Route shape

```
/dashboard/users                 index   (filters + datatable)
/dashboard/users/new             create  ← ResourceForm, no record
/dashboard/users/{id}            show    (detail)
/dashboard/users/{id}/edit       edit    ← ResourceForm, with record
```

`/dashboard/add-user` and `/dashboard/all-users` get retired into `/dashboard/users`. Both currently
render the same component anyway.

---

## 3. The backend shared layer — build this FIRST

**Nothing else in this plan is worth doing until this exists**, because every module after it either
uses it or duplicates it. This is the part LeapDesk does not have.

Today `list_users`, `list_entries` and `list_invitations` each hand-roll filter + sort + paginate.
Three implementations, three sets of bugs. Eight modules would make it eight.

### 3.1 `app/core/listing.py` — one list pipeline

```python
@dataclass(frozen=True)
class ListSpec:
    """Everything a list endpoint needs, declared once per resource."""
    sortable: dict[str, InstrumentedAttribute]   # allowlist — never raw user input
    default_sort: str
    searchable: Sequence[InstrumentedAttribute]  # OR-matched for ?search=
    filters: dict[str, Filter]                   # name → column + operator
    max_per_page: int = 100

def apply_listing(query: Select, spec: ListSpec, params: ListParams) -> Select: ...
def paginate(db: Session, query: Select, page: int, per_page: int) -> Page[T]: ...
```

Requirements, each of which is a defect we avoid rather than a nicety:

- [ ] **Sort allowlist is mandatory.** `spec.sortable` maps a public name to a column. An unknown key
      falls back to the default — it never reaches SQL. This is the LeapDesk gap in § 1.2, and the
      **one sanctioned behaviour divergence** registered in § 1.1.
- [ ] **`per_page` clamped** to the allowlist, defaulting on anything else.
- [ ] **Search is one OR group** across `spec.searchable`, so callers cannot forget the parenthesis
      and silently widen a filtered query — a classic bug in hand-rolled chains.
- [ ] **One count query, one page query.** No `len(query.all())`.
- [ ] **Stable ordering.** Always append a unique tiebreak column, or pagination duplicates rows
      across pages when the sort key ties.

### 3.2 `Page[T]` — one response envelope

```python
class Page(BaseModel, Generic[T]):
    items: list[T]
    page: int
    per_page: int
    total: int
    pages: int
```

Every list endpoint returns this. The frontend gets one shape to handle, and `types/api.d.ts`
generates it once. **Do not** copy Laravel's `links[]`/`from`/`to` envelope — it exists to serve
Blade/Inertia URL pagination, which we do not use.

### 3.3 `app/core/crud.py` — ✅ done 2026-08-07, and smaller than specified

**This section originally called for a CRUD base class** — `list`, `get_or_404`, `create`, `update`,
`delete`, with modules subclassing and overriding. **Reading the real write paths killed that idea,
and it was the right call to abandon it:**

- `user_service.update_user` runs permission predicates, snapshots an audit diff *before* mutating,
  and gates `status` and `role_ids` behind separate admin checks. A generic `update()` would be
  overridden in full — inheritance buying nothing but indirection.
- `invitation_service` has no plain update at all. Its writes are resend, cancel and accept, each
  with its own state machine.
- `FASTAPI_STANDARDS.md` § 3 specifies services as **module-level functions**, `db` first and `actor`
  last. A base class would introduce a second way of doing the same thing, which `AGENTS.md` § Core
  Principles forbids.

**What shipped instead:** `get_or_404(db, Model, pk, label=None)` — the one part that was genuinely
identical everywhere. Five call sites had drifted to four different messages for the same failure
("User not found", "Role not found", "Invitation not found", "This invitation link is not valid."),
and a client cannot branch on prose.

It is also **the seam for row-level scoping (PM-5)**: when a partner may only read its own rows, the
check belongs in one function rather than at every `db.get()` in the codebase. Not implemented — the
docstring says so explicitly, so nobody assumes it authorises anything today.

- [x] `get_or_404` raises a consistent 404 body
- [x] The two-404 masking in `invitation_service._get_owned_or_404` preserved — a caller who does not
      own an invitation gets the *same* 404, not a 403, so the endpoint cannot confirm that an
      invitation exists for an address they cannot see
- [ ] ~~PATCH semantics in a base class~~ — **not done, and not to be done.** `exclude_unset=True`
      already appears in the three services that need it. Hoisting it would mean hoisting the audit
      snapshot and permission gates that surround it

> **The general lesson, worth keeping:** the shared layer earns its place where behaviour is
> *identical*, not merely *similar*. Reads were identical and became `run_list`. Single-row fetches
> were identical and became `get_or_404`. Writes only looked similar.

### 3.4 Cross-cutting concerns, as dependencies not copy-paste

LeapDesk uses traits (`LogsAllActivity`, `HasDataAccess`). Our equivalent is FastAPI dependencies:

- [x] **`require_permission`** — already exists in `app/core/dependencies.py`, alongside
      `require_any_permission`, `require_roles`, `require_super_admin`, `require_admin_access` and
      `require_password_confirmation`. **Audited 2026-08-07: every route carries a guard except the
      14 that must be public** — register, verify-email, resend-verification, refresh,
      two-factor-challenge, forgot/reset-password, the three Google OAuth legs, invitation preview,
      and the three public branding reads the sign-in page needs *before* anyone is logged in.
      There is no ungated route that should be gated.
      *"Make it the only way a route is gated" was the wrong goal.* Six guards exist because
      self-service (`/me/*`), permission-gated, super-admin and password-confirmed are genuinely
      different questions. Branding writes, for instance, require **super-admin *and* a password
      confirmation** — stronger than any permission check.

- [ ] **Activity logging — keep the explicit calls.** § 3.4 originally wanted one hook on the CRUD
      base so modules were audited by construction. There is no CRUD base (§ 3.3), and more
      importantly `activity_service`'s docstring already **records a deliberate decision against the
      global-hook approach**: SQLAlchemy has the equivalent events, but wiring them globally logs
      every write in the app including the session `last_seen_at` touches, and *"an audit trail full
      of noise is one nobody reads"*.
      That trade-off is understood and documented — explicit calls can be forgotten where a hook
      cannot — and the mitigation is that the security-relevant paths are listed in
      `AUTHORIZATION.md` so a reviewer can check the list against the routes. **Do not override an
      existing documented decision to satisfy a line in this plan.** Per-module work: add the call,
      and add the path to that list.

- [x] **Data-access scoping seam** — marked in `get_or_404`, which is the single place a per-row
      visibility check belongs. The docstring states plainly that it authorises nothing today, so
      nobody mistakes the seam for the feature.

> **Sequencing note:** that seam is where **PM-5** (row-level scoping) and **module 5 (Data Access)**
> meet. It exists now, empty, because retrofitting it into eight modules later is the expensive
> version. Note the list side has its own seam: `list_users` already narrows by
> `actor.has_admin_access`, so scoping has two entry points to keep consistent, not one.

---

## 4. The frontend shared layer

### 4.1 Keep our DataTable — do not port LeapDesk's

Measured comparison:

| Capability | LeapDesk `data-table/` | Ours `common/DataTable.tsx` |
|---|---|---|
| Sort / select / bulk / column visibility / pagination | ✅ | ✅ |
| Loading, error, retry states | ❌ | ✅ `loading` `error` `onRetry` |
| "No data" vs "filters hid everything" | ❌ | ✅ `filtersActive` `onResetFilters` |
| Viewport-measured scroll box, sticky head | partial (`maxBodyHeight`) | ✅ measured, `useAutoPerPage()` |
| Pagination contract | Laravel `PaginationData` + `links[]` URLs | page numbers — matches our fetch model |

Ours is ahead, and its docstring already says it follows LeapDesk's standard — it was ported once
already. **Porting it again would be a regression.** Two genuine gaps worth taking:

- [ ] `fitContent` / `maxBodyHeight` escape hatches for embedding a table in a scrolling page
- [ ] Fix the sticky header: it is `bg-brand/10`, **translucent**, with no opaque `<th>` fill, so
      rows scroll visibly through it. `UI_PATTERNS.md` mandates an opaque background

### 4.2 What to build — ✅ built 2026-08-07

- [x] **`useResourceQuery`** (`lib/hooks/`) — page, per-page, sort, filters, debounce, selection, and
      query-string sync. Enforces the three coordination rules that were hand-written `useEffect`s in
      `UsersModule` and are bugs when forgotten: a filter change resets to page 1, a filter change
      clears the selection, and text filters debounce while dropdowns do not.
- [x] **`FilterBar`** (`components/common/`) — declarative `text` / `select` filters, always-visible
      Reset disabled when nothing is active. `dateRange` deferred: no module needs it until Activity
      Log, and inventing the API before its first consumer is how it ends up wrong.
- [x] **`ResourceIndex`** (`components/common/`) — header, filters, table, paging. **The piece that
      keeps our index pages short.**
- [x] **`ResourceForm`** (`components/common/`) — the `record?: T` shell, `beforeunload` guard while
      dirty, focus-first-error, and a consistent footer.
- [x] **`ShowPage` primitives** (`components/common/`) — `ShowPageHeader`, `ShowPageGrid`,
      `ShowPageMain`, `ShowPageSidebar`, `InfoCard`, `MetaCard`, `Field`, `AuditCard`. Shape ported;
      tones delegate to `Badge` rather than the reference's hardcoded emerald/rose/amber palette.

**Two decisions worth keeping:**

1. **`useResourceQuery` does not use `useSearchParams()`.** That hook opts a route into dynamic
   rendering and throws at build time unless every consumer sits in a `<Suspense>` boundary, and
   `next build` currently prerenders `/dashboard/*` as **static** — adopting it would break the build
   or force a Suspense wrapper into eight pages. It uses `history.replaceState`, which is not a
   navigation and adds no history entry per keystroke.
2. **The URL is read in a mount effect, not during render**, because the server has no `window` and
   deriving it during render would fail hydration. That needs a targeted
   `react-hooks/set-state-in-effect` disable, justified in a comment at the site. It is the only
   suppression in the new code, and lint is back to its pre-existing 17 — **none of them in these
   files**.

> ⚠️ **These have not been rendered yet.** They typecheck, lint clean and build, but nothing imports
> them until module 1 migrates `UsersModule`. Treat the first migration as the real test — and expect
> to change the APIs when a real screen meets them.

### 4.3 Component rules

- Everything composes from `components/common/*`; a module never restyles a primitive
- No inline `fetch()` — all calls go through `lib/api/*` (`NEXTJS_STANDARDS.md`)
- No business logic in a page; pages wire components to hooks
- Every colour utility needs a `dark:` variant, and colours come from tokens, never hexes

---

## 5. Module-by-module — current state → target

> ⚠️ **This table was stale and is corrected below — re-measured 2026-08-12.** It described API
> Credentials, Global Search and AI Assistant as "❌ nothing" and permissions as "0 of 14 seeded".
> All three shipped on 2026-08-11 and **54 permissions are seeded**, every route gated (proven by
> `tests/test_route_enforcement.py`, which walks all 120 gated routes). Left visible rather than
> deleted: this file warns against trusting the *other* plan's marks, and it had drifted the same
> way. The lesson is the file's own — measure before you work from a table.

**Measured 2026-08-12.** All eight modules are built. What is *not* done for any of them is the
§ 8.1 parity audit, which is the thing this plan says decides whether a module is finished.

| # | Module | Built | § 8.1 audit |
|---|---|---|---|
| 1 | **Users** | ✅ index, form, show, `user-email` with attachments | ✅ **audited 2026-08-12** — Index, Form, Show, permissions, edge cases. One gap found and fixed |
| 2 | **Roles** | ✅ index, form, show, matrix, clone, role-users, nav-preferences | ✅ **audited 2026-08-12** — no defect; five divergences registered, three protections verified live |
| 3 | **Data Access** | ✅ table, service, screen | ⬜ |
| 4 | **Activity Log** | ✅ source stamping, filters, labels, links, causer sandbox | ⬜ |
| 5 | **Invitations** | ✅ backend + admin UI | ✅ **audited 2026-08-12** — found and fixed a privilege-escalation path: Staff could invite an Admin |
| 6 | **API Credentials** | ✅ 4 tables, Fernet at rest, masked by default | ✅ **audited 2026-08-12** — no defect; ours stricter in three places, two features deliberately not ported |
| 7 | **Global Search** | ✅ 2 tables, three permission layers | ⬜ |
| 8 | **AI Assistant** | ✅ 3 tables, 3 tools, read-only connection | ⬜ |

<details>
<summary>The original table, as written on 2026-08-06 — kept for the record</summary>


| # | Module | Backend today | Frontend today | Remaining |
|---|---|---|---|---|
| 1 | **Users** | `users.py` 222 + `user_service.py` 687 — list/create/update/delete ✅ | Index ✅ (modal create/edit) | Migrate to Index/Form/Show · `user-email` action · Show page |
| 2 | **Roles** | `roles.py` 121 + `rbac_service.py` 268 ✅ | Index ✅ | Matrix · clone · role-users · nav-preferences UI · Show page |
| 3 | **Data Access** | ❌ nothing | ❌ nothing | Whole module + `data_access_grants` table + 2 permissions. **Closes half of PM-5** |
| 4 | **Activity Log** | `activity.py` 198 + `activity_service.py` 489 ✅ list, export, purge | Index ✅ | `source` stamping · `hide_system` · module labels · clickable subjects · causer sandbox (defence in depth) |
| 5 | **Invitations** | `invitations.py` 173 + `invitation_service.py` 302 ✅ **complete** | ❌ **no admin UI** | **UI only — smallest slice, highest ratio of value to effort** |
| 6 | **API Credentials** | ❌ nothing | ❌ nothing | Largest. 5 tables, encryption + masking, `CredentialManager` resolution chain, 9 permissions. Gates module 8 |
| 7 | **Global Search** | ❌ nothing | ❌ nothing | 2 tables, 3 permission layers, 1 permission |
| 8 | **AI Assistant** | ❌ nothing | ❌ nothing | 3 tables, 2 permissions, 5 security controls. Needs 6 (key storage) + 7 (LocateData) |

</details>

> **Do not trust the ⬜ marks in `LEAPDESK_PARITY_PLAN.md` without re-checking.** That file's Progress
> block is dated 2026-08-04 and its migration head (`f5a3c81b7d29`) is already stale — the real head
> is `d8c31f60a927`. Its § 4a also still calls the Activity Log a "live over-exposure" that should
> jump the queue; **that was retracted in its own § Progress and I verified the retraction** —
> `activity-view` is held only by Admin, RootUser and SuperAdmin, identical to LeapDesk's
> `has_admin_access()`. There is no leak. Fix that section before anyone acts on it.

---

## 6. Priority — what to build, in what order

### 6.0 Before module 1 — four prerequisites, not modules

These are not optional and they are not parallel with module work. Each one, skipped, gets paid for
eight times over.

| P | Work | Why it must come first |
|---|---|---|
| **P0** | Commit the 90 uncommitted paths | Nothing below is safe on top of an uncommitted tree. Two files are staged *deleted*, two staged *added*. [`PLANNING.md`](./PLANNING.md) § 2 |
| **P1** | **Backend shared layer** (§ 3) | Every module after it either uses it or duplicates it. Duplicated eight times is LeapDesk's 620-line controller, eight times |
| **P2** | **Frontend shared layer** (§ 4) | Same argument. This is what stops our index pages becoming 936-line ones |
| **P3** | **Seed the 14 permissions** | Modules 5, 6, 7, 8 cannot be gated without them. **Settle the dotted-vs-dashed naming decision first** — changing it after seeding means a migration *and* a re-seed |

> P1 and P2 are the whole bet of this plan. If they are done well, modules 2–8 get progressively
> cheaper. If they are skipped, this becomes eight independent rewrites.

### 6.1 Three kinds of work, not one

**Only four of the eight modules are greenfield.** Calling all eight "build" misstates both the
effort and the risk, so the order groups them by what the work actually is:

| Kind | Modules | What it means |
|---|---|---|
| **A — Upgrade** | Users · Roles · Activity Log | Backend **already works**. The work is bringing the frontend to the § 2 standard and filling parity gaps. Lower risk: if something breaks, it is the new shared layer, not new backend code |
| **B — Finish** | Invitations | Backend **100% complete**, **no UI at all**. Pure frontend, but from zero rather than a migration |
| **C — Build** | Data Access · API Credentials · Global Search · AI Assistant | Nothing exists. New tables, new permissions, new endpoints, new UI |

**Group A comes first, all three together.** Three reasons:

1. **The mechanical work is shared** — modal → page, add a Show page, move filters onto `FilterBar`.
   Done back to back it is one pattern applied three times; interleaved with greenfield modules it is
   three separate context switches.
2. **The backends already work, so the shared layer is the only variable.** That makes P1/P2 defects
   obvious instead of ambiguous.
3. **By the time the first greenfield module starts, the shared layer has three real consumers.**
   Building Data Access on an abstraction proven three times is a different proposition from building
   it on one proven once.

### 6.2 The order

| # | Module | Kind | Size | State today | Why it sits here |
|:-:|---|:-:|:-:|---|---|
| **1** | **Users** | A | M | `users.py` 222 + `user_service.py` 687 ✅ · Index ✅ · modal create/edit · **no Show** | **The reference implementation** — the other seven copy its shape. Also the hardest existing module: many fields, role assignment, status toggle, bulk actions, protected rows, self-edit rules. It stress-tests P1/P2 while they are still cheap to change |
| **2** | **Roles** | A | M–L | `roles.py` 121 + `rbac_service.py` 268 ✅ · Index ✅ · matrix, clone, role-users, Show **all missing** | Confirms the pattern transfers **and** stresses its edge in one go. Four new screens, and the permission matrix is a genuinely different shape from a datatable — **if `ResourceIndex` hosts it without special-casing, the abstraction is sound** |
| **3** | **Activity Log** | A | **S** | `activity.py` 198 + `activity_service.py` 489 ✅ list/export/purge · Index ✅ | Smallest of the three, and **read-only** — no Form at all. That makes it the test of whether the layer *degrades gracefully* when a module needs only part of it. Also **not urgent**: the "live over-exposure" that once justified jumping the queue was retracted, and I verified the retraction (§ 5) |
| **4** | **Invitations** | B | S–M | `invitations.py` 173 + `invitation_service.py` 302 ✅ **complete** · **no UI** | The bridge from upgrade to greenfield. Backend is done, so it is still cheap — but the UI is built from nothing, which is the first time the shared layer has to carry a screen with no predecessor |
| **5** | **Data Access** | C | M | ❌ nothing | **First new table.** Closes half of PM-5 and gates the marketplace domain. Sequence *with* PM-5, not against it — they meet at the § 3.4 scoping hook |
| **6** | **API Credentials** | C | **XL** | ❌ nothing | Largest single module: 5 tables, encryption + masking, the `CredentialManager` resolution chain, 9 of the 14 permissions. Provider catalogue already extracted (Appendix A). Also gives PM-28 somewhere to store Google OAuth credentials |
| **7** | **Global Search** | C | M | ❌ nothing | 2 tables, 3 permission layers. Independent of 6, but sequenced after it because 8 needs both and 6 is the longer pole |
| **8** | **AI Assistant** | C | L | ❌ nothing | **Hard-blocked by 6 and 7** — needs credential storage for the API key and `LocateData` from search. 3 tables, 5 security controls that do not fail loudly when wrong |
| **9** | **Tests** | — | L | 217 exist, CI runs them; **cannot run locally** | Deliberately last. § 7 states the cost and the mitigation |

### 6.3 Calls that could reasonably go the other way

Recorded so they can be argued with rather than silently inherited:

- **Invitations at 4, not 2.** It is small and its backend is finished, so "quick win first" is a
  fair instinct — an earlier draft of this plan had it at 2. It moved because **it is not actually an
  upgrade.** Users, Roles and Activity all have working UIs to migrate; Invitations has none, so it
  is greenfield frontend wearing a small size tag. Grouping it with the three genuine upgrades
  flattered its cost and broke the coherence of doing all the migrations together.
- **Users before Roles.** Both are group A. Users first because it defines the shape and has the
  denser form; Roles second because its matrix is the screen most likely to break a
  too-narrow abstraction — and finding that on module 2 is much cheaper than on module 6.
- **Data Access at 5, not earlier.** It closes half of PM-5, the register's highest open priority, so
  there is a case for pulling it forward. It stays at 5 because it is the first module needing a new
  table *and* new permissions *and* coordination with PM-5's scoping — three kinds of novelty at
  once. After three upgrades have exercised the shared layer, only one of those three is still new.

### 6.4 The checkpoint that tells you whether this is working

**Module 2 (Roles) is the test.** It is the same kind of work as module 1 on a working backend, so
if it is *not* noticeably faster — and if the permission matrix needs `ResourceIndex` special-cased
to fit — the shared layer is wrong.

**Stop and fix it there.** That is the cheapest moment: one module depends on the abstraction, not
six. By module 6 (API Credentials, XL) a bad shared layer costs more to unwind than it ever saved.

---

## 7. Testing — last, deliberately, with the cost stated

**Decision: tests come after the core is complete.** Test suites are slow to write and slow to run,
and that time is not available now.

This is a real trade-off, so it is recorded rather than glossed:

- The backend suite is **217 tests** and CI already runs `pytest -m "not db"` on every push
- **Locally they cannot be run at all** — `Dockerfile.dev` installs `requirements.txt` but not
  `requirements-dev.txt`, so `pytest` is absent from the container. Worth a one-line fix so the
  option exists even if unused
- Deferring tests means every permission and data-visibility path ships unverified by machine

**The mitigation is the one already recorded in `LEAPDESK_PARITY_PLAN.md` § Verification standard,
and it is not optional:** every permission or data-visibility path built here gets its verification
written into `DAILY_CHANGES.md` — what was run, as which role, and what came back. That applies with
particular force to **Data Access**, **Global Search's three permission layers**, and **AI
Assistant's five controls**, none of which fail loudly when they are wrong.

- [ ] Phase 12: `pytest` coverage for the shared layer first (§ 3), then per module
- [ ] Install `requirements-dev.txt` in the dev image now, so tests are runnable when we get there

---

## 8. Definition of done

### 8.1 Per module — the parity audit

**No module is done until it has been compared against LeapDesk screen by screen.** § 1.1 sets the
standard; this is how it is enforced, because "we built the Users module" and "our Users module does
what LeapDesk's Users module does" are different claims and only the second one counts.

Before marking any module complete, with LeapDesk's version of the screen **open next to ours**:

- [ ] **Index** — every filter present, same control type, same options, same default. Same sort
      columns. Same per-page options and default. Same bulk actions. Same row actions. Same empty
      state. Same column set and order
- [ ] **Form** — every field present, same label, same type, same required/optional, same validation
      rule and message, same default. Create *and* edit both checked
- [ ] **Show** — every field and section present, same grouping
- [ ] **Permissions** — same permission gates each action, and a role *without* it is confirmed
      blocked, not merely hidden
- [ ] **Edge cases** — protected rows, self-edit rules, status transitions, what LeapDesk *forbids*
      as much as what it allows
- [ ] **Every difference found is either fixed or registered** in § 1.1 as a sanctioned divergence.
      Silent drift is the failure mode this checklist exists to prevent
- [ ] Result recorded in `DAILY_CHANGES.md` — what was compared, what matched, what did not

> Read the LeapDesk source directly at `/opt/lampp/htdocs/LeapDesk` for each audit. Not this plan, not
> `LEAPDESK_PARITY_PLAN.md`, and not memory — both documents are summaries and both have already been
> caught carrying stale claims.

### 8.2 Overall — "core 100%"

The core is complete when **all** of these hold:

- [ ] All 8 modules pass their § 8.1 parity audit
- [ ] All 8 modules exist with Index, Form (create+update) and Show, on the § 2.3 routes
- [ ] Every list endpoint goes through the § 3.1 pipeline — no hand-rolled filter chains remain
- [ ] Every index page is built from `ResourceIndex` — none approaches LeapDesk's 936 lines
- [ ] All 14 permissions seeded, every route gated by `require_permission`
- [ ] Every module writes to the activity log by construction, not by remembering
- [ ] `npm run build`, `npm run typecheck` and `ruff check` pass; `npm run lint` is at **0** and
      `continue-on-error` is deleted from `ci.yml`
- [ ] Every data-visibility path has a recorded verification in `DAILY_CHANGES.md`
- [ ] **Every screen has been opened in a browser.** `UI_PATTERNS.md` § Pending notes no component
      has been visually verified since the Viho migration — that gap must not survive this plan

---

## Appendix A — API Credentials provider catalogue (ready to seed)

Extracted from LeapDesk `database/seeders/ApiCredentialsSeeder.php` on 2026-08-07. This is the
`api_service_providers` + `api_credential_schemas` seed data for module 6. **Definitions only — see
§ A.3 for what was deliberately left behind.**

### A.1 Providers to seed

Nine of LeapDesk's eleven. Field types in use: `text`, `password`, `url`, `email`, `number`,
`boolean`, `select`.

| Provider | slug | category | Fields (`key : type · required · encrypted`) |
|---|---|---|---|
| HostBill | `hostbill` | api | `base_url` url ✓ ✗ · `web_url` url ✓ ✗ · `api_id` text ✓ **enc** · `api_key` password ✓ **enc** |
| HubSpot | `hubspot` | api | `access_token` password ✓ **enc** · `api_key` password ✗ **enc** |
| Google OAuth | `google` | oauth | `client_id` text ✓ **enc** · `client_secret` password ✓ **enc** · `redirect_uri` url ✓ ✗ |
| Slack (webhook) | `slack` | notification | `webhook_url` url ✓ **enc** · `enabled` boolean ✗ ✗ |
| Slack Bot | `slack_bot` | notification | `bot_token` password ✓ **enc** · `app_id` text ✗ ✗ · `signing_secret` password ✗ **enc** · `enabled` boolean ✗ ✗ |
| SMTP Mail | `mail` | email | `mailer` select ✓ ✗ · `host` text ✓ ✗ · `port` number ✓ ✗ · `encryption` select ✗ ✗ · `username` text ✓ **enc** · `password` password ✓ **enc** · `from_address` email ✓ ✗ · `from_name` text ✓ ✗ |
| Google Calendar | `google_calendar` | api | `client_email` email ✓ ✗ · `private_key` password ✓ **enc** · `calendar_id` text ✓ ✗ · `enabled` boolean ✗ ✗ |
| Google Sheets | `google_sheets` | api | `client_email` email ✓ ✗ · `private_key` password ✓ **enc** · `enabled` boolean ✗ ✗ |
| Anthropic (Claude) | `anthropic` | api | `api_key` password ✓ **enc** · `default_model` select ✗ ✗ · `enabled` boolean ✗ ✗ |

Each provider also carries `description`, `icon`, `documentation_url`, `is_system`, `display_order`
and a `setup_steps` string array rendered as numbered instructions in the UI. Port those verbatim —
they are good copy and cost nothing.

### A.2 Two providers dropped, and one bug not copied

- **`slack_qmas` and `slack_presales` are not ours.** They notify LeapDesk's QMAS and Presales
  modules, which live in its `app-modules/` domain — the part § 1 excludes. Seeding them here would
  create providers that route to features this product does not have.
- **`display_order` is duplicated in the source** — `5`, `6` and `8` each appear twice, so the
  provider list has no deterministic order. Renumber 1–9 on the way in.
- **Rename `Slack Bot (LeapDesk App)`** — the label names the other product.

### A.3 ⛔ Credential *values* were deliberately not copied

Lines ~283–400 of that seeder assign **real, working credentials** — a live Slack `xoxb-` bot token
and signing secret, a HubSpot private-app token, a Google OAuth `GOCSPX-` client secret, a HostBill
API key, and an SMTP password. They are not placeholders.

**They must not enter this repository.** Two independent reasons:

1. **This repo is public** (`github.com/Leapswitch-Networks/partner-marketplace`). Committed secrets
   are world-readable the moment they are pushed, and remain cached and indexed after deletion.
   `AGENTS.md` § Repository Visibility: *"Never commit real credentials … Seed/demo credentials must
   stay obviously fake."*
2. **It defeats the module being built.** Every one of those fields is declared `is_encrypted`. The
   whole point of API Credentials is that secrets are entered at runtime and stored encrypted, with
   masked reads. A seeder holding them in plaintext routes around the feature.

**The correct flow:** seed providers and schemas with **empty values**, then enter real credentials
through the UI once, per environment. That is how LeapDesk's own `CredentialManager` is designed to
resolve them; the seeded values there look like a development convenience that outlived its purpose.

> **Worth raising with the owner, separately from this project.** Those credentials are committed to
> `git@github.com:Leapswitch-Networks/LeapDesk.git`. Whatever that repo's visibility, live Slack,
> HubSpot, Google OAuth and SMTP secrets sitting in tracked source are worth **rotating**, and worth
> checking who can read them. Not a Partner Marketplace task — but it was found here, so it is
> recorded here.

---

## Related

- [`PLANNING.md`](./PLANNING.md) — today's working plan; § 2 is the uncommitted-tree blocker
- [`LEAPDESK_PARITY_PLAN.md`](./LEAPDESK_PARITY_PLAN.md) — per-module schemas, endpoints, permissions
- [`TECH_DEBT.md`](./TECH_DEBT.md) — PM-5 (scoping), PM-11 (tests), PM-30 (lint)
- [`CORE_HARDENING_PLAN.md`](./CORE_HARDENING_PLAN.md) — PM-41 data layer; overlaps § 4
- [`../system-design/FASTAPI_STANDARDS.md`](../system-design/FASTAPI_STANDARDS.md) · [`NEXTJS_STANDARDS.md`](../system-design/NEXTJS_STANDARDS.md) · [`UI_PATTERNS.md`](../system-design/UI_PATTERNS.md)

**Reference source:** `/opt/lampp/htdocs/LeapDesk` (Laravel 12 + Inertia + React 19). Read it
directly. Three other copies exist on this machine — `leapdesk_core`, `leapdesk_v2`,
`leapdesk_laravel_react_version` — and are **not** the reference.
