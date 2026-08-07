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

### 3.3 `app/core/crud.py` — the service base

A small generic for the five operations every module repeats: `list`, `get_or_404`, `create`,
`update` (partial), `delete`. Modules subclass and override only what is genuinely different.

- [ ] `get_or_404` raises a consistent 404 body — today each service invents one.
- [ ] `update` is **PATCH semantics**: `model_dump(exclude_unset=True)`. PM-15 fixed this once; the
      base class makes it structural rather than remembered.

### 3.4 Cross-cutting concerns, as dependencies not copy-paste

LeapDesk uses traits (`LogsAllActivity`, `HasDataAccess`). Our equivalent is FastAPI dependencies:

- [ ] **`require_permission("user-view")`** — a dependency factory. Exists in spirit; make it the
      only way a route is gated.
- [ ] **Activity logging** — one hook on the CRUD base, so a new module is audited by construction.
      LeapDesk's `LogsAllActivity` trait is the model.
- [ ] **Data-access scoping** — one composable filter, so `HasDataAccess` semantics and PM-5's
      row-level scoping land in the *same* place rather than fighting each other later.

> **Sequencing note:** § 3.4's scoping hook is the seam where **PM-5** (row-level scoping) and
> **Module 3 (Data Access)** meet. Build the seam now, even if empty. Retrofitting it into eight
> modules later is the expensive version.

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

### 4.2 What to build

- [ ] **`ResourceIndex`** — the shell every index page repeats: page header, filter bar, table, bulk
      bar, delete confirm. A module supplies columns, filters and handlers; it supplies nothing else.
      **This is the piece that prevents our index pages becoming LeapDesk's 936-line ones.**
- [ ] **`FilterBar`** — declarative filters (`text` / `select` / `dateRange`), a reset button that is
      always visible and disabled when nothing is active, and 500ms debounce on text. LeapDesk has no
      equivalent; this is ours to design.
- [ ] **`ResourceForm`** — the `record?: T` create/update shell of § 2.1: dirty tracking, unsaved-changes
      guard, server-error mapping onto fields, consistent submit/cancel footer.
- [ ] **`ShowPage` primitives** — port the *shape* of LeapDesk's `show-page.tsx`: `ShowPageHeader`
      (eyebrow, title, id, badges, back link, actions), `ShowPageGrid`, `ShowPageMain`,
      `ShowPageSidebar`, `InfoCard`, `Field`, `MetaCard`, `AuditCard`. **Retint to our tokens** — its
      `TONE_CLASSES` hardcodes emerald/rose/amber/violet, which is exactly the pattern our Viho
      migration removed. Map onto our existing `Badge` tones instead.
- [ ] **`useResourceQuery`** — one hook owning page / per-page / sort / filters / debounce, synced to
      the URL so a filtered list is shareable and survives reload.

### 4.3 Component rules

- Everything composes from `components/common/*`; a module never restyles a primitive
- No inline `fetch()` — all calls go through `lib/api/*` (`NEXTJS_STANDARDS.md`)
- No business logic in a page; pages wire components to hooks
- Every colour utility needs a `dark:` variant, and colours come from tokens, never hexes

---

## 5. Module-by-module — current state → target

Verified against the code and the database today. **Permissions: 0 of 14 seeded** — confirmed by
querying `permissions`; none of `data-access.*`, `api-credentials.*`, `search.entities.manage`,
`ai-assistant.*`, `user-email`, `settings-view`, `settings-update` exist.

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
