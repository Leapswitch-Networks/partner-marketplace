# Module Parity Plan — bringing every module to the Users index

> **What this is.** Every change made to the Users module between the morning of **10 August 2026** and
> the end of **11 August 2026**, written as a checklist, plus a measured record of which modules do and
> do not have each one today.
>
> **Why it exists.** The owner's instruction, 2026-08-11: *every module should follow the exact
> structure and UI/UX of the Users index.* Doing that from memory would miss things — the Users index
> changed in about thirty separate ways over two days, and several of them are invisible until a
> specific interaction. This is the list to work from.
>
> **Read § 1 for the inventory, § 2 for where each module stands, § 3 for the order to do it in.**
> Source of truth for the "what changed" column is `DAILY_CHANGES.md`, 2026-08-10 and 2026-08-11.

---

## 0. The one-line summary

The Users index went from *a page that used shared shells* to *a page that contains nothing but its own
domain*: its API call, its columns, its row actions, and the words on its buttons. **Everything else was
lifted into a shared component or hook.** Nine of those pieces did not exist on the morning of 10 August.

Three live bugs were found in the process, all of them in code that had been copied between modules and
then diverged. **That is the argument for this whole exercise**, and it is worth stating before the
checklist: the goal is not tidiness, it is that the other modules almost certainly carry the same class
of defect, and the only way to find out is to put them on the same pieces.

---

## 1. The inventory — what changed in the Users module

Grouped by what a person doing this work would open. **⬤ = automatic** once the module is on the shared
piece; **◐ = needs a decision or a value per module**; **○ = real work per module**.

### 1.1 Page shell and heading

| # | Change | Where it lives | Effort |
|---|---|---|---|
| 1 | Heading carries an **icon glyph**, a title and a one-line description | `ResourceIndex` `icon` / `title` / `description` | ◐ |
| 2 | Primary action button sits in the header, permission-gated | `ResourceIndex` `actions` | ◐ |
| 3 | Card is `bordered={false}` — the table draws its own frame, two borders read as a box in a box | `ResourceIndex` | ⬤ |
| 4 | Full-height layout: only the table body scrolls, the page never does | `Card` / `CardContent` | ⬤ |

### 1.2 Filter row

| # | Change | Where it lives | Effort |
|---|---|---|---|
| 5 | Filters, `Cols` and `Reset` share **one row**, not two — the table's scroll box is viewport-measured, so every row of chrome costs visible records | `ResourceIndex` → table `toolbar` | ⬤ |
| 6 | Select filters are a **searchable combobox**, not a native `<select>` — a forty-item Role list is not filterable in a native select | `FilterCombobox` via `FilterBar` | ⬤ |
| 7 | Text filter gets the **magnifier by default** — it was a four-line SVG declared per module | `FilterBar` `SEARCH_ICON` | ⬤ |
| 8 | Placeholders read `All Status`, `All Types`, `All Roles` — reference parity | per module | ◐ |
| 9 | A filter whose options are empty or permission-gated is **hidden**, not rendered blank | `FilterBar` `hidden` | ◐ |
| 10 | `Reset` is always visible, disabled when nothing is active | `FilterBar` | ⬤ |

### 1.3 The table itself

| # | Change | Where it lives | Effort |
|---|---|---|---|
| 11 | **The vendored reference DataTable**, via the adapter — its sliding-window pager, its per-page select | `table="vendor"` | ◐ |
| 12 | **Zebra stripe is a lighter green** (`bg-muted`, brand at 8% over a 10% card), not a grey and not invisible | `ui/table.tsx` | ⬤ |
| 13 | **Row padding `py-2`** (was `py-0.5` — a 20px row, which is why records merged) | `ui/table.tsx` | ⬤ |
| 14 | **No vertical dividers in the header** — white hairlines on the brand fill read as damage | `ui/table.tsx` | ⬤ |
| 15 | **One font size across every column.** Badges follow the table's scale; rank with weight and colour, never size | `Badge`, `columns.tsx` | ○ |
| 16 | Hover is `brand/10`, never a grey — a grey wash over green is a smudge | `ui/table.tsx` | ⬤ |
| 17 | **Sort arrows in every sortable header**, right-aligned: ⇕ neutral, ▲ asc, ▼ desc | `VendorDataTable` + vendor | ◐ |
| 18 | The sort control is a **real button** with `aria-sort`, not a clickable `<th>` | vendor, patched | ⬤ |
| 19 | **`Cols` column picker** in the filter row, after Reset | `ColumnPicker` | ⬤ |
| 20 | Column order is fixed: `#`, `Actions`, `Status`, then data | per module | ○ |
| 21 | `#` uses **`numberColumn()`** — the index is absolute, do not add the page offset | `columns.tsx` | ○ |
| 22 | Actions uses **`actionsColumn()`** — centred, zero padding, `RowActions` | `columns.tsx` | ○ |
| 23 | Status and other closed sets use **`badgeColumn()`**, with a fixed header width | `columns.tsx` | ○ |
| 24 | Dates use **`dateColumn()`** — `tabular-nums`, `whitespace-nowrap`, a considered fallback | `columns.tsx` | ○ |
| 25 | Two-line cells use **`stackedCell()`** — one size, weight and ink do the ranking | `columns.tsx` | ○ |
| 26 | **A `sortKey` on every column the API can sort**, and none it cannot | per module, check the service's `ListSpec` | ○ |
| 27 | Selection + bulk bar reading **`q.selected`**, never a local copy | `useResourceQuery` | ○ |
| 28 | Empty state distinguishes "nothing yet" from "filters hid everything", and offers a first-record button | `ResourceIndex` `emptyTitle` / `emptyHint` | ◐ |
| 29 | Selection counter reads `3 of 137 user(s) selected` | `rowNoun` | ◐ |

### 1.4 State — the hooks

| # | Change | Where it lives | Effort |
|---|---|---|---|
| 30 | Filter/sort/page/selection state, and its URL round-trip | `useResourceQuery` | ⬤ |
| 31 | **Fetch, loading, error, refetch, row patching** — replaces ~20 lines per module | `useResourceList` | ○ |
| 32 | Per-row write: busy row, toast, apply the returned record | `useRowAction` | ○ |
| 33 | Bulk write: surfaces `skipped_reasons`, clears the selection only when something changed | `useBulkAction` | ○ |
| 34 | Which dialog is open and on which row, as one thing | `useModalState` | ○ |

### 1.5 Dialogs

| # | Change | Where it lives | Effort |
|---|---|---|---|
| 35 | Create / edit / view are **modals**, not pages (owner's call, 2026-08-10) | `FormModal` | ○ |
| 36 | Modal width **steps up with the viewport** — 672 / 768 / 896 for a form; `md` stays 448 | `FormModal`, `Modal` | ⬤ |
| 37 | A record view uses the **`xl` width and a two-column card grid**, so extra width shortens the dialog | per module | ○ |
| 38 | Destructive actions confirm, and the dialog **stays open on failure** showing why | `ConfirmDialog` | ⬤ |
| 39 | Delete uses **`DeleteDialog`** — fixed wording, the record named in bold | `DeleteDialog` | ○ |
| 40 | A state change reachable by a single click (a badge) confirms too | per module | ◐ |

### 1.6 Toast

| # | Change | Where it lives | Effort |
|---|---|---|---|
| 41 | **Top-right**, stacked up to three, dark panel, icon badge, slide-in | `Toast` | ⬤ |
| 42 | Hook returns **`toasts`** (plural) and `dismiss(id)` | `useToast` | ○ |
| 43 | A toast carrying `details` **does not auto-dismiss** — partial success must not read as total | `Toast` | ⬤ |

### 1.7 Forms

| # | Change | Where it lives | Effort |
|---|---|---|---|
| 44 | Fields grouped into **titled section cards**, not a flat column | `FormSection` | ○ |
| 45 | Two fields per row above `sm` | `FormGrid` | ○ |
| 46 | Heading **names the record** — `Edit User: Ayush Mishra` | `ResourceForm` / `FormModal` | ⬤ |
| 47 | Submit reads `Update X` / `Create X`, busy `Updating…` / `Creating…` | shell | ⬤ |
| 48 | Cancel wears `buttonClasses("outline")` so it cannot drift from Save | shell | ⬤ |

### 1.8 Show pages

| # | Change | Where it lives | Effort |
|---|---|---|---|
| 49 | **2:1 grid**, not a fixed 320px sidebar | `ShowPageGrid` / `ShowPageMain` | ⬤ |
| 50 | Sidebar is **sticky**, with `self-start` — without which sticky does nothing | `ShowPageSidebar` | ⬤ |
| 51 | Content in `InfoCard` + `Field`, with `description` where it needs framing | shells | ○ |

### 1.9 Shared utilities — the layer under everything

| # | Change | Where it lives | Effort |
|---|---|---|---|
| 52 | **One error formatter.** Seven existed; two had no 422 branch and swallowed every validation message | `extractApiError` | ○ |
| 53 | **One date formatter**, locale pinned and timezone deliberately not | `formatDate` / `formatDateTime` | ○ |
| 54 | `Button` `danger` variant and `size` — replaces hand-rolled reds that had no hover state | `Button` | ○ |
| 55 | `buttonClasses()` for a **link** that must look like a button — navigation gets an anchor, actions get a button | `Button` | ○ |
| 56 | `Avatar`, `cn()`, `getInitials()` | primitives | ○ |
| 57 | **No `text-gray-*` in module code.** Use `text-ink`, `text-ink-label`, `dark:text-night-muted` | per module | ○ |

---

## 2. Where each module stands

**Steps 1–4 were executed on 2026-08-11.** Measured by grep after the work, not estimated.

### 2.1 Index modules

| Item | Users | Roles | Invitations | Activity |
|---|---|---|---|---|
| 11 · vendored table | ✅ | ✅ | ✅ | ✅ |
| 21 · `numberColumn()` | ✅ | ✅ | ✅ | ✅ |
| 22 · `actionsColumn()` | ✅ | ✅ | ✅ | n/a — read-only |
| 23 · `badgeColumn()` | ✅ | ✅ | ✅ | ✅ |
| 24 · `dateColumn()` | ✅ | ✅ | ✅ | ✅ |
| 27 · selection + bulk | ✅ | n/a | n/a | n/a |
| 28 · `emptyHint` | ✅ | ✅ | ✅ | ✅ |
| 29 · `rowNoun` | ✅ | ✅ | ✅ | ✅ |
| 31 · `useResourceList` | ✅ | **n/a** — see § 4.2 | ✅ | ✅ |
| 34 · `useModalState` | ✅ | ✅ | ✅ | ✅ |
| 35 · create/edit/view as modals | ✅ | ✅ | ✅ create | n/a |
| 39 · `DeleteDialog` | ✅ | ✅ | n/a — cancel ≠ delete | n/a |
| 57 · no light-mode `text-gray-*` | ✅ | ✅ | ✅ | ✅ |

### 2.2 Forms

| Item | UserForm | RoleForm | InvitationForm | ProfileForm |
|---|---|---|---|---|
| 35 · `asModal` | ✅ | ✅ | ✅ | ❌ not an index form |
| 44/45 · sections + grid | ✅ | ✅ | n/a — repeater | ❌ flat |
| 46–48 · heading, labels, Cancel | ✅ | ✅ | ✅ | ✅ |

### 2.3 Show pages

| Item | UserShow | RoleShow |
|---|---|---|
| 35 · `asModal` | ✅ | ✅ |
| 37 · modal two-column cards | ✅ | ✅ |
| 49/50 · grid + sticky sidebar | ✅ | ✅ |
| 55 · `buttonClasses()` on the Edit link | ✅ | ✅ |

### 2.4 What is still open

- **Item 26 — sort keys** (§ 3 step 6). Only Users and Invitations have been checked against their
  service's `ListSpec.sortable`. Activity's one dead `sortKey` was removed.
- **Item 44/45 for `ProfileForm`** — still a flat column. It is not an index form, so it was out of
  scope for steps 1–5.
- **Dark-mode ink.** `dark:text-gray-300` survives in Activity and Invitations. No `night` token holds
  that value, so it needs a new one in `tailwind.config.ts` — a Protected File.

---

## 3. The order to do it in

Grouped so each step leaves the app working and is independently checkable.

**Step 1 — the free ones. ✅ done 2026-08-11.** Items 42 and 57.

**Step 2 — Roles. ✅ done 2026-08-11.** Items 11, 21–24, 28–29, 34, 35, 39. Client-side paging kept —
see § 4.2. Turned up the last hand-rolled red button in the app and a dead permission rule.

**Step 3 — Invitations. ✅ done 2026-08-11.** Items 11, 22–24, 28–29, 31, 34, 35. Its stat cards stayed
where they were, in `filterExtras`; no new `ResourceIndex` slot was needed after all.

**Step 4 — Activity. ✅ done 2026-08-11.** Items 11, 21, 23–24, 31, 34, 57. It **did** get a `#` column
in the end — that is structure, not a feature, and it was already there and mis-numbered. It did not
get row actions, selection or a bulk bar.

**Step 5 — the flat forms.** `RoleForm` ✅ done with step 2. `InvitationForm` is a repeater and does
not take sections. **`ProfileForm` remains.**

**Step 6 — sort keys.** Item 26, per module: read each service's `ListSpec.sortable` and make the
columns match it exactly. Users has six of the API's seven and Invitations now matches; Roles sorts in
the browser. ~~Activity's endpoint exposes no sort parameter at all.~~

> **Activity resolved 2026-08-12.** The open question — *should the audit trail get an oldest-first
> toggle?* — was answered yes, and it was an API change as predicted. `list_entries` now accepts
> `sort_by`/`sort_order` over an allowlist of `id`, `created_at`, `event`, `description`, `log_name`
> (the reference's four plus ours), and the four sortable columns declare matching `sortKey`s. `id`
> stays the default **and the tiebreak**, so the property that made this module refuse sorting in
> the first place — rows written in one transaction share a timestamp, so `created_at` alone is not
> a total order — holds under every sort rather than being traded away for the feature.
>
> **Users' seventh sort key is still unchecked**, and Roles is still client-side by the § 4.2
> decision. Step 6 is not finished; it is one module shorter.

---

## 4. The three decisions, as taken

Taken on 2026-08-11 as the defaults implied by the owner's instruction — *"every module should follow
the exact structure and UI/UX of the Users index"* — and recorded here so they are choices rather than
drift.

### 4.1 Every index moved to the vendored table ✅

"Exact structure, everything" answers it. All four are `table="vendor"`, so items 12–19 — the stripe,
the padding, the header dividers, one font size, the sort arrows and the `Cols` picker — arrive on all
of them together.

**The caveat from the original scoping still stands and is now larger, not smaller.** The table was
scoped to Users *"until it has been looked at in a browser and signed off"*, and that has still not
happened. Four pages now depend on it. See § 5.

### 4.2 Roles keeps client-side filtering and paging ✅

`/api/roles` returns the whole list — six rows, unpaged, no server-side search. `useResourceList`
refetches whenever its deps change, so putting Roles on it would mean a network round trip per
keystroke, and adding a paged endpoint to satisfy a hook is the tail wagging the dog.

So Roles is the one module that keeps its own fetch, and the reason is written at the call site rather
than left to be rediscovered. It has **everything else** — the table, the columns, the modals, the
delete dialog. Revisit if roles ever become a list you scroll.

### 4.3 "No `text-gray-*`" is a rule, but is not yet enforced ⚠️

Applied to all four modules; every light-mode grey is gone. **It is still only a convention** — nothing
stops the next module reintroducing it.

If it is to hold, it needs a grep in CI beside the brand-colour guard, and the rule has to be stated
precisely: *no `text-gray-*` without a `dark:` prefix*. The bare form is what reads as a smudge on the
green chrome; `dark:text-gray-300` is currently unavoidable because no `night` token holds a body-text
ink. **Writing the rule without that exception would make it unfollowable**, which is how rules get
ignored.

---

## 5. What is deliberately not on this list

- **Anything visual that has still never been rendered in a browser.** `UI_PATTERNS.md` § Pending has
  said since 2026-08-06 that no component has been checked on screen since the Viho migration, and this
  plan does not close that. Items 12–19 in particular were reasoned about from classes and contrast
  ratios. **Open the Users index in both themes before copying it to three more modules** — copying a
  mistake three times is the expensive version of this plan.
- **Icons in the row menu.** `RowActions` has no icon slot; the reference's items each carry one. Open
  as a to-do in `CORE_COMPLETION_PLAN.md` § 1.1, unchanged by this work.
- **The `surface-border` retint and the exact sticky-header shade**, both of which need a new token in
  `tailwind.config.ts` — a Protected File, and both already waiting on the owner in `PLANNING.md` § 3.1.
