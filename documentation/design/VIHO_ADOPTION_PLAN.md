# Viho Adoption — Implementation Plan

> **Status: DECIDED 2026-08-05.** The project owner chose **full Viho fidelity** — all four conflicts
> in [`VIHO_THEME_REFERENCE.md`](./VIHO_THEME_REFERENCE.md) § Adoption Decision are adopted, not
> partially adopted. This document is the sequenced plan to get there.
>
> **This is a plan, not a record of work done.** Check the code before assuming any phase below is
> complete; each phase carries its own Done-when test.
>
> **Progress as of 2026-08-05 — the auth screens went first, out of plan order.** At the owner's
> request the sign-in and sign-up pages were built to full Viho fidelity ahead of the phase sequence.
> That pulled parts of phases 1, 4, 5, 6 and 8 forward for the `(auth)` route group only:
>
> | Phase | State |
> |---|---|
> | 1 — token layer | ✅ **done** (`brand`/`accent`/`surface`/`ink`/`night`/`tone`, `shadow-brand`, plus `brand-on-dark`) |
> | 2 — retire inherited screens | ⬜ not started — **still needs your approval** |
> | 3 — migrate call sites | ✅ **done** — all 242 occurrences across 37 files. The palette grep is empty app-wide |
> | 4 — flip the palette | ✅ **done** — `brand` is teal. Landed early because the token was, in practice, unused as a class |
> | 5 — surfaces / radius / dark elevation | ✅ **done** app-wide — squared surfaces, `#f5f7fb` canvas, inverted dark elevation, radii normalised. **30px card padding deferred** — it is coupled to phase 7 |
> | 6 — Montserrat | ✅ **done** app-wide, 14px body |
> | 7 — re-measure `useAutoPerPage()` | ⬜ not needed yet — card padding has not moved |
> | 8 — new components | 🟡 `Input` `addon`/`trailing`, `Button` `light` variant, password reveal, social tile. Soft badge / upload zone / ghost bars / stepper / sparkline outstanding |
> | 9 — screen fidelity pass | 🟡 dashboard, users, roles, activity, settings and auth all migrated and visually verified. Viho's richer *content* (search header, profile block, charts) not yet built |
> | 10 — retire screenshots | ⬜ not started |
>
> **The app is no longer two-tone** — phase 3 completed 2026-08-05 and every route is on the token
> system. What remains is additive (phase 8 components, Viho's richer dashboard content) plus the
> coupled padding/pagination change in phases 5 and 7.

| | |
|---|---|
| **Decided by** | Ayush Mishra (project owner), 2026-08-05 |
| **Supersedes** | § Adoption Decision's "Needs the Owner" status |
| **Source of values** | [`VIHO_THEME_REFERENCE.md`](./VIHO_THEME_REFERENCE.md) — every hex, size and spacing value below is quoted from there, not re-derived |
| **Authoritative for our system** | [`../system-design/UI_PATTERNS.md`](../system-design/UI_PATTERNS.md) — it must be rewritten as each phase lands, or it becomes a lie |

---

## 🎯 The Decision

| # | Conflict | Decision | Was |
|---|----------|----------|-----|
| 1 | **Brand hue** | **Adopt** teal `#24695c` + tan `#ba895d` | Orange `#F97316` |
| 2 | **Surface radius** | **Adopt** — cards squared (`radius 0`), controls stay rounded | `rounded-lg` everywhere |
| 3 | **Body font** | **Adopt** Montserrat 14px | Inter, `text-sm` |
| 4 | **Dark elevation** | **Adopt** the inversion — cards `#111727` *darker* than the `#202938` page | Cards lighter than page |
| 4b | **Card spacing** | **Adopt** 30px padding + 30px bottom margin | Current denser spacing |

Plus the structural wins the reference doc recommended regardless of hue — the brand-wash page
background, tinted input addons, the `btn-primary-light` variant, soft badges, coloured shadows. Those
were never in conflict; they are now simply in scope.

**The intent, in the owner's words: the product should look like Viho.** Where this plan proposes a
deviation, it is called out explicitly below and is open to veto — it is not a quiet narrowing.

### ⚠️ Four proposed exceptions — owner's call, not yet settled

"100% fidelity" collides with WCAG in exactly four places. The reference doc measured all of them
(§ Accessibility Audit) and `UI_PATTERNS.md` § Focus & Accessibility already forbids three. **The plan
assumes these four exceptions; say the word and they go.**

| # | Viho does | Contrast | Proposed instead | Contrast |
|---|-----------|---------:|------------------|---------:|
| E1 | White text on warning `#e2c636` | **1.70** ❌ | `#242934` on warning | **8.58** ✅ |
| E2 | Muted text `#999999` on white | **2.85** ❌ | `#6b7280` (our `gray-500`) | **4.83** ✅ |
| E3 | White text on secondary `#ba895d` | **3.08** ❌ | `#242934` on tan, or tan for large text only | **6.2** ✅ |
| E4 | `:focus { box-shadow: none }` on login inputs | — | Keep our `focus:ring-2 focus:ring-brand/20` | — |

E1 and E4 are the ones I would hold hardest: 1.70 is unreadable rather than merely marginal, and E4
removes the keyboard focus indicator entirely.

**Two further Viho choices are adopted as-is under this decision, despite the reference doc advising
against them** — because they are visual identity, not accessibility failures:

- `success` = `#1b4c43`, a darker primary shade rather than a green.
- `info` = `#717171`, a grey rather than a blue.

The doc's objection stands and is worth re-reading (§ Semantic Tones) — as a *categorical* palette,
two of six series look alike and one reads as disabled. But both pass contrast, and changing them
would visibly diverge from every screenshot. Adopted. If chart legibility becomes a real problem once
charts exist, revisit it then with a concrete case.

---

## 💰 What This Actually Costs — measured 2026-08-05, not estimated

**The reference doc and `UI_PATTERNS.md` both say only `Button.tsx` and `Input.tsx` hardcode the brand
hex. That is wrong, and it is the single most important correction in this document.**

```
grep -ro 'F97316\|EA6C0A'        app components  →  151 occurrences, 37 files
grep -ro 'orange-[0-9]\{2,3\}'   app components  →   91 occurrences, 18 files
                                          union  →  242 occurrences, 37 files
```

37 of the frontend's 85 `.tsx` files — **44%** — paint the brand colour by hand. Only **6** files use
the `brand` token at all. The `orange-*` half matters as much as the hex half and is easy to miss: a
hex grep will not find `bg-orange-50`, `dark:bg-orange-950/40` or `hover:text-orange-400`, and those
are 91 of the 242.

Shades in use: `orange-50` ×27, `orange-950` ×26, `orange-400` ×23, `orange-600` ×6, `orange-500` ×4,
`orange-700` ×2, and one each of `orange-100/200/900`. **Nine shades** where the token defines two —
so the token layer this plan builds needs a real tint ladder, not a `DEFAULT`/`dark` pair.

Heaviest files:

| Occurrences | File | Fate |
|------------:|------|------|
| 46 | `components/dashboard/Sidebar.tsx` | Keep — migrate |
| 22 | `components/admin/Candidate.tsx` | **Inherited — delete** |
| 15 | `components/admin/AddCategoryForm.tsx` | **Inherited — delete** |
| 14 | `components/admin/AddQuestionForm.tsx` | **Inherited — delete** |
| 12 | `components/admin/SelectQuestionType.tsx` | **Inherited — delete** |
| 12 | `components/admin/ProfileForm.tsx` | Keep — migrate |
| 12 | `app/not-found.tsx` | Keep — migrate |
| 11 | `components/common/TopNav.tsx` | Keep — migrate |
| 10 | `components/dashboard/RulesModal.tsx` | **Inherited — delete** |
| 9 | `components/settings/PasswordForm.tsx` | Keep — migrate |

Sizing for the other phases, same method:

| Phase | Utility | Count |
|-------|---------|------:|
| Surfaces (item 4) | `bg-white` | 60 |
| | `dark:bg-gray-800` | 38 |
| | `dark:bg-gray-900` | 31 |
| | `dark:bg-gray-950` | 9 |
| | `border-gray-300` / `dark:border-gray-700` | 31 / 31 |
| Radius (item 2) | `rounded-lg` | 92 |
| | `rounded-xl` | 49 |
| | `rounded-2xl` | 23 |
| | `rounded-full` | 31 |
| | `rounded-md` | 7 |

> ⚠️ **`UI_PATTERNS.md` mandates `rounded-lg` everywhere and says "don't mix radii". The code already
> mixes five.** 79 occurrences of `rounded-xl`/`rounded-2xl` are pre-existing drift, unrelated to Viho.
> Phase 5 has to settle them regardless of what we do about cards, so budget for it there rather than
> discovering it mid-phase.

---

## 🧭 Ordering — why this sequence

Three constraints fix the order, and getting them wrong is expensive:

1. **Retire before you repaint.** 85 of the 242 occurrences (**35%**) live in screens
   [`../planning/SCAFFOLD_CLEANUP_PLAN.md`](../planning/SCAFFOLD_CLEANUP_PLAN.md) § Frontend already
   schedules for deletion. Migrating them is work thrown away.
2. **Tokens before hue.** With 242 hand-painted call sites, flipping the palette is not a config
   change. Migrate to a token layer *while still orange* — then the hue flip is genuinely one commit
   and genuinely reversible.
3. **Padding before pagination.** Viho's 30px card padding changes how many table rows fit, and
   `useAutoPerPage()`'s `floor((h − 433) / 38)` hardcodes the old geometry. The constant must be
   re-measured *after* the spacing lands, not guessed before.

---

## 📦 Phases

### Phase 0 — Close the reference gaps *(parallel, blocks Phase 8 only)*

Four gaps in § Still Needed block full fidelity because we have nothing to copy:

| Priority | Gap | Why it blocks |
|:--------:|-----|---------------|
| 1 | **Input error / invalid states** — submit `/form/validation` on the demo so `:invalid` renders | Our `Input` has a defined error style and we cannot compare. Error styling is not optional |
| 2 | **`/form/wizard`** | Partner onboarding is multi-step; we have no stepper and no reference for one |
| 3 | **A modal open** (`/uikits/modal`) | No reference for overlay colour, header/footer or width. Modals are where a wrong radius shows most |
| 4 | **An open `⋮` dropdown** | We only ever see the closed trigger in the table shots |

Capture per `assets/screenshots/README.md` conventions, annotate each in § Screenshot Catalogue, and
add any new values to the relevant section of the reference doc.

**Done when:** four screenshots added and annotated; § Still Needed is empty.

---

### Phase 1 — Build the token layer *(no visual change)*

Extend `tailwind.config.ts` with the full semantic token set — **still resolving to orange.** Nothing
should look different when this lands.

Needs a real tint ladder, because the code uses nine orange shades. Map each existing shade to a token
role rather than inventing new ones:

| Current | Token |
|---------|-------|
| `#F97316`, `orange-500` | `brand.DEFAULT` |
| `#EA6C0A`, `orange-600` | `brand.dark` |
| `orange-50`, `orange-100` | `brand.tint` (the `rgba(brand,.1)` wash) |
| `orange-200`, `orange-400` | `brand.soft` |
| `orange-700`, `orange-900`, `orange-950` | `brand.deep` (dark-mode tints) |

Also define `accent`, `surface`, `ink`, `night` per the reference doc's § Mapping to Our Stack block,
and the six semantic tones.

**Done when:** the token set exists, `npm run build` passes, and the app is pixel-identical.

---

### Phase 2 — Retire the inherited screens *(removes 35% of the debt for free)*

Execute the frontend half of `SCAFFOLD_CLEANUP_PLAN.md` § Frontend before migrating anything. Confirmed
against that plan's own table:

`Candidate.tsx` (22) · `AddCategoryForm.tsx` (15) · `AddQuestionForm.tsx` (14) ·
`SelectQuestionType.tsx` (12) · `RulesModal.tsx` (10) · `AddJobRoleForm.tsx` (8) ·
`AddTestSectionForm.tsx` (2) · `TestCard.tsx` (2) — **85 occurrences, 8 files.**

Two caveats the cleanup plan itself raises, and they are worth honouring:

- **`RulesModal.tsx`** — "a marketplace may want a terms-acceptance modal — read it before discarding."
- **`TestCardSkeleton.tsx`** — "a useful skeleton reference — consider generalising rather than deleting."

⚠️ **This phase deletes product surface area, so it needs its own explicit approval.** If you would
rather not delete yet, the fallback is to skip these 8 files in Phase 3 and accept that the inherited
screens stay orange until they go — a visibly two-tone app in the interim. **Deleting first is
cleaner; ask before doing either.**

**Done when:** the 8 files and their routes are gone, `npm run build` passes, and the union grep is
down to ~215 occurrences across 25 files.

---

### Phase 3 — Migrate call sites to tokens *(no visual change)*

Mechanical sweep of the remaining 215 occurrences in 25 files: every `#F97316`, `#EA6C0A` and
`orange-*` becomes a token from Phase 1. Still orange on screen.

Highest-value first — `Sidebar.tsx` alone is 46 of them, and `Button`/`Input`/`Badge`/`DataTable`/
`Select` are the primitives every other file inherits from.

**Verify with the grep, not by eye:**

```bash
grep -rn 'F97316\|EA6C0A\|orange-[0-9]\{2,3\}' app components   # must return nothing
```

**Done when:** that grep is empty, `npm run build` and `npm run lint` pass, and both themes are
visually unchanged. **This is the point of no-visual-change discipline — if anything moved, the
migration was not mechanical and needs review.**

---

### Phase 4 — Flip the palette *(the visible rebrand — one commit)*

Change the token values only. Teal `#24695c` + tan `#ba895d`, the shade ladders from § Full Palette by
Frequency, the six semantic tones, and exceptions E1–E3 if kept.

Because Phase 3 removed every hand-painted colour, this really is a config edit — and it reverts with
`git revert`.

**Done when:** the app is teal, and no file outside `tailwind.config.ts` changed in this commit.

---

### Phase 5 — Surfaces, radius and elevation

The structural half. Four changes that interact, so do them together and review as one:

| Change | From | To |
|--------|------|-----|
| Card radius | `rounded-lg` | `radius 0` — squared |
| Card padding / margin | current | 30px / 30px |
| Card border | `border-gray-300` | `#e6edef` light, `#142831` dark |
| Dark elevation | card `gray-800` on `gray-950` page | card `#111727` on `#202938` page — **inverted** |
| Light page | `bg-white` | `#f5f7fb` |

Two things to settle here, both flagged above:

1. **Define "surface" vs "control".** Cards square, buttons and inputs stay rounded (Viho's own rule:
   button ≈5–6px, active nav ≈8–10px — our `rounded-lg` at 8px already matches). Write the rule into
   `UI_PATTERNS.md` explicitly, or the mixed radii come straight back.
2. **Resolve the 79 pre-existing `rounded-xl`/`rounded-2xl`** while you are in these files.

⚠️ The dark inversion is a *conceptual* flip, not a re-hex. Every `dark:bg-gray-800` surface and its
page background swap relationship. 38 + 31 + 9 = 78 dark surface utilities are in scope.

**Done when:** both themes match the reference screenshots, and `dashboard-default-dark.png` in
particular — that shot is the whole point of item 4.

---

### Phase 6 — Montserrat

Swap Inter for Montserrat through `next/font/google`, exactly as Inter is loaded today. Body 14px.

⚠️ **Never add a Google Fonts `<link>`** — `UI_PATTERNS.md` § Typography, and `next/font` is what gives
us self-hosting and zero layout shift.

Viho's heading scale is deliberately compressed (h2→h3 is 2px, h3→h4 is 4px). Adopting it means less
hierarchy than Tailwind's default gives us; that is the intended look.

**Done when:** no Inter reference remains, and the dense index tables have been re-checked — Montserrat
is wider than Inter at the same size and the tables are the tightest thing we render.

---

### Phase 7 — Re-measure `useAutoPerPage()`

`floor((h − 433) / 38)` encodes the old card padding and row height. After Phases 5 and 6 both
constants are wrong.

Measure, don't compute: render a real index page at several viewport heights, count rows that fit,
solve for the offset and row height.

**Done when:** rows-per-page fills the viewport with no page-level scrollbar at 1080p, 1440p and a
laptop 768px height. **This is the one place a purely visual decision has a functional consequence —
the reference doc calls it out as easy to miss, and it is.**

---

### Phase 8 — The components Viho has and we don't

Ordered by reuse. The first four are cheap and immediately useful:

| Component | Spec | Reference |
|-----------|------|-----------|
| **Soft badge variant** | `bg-tone/20 text-tone` alongside the existing solid `bg-tone text-white` | § Semantic Tones — "the single most reusable thing in this batch" |
| **`Button` tinted variant** (`btn-primary-light`) | `bg-brand/10`, no border, brand text; hover `bg-brand/50` + white | § Component Anatomy |
| **Password reveal toggle** | Text `Show` in brand colour inside the field — not an eye icon, so no icon licensing question | § Login Screen Anatomy |
| **`Input` addon slot** | Tinted `bg-brand/10` prefix, `border:none`, icon in full brand | § Login Screen Anatomy — "the main component gap" |
| **Upload drop zone** | `border-2 border-dashed border-brand bg-brand/10`, centred "Drop here" | § Form Patterns |
| **`Button` `danger` variant** | Pre-existing gap — `UI_PATTERNS.md` § Known Issues asks for it | — |
| **Ghost/track bars** | Pale track behind a real bar — "of a maximum" with no second axis | § Dashboard Shell |
| **Stepper / wizard** | Blocked on Phase 0 gap #2. Partner onboarding needs it | — |
| **In-cell sparkline** | ⚠️ `DataTable` has no cell-renderer story. **A real feature, not a style tweak** — don't promise it from a mockup | § Dashboard Shell |

**Do not copy** Viho's `Add`(tan) / `Cancel`(red) button pairing — red for a non-destructive cancel
trains users to fear it. Use `primary` for the affirmative, `outline` for cancel (§ Form Patterns
note 1). Likewise its asterisk-in-placeholder required marker, which vanishes exactly when the user
needs it; our `Input` requires a real label.

---

### Phase 9 — Screen fidelity pass

With tokens, surfaces, type and components in place, walk the screens against the catalogue. Sign-in
first — it is the screen the owner shared, it is fully specified in § Login Screen Anatomy, and it is
the smallest.

Use `max-width: 450px`, **not** Viho's fixed `width: 450px`, which breaks below 474px.

---

### Phase 10 — Retire the scaffolding

Per `assets/screenshots/README.md` § Retirement: once the components are built and the patterns live in
`UI_PATTERNS.md`, delete `assets/screenshots/`, strip § Screenshot Catalogue from the reference doc,
and keep the doc — the values are the lasting output.

> ⚠️ **Decide this before the work merges, not after.** `git rm` removes the files from the working
> tree, **not from history**. The ~14 MB still ships with every clone and stays reachable at old
> commits on a public remote. Actually un-publishing them needs `git filter-repo`/BFG plus a
> force-push, which rewrites every commit hash. Rewriting one unmerged branch is cheap; rewriting
> `main` later is not.

---

## 📋 Phase Summary

| Phase | Work | Visual change? | Blocked by |
|:-----:|------|:--------------:|-----------|
| 0 | Close the 4 reference gaps | — | — |
| 1 | Token layer, still orange | **No** | — |
| 2 | Delete inherited screens (−85 occurrences) | Routes removed | **Owner approval** |
| 3 | Migrate 215 call sites to tokens | **No** | 1, 2 |
| 4 | Flip palette to teal + tan | **Yes — the rebrand** | 3 |
| 5 | Square cards, 30px, inverted dark | **Yes** | 4 |
| 6 | Montserrat | **Yes** | — |
| 7 | Re-measure `useAutoPerPage()` | Row counts | 5, 6 |
| 8 | New components | **Yes** | 4, and 0 for the wizard |
| 9 | Screen fidelity pass | **Yes** | 5, 6, 8 |
| 10 | Retire screenshots | — | 9 |

Phases 1–4 are the spine: they turn "a rebrand means editing 37 files" into "a rebrand is one commit",
and they are worth doing in that order even if everything after slips.

---

## ✅ Still Needs a Decision

| # | Question | Why it matters |
|---|----------|----------------|
| 1 | **Exceptions E1–E4** — keep the four accessibility carve-outs, or go literally 100%? | E1 is white-on-mustard at **1.70**; E4 removes the focus ring |
| 2 | **Phase 2** — delete the inherited screens now, or leave them orange until later? | Deleting removes 35% of the migration for free; not deleting means a two-tone app in the interim |
| 3 | **Screenshot history rewrite** — decide before merge (Phase 10) | Cheap now, expensive on `main` |

---

## Related Documentation

- [`VIHO_THEME_REFERENCE.md`](./VIHO_THEME_REFERENCE.md) — every measured value; the source for this plan
- [`../system-design/UI_PATTERNS.md`](../system-design/UI_PATTERNS.md) — our design system; **rewrite it as each phase lands**
- [`../planning/SCAFFOLD_CLEANUP_PLAN.md`](../planning/SCAFFOLD_CLEANUP_PLAN.md) — Phase 2's deletion list
- [`../planning/TECH_DEBT.md`](../planning/TECH_DEBT.md) — PM-20, re-scoped 2026-08-05 with the real counts
- [`assets/screenshots/README.md`](./assets/screenshots/README.md) — Phase 0 conventions, Phase 10 retirement

---

**Measured:** 2026-08-05 against commit `b144c24` · **Re-run the greps before starting any phase** —
these counts move with every commit.
