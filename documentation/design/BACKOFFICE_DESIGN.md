# `DESIGN.md` — Surface B, the signed-in back office

> **Status: SPEC.** Written 2026-08-20; **§ 2–§ 7 rewritten the same day** after auditing how the
> public surface actually composes rather than what `public.css` says about itself. The first draft
> was a palette with contrast ratios; it did not say *where each colour goes*, which is the only part
> that produces a recognisable taste. That omission is corrected here.
>
> **Steps 1–7 of § 12 are implemented and verified (2026-08-20).** Only step 8, per-user themes,
> is outstanding. Where implementation disproved something this file asserted, the claim is corrected
> in place with a ⚠️ note rather than quietly deleted — § 4.2, § 4.4 and § 6 each carry one.
>
> **Scope: `app/(app)/`, `app/(auth)/` and `components/{admin,common,dashboard,settings,ui}`.**
> Not `app/(public)/`, which has its own tokens and its own references folder. The two surfaces stay
> firewalled — this file borrows the public palette's *values and roles*, never its stylesheet.

**The brief (owner, 2026-08-20):** *"not just that green — where exactly is that green used, where the
yellow for icons, the creamy background, the black cards with white text, the light purple. So the
admin can say we have a taste for the frontend and for the back office as well."*

[`UI_PATTERNS.md`](../system-design/UI_PATTERNS.md) stays authoritative for **how** the back office is
built — its three-page contract, CRUD contract, responsive contract and its five "chrome is green"
rules. This file governs **what colour each thing is, and why that one**. On a mechanism,
`UI_PATTERNS.md` wins.

---

## 1 · The taste, in one paragraph

**A dense administrative tool that is unmistakably the same product as the marketing site, without
pretending to be a marketing page.** Four things carry the identity: a ground that is never pure
white, structure in deep pine, one pale-lilac action colour, and amber reserved for small marks on
dark. Surfaces are separated by borders and ground shifts — **never by a shadow**. Emphasis colour
changes with the ground it sits on, always as a pair, never chosen per call site.

**The one deliberate constraint** (`ANTI_SLOP.md` § 2②): **no shadow ever separates two static
surfaces.** A shadow may only mean *this is temporarily floating above the page* — an open menu, a
modal, a toast. § 6 audits how close the code already is.

## 2 · Colour palette & roles

Every hex is `public.css`'s own. Every ratio is measured with `core/theme.py::contrast_ratio`. The
**Used for** column is the audited role on the public surface — call-site counts in § 2.3.

### 2.1 The roles

| Colour | Token | Role — audited, not assumed | Foreground | Measured |
|---|---|---|---|---|
| **Deep pine** `#034f46` | `--brand` | **Structure.** Chrome, links, focus, premium slabs, logo tiles, headers. The emphasis colour on light grounds | white / cream | **9.50:1** |
| **Pale lilac** `#f0d7ff` | `--primary` | **Action, and only action.** Primary buttons, back-to-top, the search affordance, the middle verification tier. Never a content ground | **ink** — never white | **11.01:1** on the house `ink` `#242934` (13.15:1 on the public surface's `#1a1a1a`) |
| **Ink** `#1a1a1a` | `ink` | Body text on light. **And a full ground** — the black slabs | cream on it | 17.20:1 |
| **Cream** `#ffffeb` family | ground | The page. Never pure white | ink | 17.20:1 |
| **Amber** `#ffa946` | `--accent` | **Icons, eyebrow labels, display numerals, bullet marks — on dark grounds.** Pine's counterpart when the ground is dark | — (never text on light) | 9.37:1 on `night.card` · **1.91:1 on white ❌** |

Coral `#ff6c4c` and blush `#ffbcf2` are declared in `public.css` and used **once each** across the
entire public surface. They are not part of the identity. **Do not port them** — importing an unused
colour is how a palette becomes decoration.

### 2.2 🔴 The two-ground rule — this is the taste

The public surface never picks an emphasis colour by hand. It picks a **ground**, and the ground
decides everything else. `StepList.tsx` is the rule in four lines:

```tsx
dark ? "text-[color:var(--public-amber)]" : "pub-deep"          // the numeral
dark ? "border-[color:var(--public-cream-30)]" : "border-ink"   // the rule above it
dark ? "text-[color:var(--public-cream-70)]"   : "pub-muted"    // the body copy
```

So, as a table — and **each row is a unit; never split one**:

| On a **light** ground | On a **dark** ground |
|---|---|
| emphasis = **pine** | emphasis = **amber** |
| body = ink | body = cream |
| muted = `#5c5c52` (6.68:1) | muted = cream at 70% |
| hairline = ink, 2px | hairline = cream at 30%, 2px |
| action = **lilac** + ink text | action = **pine** + cream text, or transparent + cream border |

**The back office already has this rule and calls it something else.** `text-brand
dark:text-brand-on-dark` is the same pairing, for the same reason, and `UI_PATTERNS.md` already
forbids splitting it. Light mode *is* the cream ground; dark mode *is* the ink slab. Everything in
this file follows from mapping those two onto each other.

⚠️ **The one place the mapping is not literal.** On dark, the public surface uses **amber** as
emphasis; the back office uses **`brand-on-dark`** — a lightened pine, derived per preset. Keep
`brand-on-dark` for anything that must follow the selected theme (a Crimson installation with amber
emphasis would clash), and use amber only in the **fixed accent** role of § 4.6. Amber is `--accent`,
not `--brand-on-dark`.

### 2.3 The evidence

Token frequency across `app/(public)` + `components/public`, which is what tells role from decoration:

```
pub-display 50   pub-muted 49   pub-ink 36   pub-focus 30   pub-deep 22
pub-cream 18     pub-bg-alt 18  border-thick 14  pub-bg 12   pub-deep-bg 9
pub-lilac-bg 6   pub-ink-bg 6   amber 11 (all via var())   coral 1   blush 1
border-2 × 22    border-t-2 × 10    shadows: 0
```

Read that as: **borders are the system** (32 uses, zero shadows), pine outnumbers lilac as *text*
3.7:1 while lilac owns the fills, and amber is real but small.

### 2.4 The four grounds

`SectionSlab.tsx` — the ground and its text colour are paired **in the component**, deliberately, so
no call site can put ink text on a pine slab:

| Ground | Class pair | Where |
|---|---|---|
`cream` | *(no-op)* | the default page |
`alt` | `pub-bg-alt pub-ink` | quiet secondary bands |
`deep` | `pub-deep-bg pub-cream` | the premium/branded slab |
`ink` | `pub-ink-bg pub-cream` | the "black cards, white text" slab |

## 3 · Typography

**Montserrat only in the back office.** `next/font` self-hosts it and it is in the performance budget
(`FRONTEND_PLAN.md` § 11).

**✅ Reversed 2026-08-20 at the owner's request — the display face is now shared.** `EB_Garamond` moved
from `app/(public)/layout.tsx` to the **root** layout, so `--font-eb-garamond` is global and
`globals.css`'s `.app-display` is the twin of `public.css`'s `.pub-display`, reading the same variable.
The two surfaces are now literally the same type, not merely the same body font. The public layout's
own copy was removed rather than left duplicated; its config was byte-identical, so that surface
renders unchanged.

🔴 **Weight 400 only, like the reference — never pair `.app-display` with `font-bold` or
`font-semibold`.** The browser would synthesise a bold, which on a high-contrast serif looks smeared
rather than strong. Size and tracking carry the emphasis. Every site it was applied to had its weight
class removed.

**Where it goes: 18px and up.** The marketing site reserves it for 24px+ — measured across its 50 uses,
never below `text-lg`. The back office runs at a smaller scale throughout, so the floor moves down with
it. A serif on a 13px card title in a dense table is worse than no serif. Applied so far: the dashboard
hero and its two section headings, `MetricCard`'s figure, `FeatureSlab`'s heading, and the sign-in
heading. Index-page headings are the obvious next sweep.

*The original reasoning, kept because it was the right call until the owner decided otherwise:*
**EB Garamond was deliberately not ported.** It is `pub-display`, the single most-used class on the public surface (50 uses) — and the
audit shows it appears **only at `text-2xl` and above** (2xl ×14, 3xl ×14, 4xl ×12, 5xl ×2, never
below `lg`). It is a headline face, nothing else. The back office's largest recurring type is a card
title; a serif bought for a data table is a font download every route pays for and almost no pixel
uses. **Open question § 13①.**

## 3A · One heading component, three sizes — `PageHeading`

Added 2026-08-20. **Nine admin modules each hand-rolled the same three lines** —
`<h1 className="text-lg font-semibold text-ink dark:text-gray-100">` over
`<p className="mt-1 text-sm text-ink-muted dark:text-night-muted">` — plus `ShowPage`, `CardHeader`,
the settings shell and six section headings on their own variants. **Twelve definitions of one idea**,
which is why "apply the display face everywhere" would otherwise have meant editing twenty files, and
would have drifted again by the next feature.

| size | renders | where |
|---|---|---|
`page` | 21px | a page's own title — the default |
`section` | 19px | a titled block inside a page |
`compact` | 18px / `leading-5` | a header sitting directly above a table |

🔴 **`compact` exists for one measured reason.** `CardHeader` sits inside the index `Card`, and
`useAutoPerPage()` computes rows as `floor((viewportHeight − 433) / 38)` — that 433 is the chrome
around the table. **Growing the header's box costs a table row at common viewport heights**: at 1080px,
433 → 441 turns 17 rows into 16. That coupling is what `Card.tsx` has warned about since the Viho
migration. So `compact` raises the title from 14px to 18px **while holding the line box at 20px** — the
index pages get the display face and `CHROME_OVERHEAD` needs no re-measuring.

`headingClasses(size)` is exported for the handful of headings whose title is a multi-line JSX
expression already nested inside its own layout. Same reasoning as `common/Button.tsx` exporting
`buttonClasses`: a caller that cannot use the component must still not restate the definition.

**Every back-office heading now routes through one of the two.** The only remaining match for the old
hand-rolled pattern is inside `PageHeading`'s own docstring.

## 4 · Component map — where each colour goes

This is the section the first draft was missing.

### 4.1 The chrome (sidebar, drawer, top nav, page canvas)

Already `bg-surface-wash` since 2026-08-07 — the brand at 10% over white, now a pale pine
`#e6edec`. **This is the cream ground's structural equivalent and it needs no new mechanism.**
`UI_PATTERNS.md` § "The Signed-In Chrome Is Green" carries five rules that hold verbatim under pine;
re-derive their *numbers*, not their logic, because the tint changed:

- Hairlines on the chrome stay `border-brand/20` — `surface-border` on `surface-wash` measures
  **1.02:1**, which is not faint, it is gone
- `text-ink-muted` is an AA fail on the chrome (4.19:1). Use `text-ink-label`
- Popovers stay `bg-white` — with no shadows, white-on-tint is the only float cue
- Never hover to a grey. The house hover is `hover:bg-brand/10 hover:text-brand`
- Any `ring-offset-*` needs an explicit colour or Tailwind draws a white halo

### 4.2 Buttons

`PublicButton.tsx` has seven variants and **a 2px border on every one, including the filled ones** —
that border is most of why the reference reads as confident. The back-office mapping:

| Public variant | Fill / text / border | Back office |
|---|---|---|
`primary` | lilac / ink / 2px ink | `bg-primary text-primary-foreground` — **the answer to the black-and-white complaint** |
`secondary` | cream / ink / 2px ink | the existing secondary |
`deep` | pine / cream / 2px cream | the primary action **inside** a dark card, where lilac fights the ground |
`outline` | transparent / pine / 2px pine | quiet tertiary |
`onDeep` | transparent / cream / 2px cream | the second action inside a dark card |
`dark` | ink / cream / 2px ink | — |
`text` | transparent, **transparent border reserved** so nothing shifts on hover | link-buttons |

🔴 **`--primary-foreground` must be ink, never white.** White on lilac is **1.32:1**.

🔴 **A lilac fill measures 1.11:1 against the chrome ground — it has no edge of its own.** Ink on the
chrome is 12.27:1, so **every lilac control carries a border**, and that border is a legibility
requirement (WCAG 1.4.11 wants 3:1 for a component boundary), not a stylistic flourish. This is the
one thing the public surface gets for free and the back office does not: there, lilac sits on cream
with a 2px ink border already.

⚠️ **Corrected during implementation.** This section claimed the recolour was "one variable — all five
shadcn components repaint with no component edit". That was wrong on both halves:

* `ui/button.tsx`'s `default` variant did not use `bg-primary`. It used **`btn-primary`, a class that
  is not defined anywhere** — no `.btn-primary` rule exists in `globals.css` or `public.css`, and the
  `app.css` that `tailwind.config.ts` refers to does not exist. So it rendered `text-stone-50` on a
  transparent background: an invisible button. It never showed, because the only consumer
  (`vendor-datatable`, live on 10+ admin screens) uses `ghost` and `outline` exclusively. A latent
  bug, now moved onto the tokens.
* `text-primary` on the `link` variant would have become **lilac text at 1.32:1**. It is now
  `text-brand dark:text-brand-on-dark` — a text link is structure, which is the brand's job.

What *does* repaint from the token alone is the **row-selection checkbox** on those 10+ screens
(`data-[state=checked]:bg-primary`), which is the one live, visible shadcn fill.

**The app's real buttons are `components/common/Button.tsx`, not the shadcn one**, and its `primary`
variant is where lilac actually lands.

### 4.3 Cards

Public: `pub-bg pub-border-thick rounded-[1.5rem] sm:rounded-[2rem] p-5 sm:p-7`, hover darkens the
border toward ink and an arrow nudges 2px. **The colour logic ports; the geometry does not** — see
§ 5. In the back office: white card on the tinted chrome, `border-brand/20`, radius `5px`, hover
darkens the border. **No shadow, no lift.**

### 4.4 Status chips

`VerificationBadge.tsx` is a three-tier scale, `rounded-full border-2`, and it maps directly onto
back-office status chips:

| Tier | Public | Back office |
|---|---|---|
highest | pine ground + cream text | the existing `success` / `brand` tones |
middle | **lilac** ground + ink text | **`pending`** — *the one place lilac is not an action* |
lowest | cream ground + ink text, `bg-alt` border | the existing `neutral` tone |

⚠️ **Implemented as an addition, not a rebuild.** `common/Badge.tsx` is a six-tone **outlined** system
(`border-X bg-X/10 text-X`), every tone with an explicit dark variant. Converting it to the public
surface's *filled* tiers would make every table visibly heavier — the same "weight does not port"
logic as § 5's geometry. So the port added one tone, `pending`, for the in-review states that
previously had to borrow `warning` and therefore read as a problem. It is **solid** lilac rather than
tinted, because `bg-primary/10` on a white card is very nearly white and the point of lilac is that
it is recognisably the marketing site's colour.

### 4.5 Tables

No public equivalent — `TierTable` is a comparison grid, not a data table. So the back office keeps
its own table entirely, with two colour rules from § 2.2: the header uses `--muted`
(`= --surface-tile`, a brand tint that follows the theme), and row hover is `bg-brand/10`, never a
grey.

### 4.6 The accent — amber, and where the yellow actually goes

`--accent` is Viho's tan `#ba895d` today and is used in **exactly two components, four lines**:
`StatCard.tsx` and `QuickActionsCard.tsx`, both as `bg-accent/20 text-accent-dark` /
`dark:bg-accent/25 dark:text-accent-light`. Amber replaces tan in that role — both are warm mid-tones
in the same job, and the swap is contained to four lines.

Audited amber roles on the public surface, all of which have a back-office equivalent:

| Public use | Back office |
|---|---|
`h-7 w-7` icons inside the **ink slab** | icons on dark cards, and the StatCard/QuickActions tiles |
`text-5xl` display numerals on ink | large figures on dark |
uppercase `tracking-[0.12em]` eyebrow labels | section eyebrows |
`h-1.5 w-1.5 rounded-full` bullet marks | list marks |
footer link hover, **on dark only** | dark-mode hover accents |

🔴 **Amber may never be text on a light ground — 1.91:1.** The existing pattern already solves this:
`text-accent-dark` on a `bg-accent/20` fill. For amber that darkened shade is about **`#805423`**
(5.76:1 on its own tint, 6.54:1 on white) and the light-mode counterpart for dark cards is around
`#ffc37e` (11.36:1 on `night.card`). Validate the exact pair at implementation.

### 4.7 Stat tiles — the ink slab, and the only place it fits

`components/common/StatTiles.tsx`, the KPI row above an index table. Live on **4 screens** —
Invitations, Enquiries, API Docs, Worker Jobs. This is the one back-office component where the public
surface's **ink slab** ("black card, light text") genuinely belongs: a KPI row is a small number of
large figures, which is exactly what the reference uses an ink slab for.

| | fill | figure | label | hint | hairline |
|---|---|---|---|---|---|
light | `bg-ink` | **`text-accent`** (amber) | `text-white` | `text-white/70` | `border-white/10` |
dark | `bg-white/[0.03]` *(unchanged)* | `text-accent` | `text-gray-200` | `text-night-muted` | `border-night-border` |

**Layout: label and hint left, figure right, `items-baseline`.** Changed 2026-08-20 — the figure used
to stack above the label. Baseline alignment rather than `items-start` is what makes a `text-2xl`
figure and a `text-xs` label read as one row; a flex item that is itself a block aligns on its **first
line box**, so the hint hanging below never moves the figure, and every figure in the row lands on the
same line whether its neighbour's hint wrapped or not.

The restructure retired two mechanisms, and both were load-bearing:

* the figure's **fixed 30px bottom-aligned box**, which existed so a `textual` tile's short line did
  not leave its label riding ~16px above the numeric tiles beside it — `items-baseline` now does that
  for both kinds at once;
* the hint's **`mt-auto`**, which pushed it to the tile's floor so hints aligned across the row. Hints
  still align, because every label is a single truncated line and so every hint starts at the same
  offset.

🔴 **`Tile`'s `min-h-[62px]` and the skeleton's `h-[62px]` are the same number on purpose.** That is
what stops the row changing height when the data arrives and shoving the table down — the tiles sit
directly above a table that is loading too. Change one and you must change the other.

**Light and dark are asymmetric on purpose.** `bg-ink` measures **13.58:1 against the chrome** and
**14.57:1 against the white index card** — but **1.23:1 on `night-card`**, i.e. invisible. The ink slab
reads as striking *because* it contrasts with a light ground; on an already-dark page the equivalent
gesture is to **lift, not to darken**. So dark mode keeps the faint lift it already had.

**Both modes are a dark ground, so both take § 2.2's dark-ground row** — which is why the figure is
amber in light mode too. Amber on ink is **7.64:1**, on `night-card` **9.37:1**. On the public surface
the display numeral on an ink slab *is* amber (`StepList` when `dark`, and the home page's step list),
so this is the reference's own treatment rather than an invention.

⚠️ **It does not break the "never colour the figure" rule.** That rule forbids a *semantic status*
colour on the figure — measured at 1.84:1 and 1.47:1 when it was tried — because a semantic fill is
built to sit behind white text. The amber is a uniform display treatment: every tile gets it, so it
carries no status.

**The status dots all needed dark-ground variants**, and one of them was already broken:

| tone | was | on ink | on `night-card` | now |
|---|---|---|---|---|
brand | `bg-brand` | 1.53:1 ❌ | — | `bg-brand-on-dark` |
success | `bg-tone-success` | 1.15:1 ❌ | **1.41:1 ❌** | `bg-brand-on-dark` |
warning | `bg-tone-warning` | 8.58:1 ✅ | 10.52:1 ✅ | unchanged |
danger | `bg-tone-danger` | 2.90:1 ❌ | 3.56:1 | `--tone-danger-on-dark` |

🐛 **`success` was invisible in dark mode before this change** — 1.41:1 on `night-card`, on every
screen with a success tile. `tone-success` is the brand darkened 27%, so `brand-on-dark` is its correct
counterpart and fixes both grounds at once. `--tone-danger-on-dark` (`#db5760`, that red with 20% cream)
is a new variable in `globals.css` rather than a Tailwind key, because `tailwind.config.ts` is
Protected — call sites use `bg-[rgb(var(--tone-danger-on-dark))]`, which still resolves through a token
rather than a hex.

### 4.8 Empty states

`EmptyState.tsx`: thick-bordered panel, display heading, muted body, one primary action. The
structure ports as-is; only the geometry tightens.

### 4.9 The header pair — account disc and log out

`common/TopNav.tsx`. Both controls sit hard against the top-right corner and now share the lilac
action treatment, so they read as one pair instead of two unrelated things.

| | fill | text | border | active |
|---|---|---|---|---|
log out | `bg-primary` | `text-primary-foreground` | `border-ink` | — |
account disc | `bg-primary` | `text-primary-foreground` | `border-ink` | **inverts** — `bg-ink text-primary` |

**The active disc inverts the same two colours rather than reaching for a third.** On `/settings/*` it
becomes an ink disc with lilac initials — the same 11.01:1 read the other way round. It replaces
`bg-brand-dark`, which is no longer part of the pair.

The ink border is required on both: a lilac fill measures **1.23:1 against the chrome**. The public
surface's own precedent for a lilac disc with an ink border is `VerificationBadge`'s middle tier,
`rounded-full border-2`.

Hover **shrinks** rather than inverting to a solid fill, matching § 7 and `common/Button.tsx`. No
`dark:` colours on either: lilac and ink are absolute, and lilac on `night-card` is 13.50:1.

⚠️ **Log out is still hand-rolled** rather than `<Button variant="primary">`, because its geometry is
bespoke (`px-4 py-2.5 text-xs`, `rounded-[8px]`, cornered) and deliberately placed. Its *colours* are
tokens now, so it can no longer drift from the shared definition on colour — only on geometry.

⚠️ **`components/dashboard/Navbar.tsx` is dead code** — nothing imports it, `AppShell` renders
`TopNav`. It contains a second account disc and a second search box. Left alone; worth deleting.

### 4.10 The dashboard — it already followed, except for one bug

Audited 2026-08-20. The dashboard needed almost nothing, because it was already built on tokens: the
brand went pine, `--accent` went amber, and the cards came along without being touched.

* **`WelcomeBanner` is already a slab** — `bg-brand text-white`, 8.86:1 against the chrome. It is the
  dashboard's equivalent of the reference's pine section, and it was there before this port.
* **`StatCard` / `QuickActionsCard` badges already carry the amber** via `bg-accent/20
  text-accent-dark` (5.76:1) and `dark:bg-accent/25 dark:text-accent-light` (6.70:1). The oversized
  watermark glyph is `text-accent/[.06]`, now a faint amber.
* **`QuickActionsCard`'s link colour** is `text-accent-dark` on the white card — 6.54:1.

🐛 **The bug: the dashboard cards had no visible edge until you hovered them.** `StatCard`,
`QuickActionsCard` and `PartnerOverview`'s tiles each paired a resting `border-surface-border` with a
`hover:border-brand/40`. On the chrome, `surface-border` measures **1.12:1** — so the border only
appeared on hover, which reads as the border being a hover effect rather than the card having an edge.
`UI_PATTERNS.md` § "The Signed-In Chrome Is Green" has mandated `border-brand/20` (**1.41:1**) for
exactly this since 2026-08-07, and `common/Card.tsx` already complied; these three had never been
migrated. Fixed.

**⚠️ Refined 2026-08-20, having got this wrong once.** The first version of this section said *"do not
make the dashboard cards ink slabs"*, on the grounds that the page would become a wall of black. That
was right about the **action** cards and wrong about the **metrics**, and the distinction is the
alternation, not the colour:

```
pine slab   WelcomeBanner
  chrome      "Overview" heading, on the page ground
ink row     4 × MetricCard          ← matches StatTiles above every index table
  chrome      "Quick Actions" heading
white grid  5 × ActionCard
```

Three bands with the chrome showing through between them, so the rhythm holds — and the headline
counts now look the same on the dashboard as they do above every index table, which they did not
before. Turning the **action** cards ink as well is what would flatten it, and they stay `paper`.

**And the cards were migrated, not just recoloured.** `DashboardOverview` now renders `MetricCard`
and `ActionCard`; `dashboard/StatCard.tsx` and `dashboard/QuickActionsCard.tsx` have **zero importers**
and are dead. Three things changed that a recolour alone could not have:

* the figure moved beside its label instead of sitting above it, matching `StatTiles`;
* each quick action ended in a **"Get Started"** button — five identical labels naming neither the
  destination nor the action. `ActionCard`'s arrow says it without pretending to be a control;
* both old cards carried their own inline-SVG `iconMap`, two copies of the same six glyphs at two
  sizes. `lucide-react` was already a dependency.

**No `delta` on the dashboard metrics.** There is no trend data behind those counts, and a plausible
"+12%" is exactly the invented figure `ANTI_SLOP.md` § 3 exists to prevent. The prop is there for when
the API grows a comparison.

### 4.12 Charts — `components/common/charts/`

Added 2026-08-20, ready-to-use and wired into nothing yet. **Zero dependencies** —
every mark is inline SVG. A charting library would have cost more than the whole
route's JavaScript budget (`FRONTEND_PLAN.md` § 11 caps first-load at 150 kB), and
none of these forms need one.

| Component | Form | Job |
|---|---|---|
`TrendChart` | line / area, crosshair + tooltip | change over time |
`BarChart` | horizontal bars | magnitude, low → high |
`StackedBar` | one split bar | part-to-whole |
`Sparkline` | 12-point trend, no axes | shape inside a stat tile |
`Meter` | one bar against a limit | a single ratio |
`ChartFrame` | title, legend, **table view** | the shell all of them sit in |

#### 🔴 The palette was computed, not chosen

| slot | | measured |
|---|---|---|
1 teal `#37a08c` · 2 amber `#d67300` · 3 azure `#3784be` · 4 bronze `#b17543` · 5 plum `#a250a4` | | worst adjacent CVD **13.3** (target ≥ 8) · normal-vision floor **19.4** (gate ≥ 15) · all ≥ 3:1 |

Validated for light (on the white card) **and** dark (`night.card`) — the slots are
identical in both because that is what passed, not because dark was flipped. The
sequential ramp is separate and re-stepped per mode; it took four steps, not five,
because five failed the adjacent-lightness gate and the light end failed contrast
until it started darker.

**There is deliberately no red in the categorical set.** Status-critical is red, and
a status colour must never be able to impersonate a series. Two earlier orders passed
every check *with* crimson in slot 2 — they were discarded for that reason.

**A 6th series is not a colour problem.** `seriesColor()` throws past the last slot
rather than wrapping, because cycling is the failure that renders fine and so goes
unnoticed. Fold the tail into "Other", facet, or change the form.

⚠️ These are **adjacent-pairlist** safe. A scatter, bubble or map compares *every*
pair and caps at fewer series — re-validate with `--pairs all` before building one.
No trio here passes that gate.

#### Two defects the anti-pattern check caught in my own first draft

Recorded because both render perfectly and are still wrong:

* **`BarChart` shaded each bar darker-where-bigger**, and its docstring argued for
  it. For *nominal* categories that re-encodes what bar length already shows and
  burns the only free channel. Now one colour for every bar, with `ordinal` opting
  into the ramp for categories that have a real order.
* **`StackedBar` filtered zero-value segments and then indexed for colour**, so a
  segment reaching zero repainted every survivor. Colour now comes from the
  segment's original index — it follows the entity, never its current position.

#### The second wave — 2026-08-20

| Component | Form | Colour job |
|---|---|---|
`HeroFigure` | the one lead number, 52px | none — **sans, never the serif** |
`GroupedBar` | series side by side, capped at 3 | **categorical** — the one form where it is the job |
`DivergingBar` | above/below a baseline | **diverging** |
`Heatmap` | magnitude on a grid | sequential |
`EmphasisChart` | one series in colour, rest grey | 1 hue + de-emphasis |
`Dumbbell` | before → after per item | 1 hue, 2 shades |
`SmallMultiples` | a facet per category | slot 1 in every facet |

**Diverging scale, validated:** teal (cool) against amber (warm), poles at ΔE 13.3
protan / 22.6 normal, each arm passing the ordinal ramp checks, and a **neutral grey
midpoint** — never a hue at the middle, and never two cool hues as the poles, or the
reader sees difference rather than opposition.

**`SmallMultiples` is how the series cap stops binding.** Every facet is slot 1, so
identity comes from the facet's heading and the colour channel stays free — which is
also why the all-pairs gate (no trio here clears it) never applies. One shared scale
across all facets, because per-facet scaling makes a flat series look as dramatic as
a steep one, which is the same lie a dual axis tells.

**`GroupedBar` throws past three series** and says to facet instead, for the same
reason `seriesColor` throws past slot five.

**`HeroFigure` is the one considered exception to § 3's display face.** A number set
in a serif reads as decoration rather than data. It also uses proportional figures,
not `tabular-nums` — tabular gives every digit the width of a zero, which is right in
a column and leaves `121` visibly gappy at 52px.

#### The third wave — 2026-08-20

| Component | Form | Colour job |
|---|---|---|
`FunnelChart` | ordered stages + drop-off | **ordinal** — one hue, depth = position |
`DivergingStackedBar` | Likert / sentiment share, centred on neutral | **diverging** |
`BulletChart` | actual vs target vs ceiling | sequential + reserved status |
`DataBarTable` | ranked table with inline bars, tail folded | one hue |
`ScaleLegend` | the key for any value scale | — |
`ChartEmpty` / `ChartSkeleton` | the two states nobody builds | — |
`ActivityFeed` | a run of events | none — **not a chart** |

🐛 **`Heatmap` shipped without a scale legend, which was a real gap.** Its per-cell
hover text carried the numbers, and hover reaches nobody on a keyboard, a screen
reader, a touch device or a printout. A sequential encoding without its key is
unreadable — the reader can see that one cell is darker and cannot turn that into a
number. `ScaleLegend` fixes it, and it is now required alongside every sequential or
diverging encoding.

**`FunnelChart` is ordinal, not categorical** — swapping two stages would change the
meaning, which is the test. It draws stacked bars rather than the tapering trapezoid
the name usually implies: a taper encodes the value twice, in width *and* in the
sloping edge, and the slope makes adjacent stages look closer than they are.

**`DivergingStackedBar` centres on the neutral band** so the direction a row leans is
the answer. A plain stack would force the reader to add segments to work out whether
the result is good.

**`DataBarTable` is the endorsed answer to "too many categories."** Past ~7 classes
that all carry meaning, colours stop being distinguishable — the guidance says use a
table, or a table plus a chart, and this is both. `limit` folds the tail into one
"Other" row rather than truncating: a top-five list that looks like the whole list is
worse than no list.

**`BulletChart` over a gauge.** A gauge says the same thing in five times the space
and asks the reader to compare angles. The bullet adds the one thing a `Meter` lacks —
a target tick — plus the verdict in words, because a tick alone leaves the reader
doing the comparison the chart exists to do.

**`ActivityFeed` is deliberately not a chart.** A sequence of discrete events has no
magnitude, so drawing one would be inventing a measurement.

#### Deliberately not built

Asked for "all the aesthetic things designers put on dashboards now", these were
refused, each for a reason already settled in this repo:

| Not built | Why |
|---|---|
Donut / pie | Angles are not comparable. `StackedBar` for part-to-whole, `Meter` for one ratio |
Radar / spider | Area misstates magnitude; axis order changes the shape |
Dual-axis combo | The alignment is arbitrary, so the chart invents a correlation |
Gauge / speedometer | A meter says the same thing in a fifth of the space |
Gradient fills | `WelcomeBanner` records the blue→cyan gradient as the most off-brand thing the dashboard ever had |
Glassmorphism / blur | Removed from this very banner as measurably pointless over an opaque fill |
Drop shadows on cards | § 1 — borders separate, shadows only float |
Animated count-ups | Delays the number to decorate its arrival |
3D anything | Perspective distorts the encoding |

#### Non-negotiables carried in the code

One y-axis, never two. Gridlines 1px solid, never dashed. Bars capped at 24px with a
rounded data end and a square baseline. 2px gaps and rings painted in the **surface**
colour, never as a stroke — a stroke is ink that is not data. Text always on ink
tokens, never the series colour. A legend for two or more series, none for one. And
**`ChartFrame`'s table view is mandatory**: it is what makes the numbers reachable
without colour, hover, or sight of the plot.

### 4.13 The component preview — `dashboard/ComponentPreview.tsx`

Every card and chart, rendered at the bottom of the dashboard, gated on
`isSuperAdmin`. It exists because both sets shipped wired into nothing and so could
not be looked at.

**Visible to `hasAdminAccess`** — RootUser, SuperAdmin, BackendDeveloper and Admin,
which is `core/roles.py`'s own `ADMIN_ACCESS_ROLES`. Widened from super-admin-only on
2026-08-20. **Deliberately not a hardcoded list of role names in the component**:
`roles.py` warns that a role name used as a rule must not be renameable, and a list
here would need editing every time a core role is added — until someone remembered,
the new role would silently lose access. `Staff` and `Sales` are internal but outside
that set, which is the project's existing line between managing the platform and
working in it. ⚠️ **There is no `Director` role**; if one is created with admin access
it appears here automatically, which is the point of gating this way.

🔴 **Every figure in it is invented and the section says so three times** — in the
heading, in a `Badge tone="warning"` beside it, and in each chart's own description.
A chart of made-up numbers on a dashboard is indistinguishable from a chart of real
ones, and this is the surface people visit to find out what is actually happening.
`ANTI_SLOP.md` § 3 applies with more force here than on any marketing page. **Never
connect it to a live endpoint** — if a chart here proves useful, move it into the
dashboard proper with its own data and delete it from the preview.

⚠️ **The gate is presentation, not security.** It renders no real data, so there is
nothing to protect; a client-side check hides UI and nothing more. A real query here
would need a server-side guard.

### 4.11 Floating layers

Menus, modals, toasts, the assistant widget. **The only place a shadow is allowed** — see § 6.

## 5 · Geometry — what deliberately does NOT port

The most likely way to get this wrong is to copy the marketing site's *shape* along with its colour.
Measured, the two surfaces are on different scales, and correctly so:

| | Public | Back office | Verdict |
|---|---|---|---|
Radius | `1.5rem`–`5rem` (24–80px) | **`rounded-[5px]` × 124** | **Keep 5px.** A 2rem corner eats a table cell |
Borders | `border-2` ×22, 4px on cards | `ring-1` / 1px | **Keep 1px.** 2px hairlines on a 12-column table is noise |
Slabs | inset, rounded, cream showing around | full-bleed panels | **Keep panels.** A dense tool has no room to inset |
Type | serif display, `text-4xl`+ | sans, `text-sm` baseline | **Keep sans** (§ 3) |

**The identity is carried by colour, ground pairing, and the absence of shadow — not by radius or
border weight.** A marketing page is looked at for forty seconds; a data table for eight hours.

## 6 · Depth & elevation — the audit

The back office has **22 shadow call sites**. Audited, and the result is better than expected:

**Legitimate temporary elevation (17)** — `Modal`, `FormModal`, `Toast`, `RowActions`,
`ColumnPicker`, `FilterCombobox`, `dropdown-menu`, `select` menu, `AssistantWidget`, `ScrollToTop`,
the mobile `Sidebar` drawer. All of these *float*. All allowed.

**The exceptions — 11, not 5. ✅ All removed 2026-08-20.** The first count was both wrong and scoped
too narrowly (it looked only at `admin`, `common`, `dashboard`, `ui` and missed `settings` entirely):

* `shadow-xs` ×6 — `ui/button.tsx` ×4, `ui/checkbox.tsx`, the `ui/select.tsx` **trigger**. shadcn
  defaults nobody chose. The select's *dropdown* keeps `shadow-md`; it floats.
* `shadow-sm` ×5 in `settings/` — two hand-rolled submit buttons, two form-input classes, and the
  active segment of the appearance toggle.

The two hand-rolled buttons were the more interesting find: each restated the house primary button
inline (`bg-brand px-5 py-2.5 … shadow-sm`) instead of using it, so they would have stayed pine while
every other primary went lilac. Both now call `buttonClasses("primary")`, which is what
`common/Button.tsx` exports that helper for. Removing `transition-shadow` / `box-shadow` from the
transition lists with them means a focus ring now appears instantly rather than fading, which is
correct for a focus ring.

## 7 · Animation & interaction

The four keyframes in `tailwind.config.ts` already read `rgb(var(--brand))`, so they follow the new
brand with no edit — that un-freezing was done 2026-08-13 for exactly this reason.

**Hover shrinks — `scale-[.98]`, active `scale-[.96]` — on buttons only.** It is the public surface's
entire motion vocabulary, and it is worth porting to buttons because it costs nothing and is
instantly recognisable. **Do not put it on table rows, sidebar items or cards**: a row that shrinks
under the cursor in a list of forty reads as a glitch. Card hover darkens its border instead, which
is what the public cards do too.

**Do not port** `pub-rise`, `pub-pointer-glow`, or the growing-underline. A pointer glow behind a data
table is decoration for its own sake (`ANTI_SLOP.md` § 1).

## 8 · Do's and Don'ts

**Do**
- Pick a **ground**, and take its whole row from § 2.2. Never mix rows
- Keep `text-brand dark:text-brand-on-dark` together as one unit
- Put **ink** on lilac, **white/cream** on pine, **amber** only on dark
- Reference tokens — `bg-brand`, `bg-primary`, `text-accent-dark`. Never a hex in a component
- Add a theme in `core/theme.py`, and nowhere else

**Don't**
- ❌ White text on `--primary`. **1.32:1** — the single easiest way to break this
- ❌ Amber as text on any light ground. **1.91:1**
- ❌ A shadow to separate two static surfaces
- ❌ `hover:bg-gray-*` anywhere on the tinted chrome — it reads as a smudge
- ❌ `border-surface-border` on the chrome — **1.02:1**, invisible
- ❌ Import `public.css` or any `pub-*` class into the back office. The firewall is the point
- ❌ Port coral or blush. Used once each; not part of the identity
- ❌ A hex in a `--brand*` variable — space-separated RGB channels only, or all 12 opacity variants
  silently render opaque

## 9 · Responsive

Unchanged — `UI_PATTERNS.md` § Responsive Contract. 360px → 2560px, `dvh` never `vh`, touch targets
≥ 36px. 28 breakpoint defects were closed to write those rules; this must not reopen one.

## 9A · Every theme gets its own pack — 2026-08-20

**A defect I introduced and the owner caught.** Warming the chrome (§ 12 step 5) set a
single cream base and mixed the brand in at only 3%, so the base dominated and *every*
preset came out at **warmth +12 to +17**: indigo, a blue-violet brand, sat on a cream
`#faf8ee`, and the two deliberately monochrome shadcn presets got a yellow ground. The
warmth is **pine's identity** — it matches the marketing site — not a universal.

### The rule: declared for pine, derived for everything else

| | ground | warmth | accent |
|---|---|---|---|
pine | `#f7f8eb` — **declared** cream | +12 | amber |
teal · indigo · azure · plum · forest | derived, cool | −7 … 0 | amber |
crimson · bronze | derived, warm | +4 … +6 | **teal** |
graphite · shadcn-black · shadcn-white | derived, neutral | −1 … 0 | **zinc** |

`ThemePreset.ground` is an identity **override**, and pine holds the only one. Every
other theme derives its chrome as a 6% wash of its own brand over white, so the
chrome is a whisper of that theme's hue.

### 🔴 Derived, not hand-picked, and the reason is `brand_color`

An administrator may set **any** custom hex. There is no preset to hand-pick a ground
or an accent for, so both must be functions of the colour or a custom theme is
half-dressed. Verified: `#7c3aed` → cool ground + amber, `#b91c1c` → warm ground +
teal, `#3f3f46` → neutral ground + zinc.

`accent_family()` picks by temperature: low saturation → **zinc**, cool hue →
**amber**, warm hue → **teal**. A warm brand gets the teal because amber beside
crimson is two warm mid-tones doing one job, and the monochrome presets get zinc
because a yellow accent defeats the one thing those presets exist for.

### ⚠️ Two reversals recorded, not deleted

* **`test_accent_is_deliberately_not_themed` is now `test_accent_travels_with_the_theme`.**
  The old assertion was right while the accent was Viho's fixed tan — a *companion*
  colour meant to sit beside any brand. It stopped being right when the accent became
  a choice made from the brand's temperature.
* **The AA lift on `text-ink-muted` was pine-specific.** The cream ground raised it
  from 4.07 to 4.51; a derived ground puts it at **4.28–4.45**, so it remains an AA
  fail on the chrome and `text-ink-label` (≥ 5.16 on every preset) stays the rule, as
  `UI_PATTERNS.md` has required since 2026-08-07. Do not quote the 4.51 as universal.

### The sequential chart ramp follows the theme; the categorical palette does not

A sequential scale **is** one hue, and the only honest hue is the theme's own — a
pine-green heatmap under a crimson theme reads as a foreign object. So
`--chart-seq-1..4` are now emitted per theme.

🐛 **Its palest step is found by contrast search, not a fixed mix level.** Levels
tuned on pine (9.50:1 white-on-brand) put **seven of eleven** presets' palest step at
**1.91–1.96:1** against a 2:1 floor, because every other brand sits near 6.4:1. Caught
only because all eleven were validated, and now asserted for all eleven in
`test_theme_presets.py`.

The **categorical** palette stays fixed across all themes on purpose: a series' colour
must mean the same thing regardless of which brand skin the reader picked, and
re-ordering it per theme would mean re-running the six checks eleven times for no gain.

## 10 · Iteration guide

Change a colour in **one** of two places, never in a component:

- **The default, for everyone** → `frontend/app/globals.css` `:root` **and** the matching preset in
  `backend/app/core/theme.py`. Both, or a themed installation and a default one diverge
- **A new selectable theme** → `THEME_PRESETS` in `core/theme.py`, gated by `validate_brand_colour`

## 11 · Two corrections to this file's first draft

Recorded rather than quietly edited, because both changed the plan.

1. **`surface.page` is dead, and the cream ground does not need a Protected file.** The first draft
   said the cream ground meant editing `tailwind.config.ts`. It does not: `UI_PATTERNS.md` records
   that `surface-page` (`#f5f7fb`) has been **unreferenced since 2026-08-07** — nothing renders it.
   The live ground is `surface-wash`, computed by `core/theme.py` as the brand at 10% over white. So
   the ground is reachable from `theme.py` alone, and the question I asked about consenting to a
   Protected-file edit was **based on a false premise**. Nothing in this spec now requires
   `tailwind.config.ts`.
2. **Amber is `--accent`, not the dark-mode brand.** The first draft implied the public palette's
   dark-ground emphasis could become `brand-on-dark`. It cannot: `brand-on-dark` is derived per
   preset and must follow the selected theme. Amber is a fixed accent — § 2.2's warning.

## 12 · Implementation order

**Steps 1–7 are implemented and verified. Step 8 is the only one outstanding.**

| # | Step | Files | Status |
|---|---|---|---|
| ✅ 1 | The `pine` preset, made default, with the Primary badge | `core/theme.py`, `globals.css`, `BrandingForm.tsx`, `lib/branding.ts`, branding `page.tsx` | **Done** |
| ✅ 2 | `--primary` → lilac, `--primary-foreground` → ink; house `primary` variant onto it, with its load-bearing border | `globals.css`, `common/Button.tsx`, `ui/button.tsx` | **Done** |
| ✅ 3 | All **11** static shadows removed (§ 6), and two hand-rolled buttons folded into `buttonClasses` | `ui/{button,checkbox,select}.tsx`, `settings/{PasswordForm,EditProfileForm,AppearanceTabs}.tsx` | **Done** |
| ✅ 4 | `--accent` tan → amber, with the pair measured against the composites it is actually used on | `globals.css` | **Done** |
| ✅ 5 | The chrome ground warmed — `#e6edec` → `#f7f8eb` | `core/theme.py`, `globals.css` | **Done** |
| ✅ 6 | The `pending` lilac status tone | `common/Badge.tsx` | **Done** |
| ✅ 7 | `hover:scale-[.98]` on buttons only | `common/Button.tsx`, `ui/button.tsx` | **Done** |
| ✅ 9 | Stat tiles onto the ink slab (§ 4.7), with dark-ground dots | `common/StatTiles.tsx`, `globals.css` | **Done** — added after the fact at the owner's request |
| ✅ 10 | The header pair onto the lilac action treatment (§ 4.9) | `common/TopNav.tsx` | **Done** |
| ✅ 11 | Dashboard audit (§ 4.10) — fixed 3 cards whose border only appeared on hover | `dashboard/{StatCard,QuickActionsCard,PartnerOverview}.tsx` | **Done** |
| ✅ 12 | The card set — `SurfaceCard` + `groundText()` + 4 specialised cards (§ 4.12) | `common/cards/*` | **Done** |
| ✅ 13 | Dashboard migrated onto it; `StatCard` and `QuickActionsCard` now dead | `dashboard/DashboardOverview.tsx` | **Done** |
| ✅ 14 | The display face shared with the public surface (§ 3) | `app/layout.tsx`, `app/(public)/layout.tsx`, `globals.css`, 5 call sites | **Done** |
| ✅ 8 | Per-user themes | [`PER_USER_THEMING_PLAN.md`](../planning/PER_USER_THEMING_PLAN.md) | **Done** — migration `c1f7a03b5e42` |

**No Protected file was touched.** `tailwind.config.ts` is untouched, as § 11 predicted once
`surface-page` turned out to be dead.

### What the warmed ground actually took

Step 5 was the one marked Medium, and the first mechanism for it was wrong. Changing only the *base*
the brand mixes over is **very nearly a no-op** — the brand tint dominates, so 10% pine over cream is
`#e4ece1` against `#e6edec` over white, a difference nobody would see. The **percentage** is what
makes a ground read warm, by letting more of the base through. At 3% over `#fffdf0`:

| | before | after |
|---|---|---|
warmth (red − blue) | **−6** (cool) | **+12** (warm) |
`text-ink-muted` on the chrome | **4.07:1 — an AA failure** `UI_PATTERNS.md` documents | **4.51:1 — passes** |
`text-ink-label` on the chrome | 4.91:1 | 5.43:1 |
white card against the ground | 1.19:1 | 1.07:1 |

So it was an accessibility **gain**, not a trade — the one AA failure on the chrome is now fixed. The
card/ground separation drops, but it was already far below 3:1 and cards have always been drawn by
their border, not by their fill. `surface-tile` and `surface-border` were deliberately left mixed over
white: they sit on white cards, which is a different job from the ground.

## 13 · Open questions for the owner

1. ~~**EB Garamond in the back office?**~~ **Decided 2026-08-20 — yes, it is in.** The owner asked for
   the two surfaces to share their type. § 3 records what it cost and the one rule it brings (weight
   400 only). My recommendation had been to leave it out; that was overruled, and the back office does
   now have headlines worth setting in it.
2. ~~**How warm should the ground go?**~~ **Answered by doing it** — 3% brand over `#fffdf0`, which is
   warm and fixes an AA failure at the same time (§ 12). Left open only as a matter of degree: the
   public page itself is `#ffffeb`, warmth +20, against the chrome's +12. Going further would mean
   re-measuring the neutrals again.
3. **Retire the `teal` preset?** *Recommendation: keep it. It costs nothing and it is the inherited
   theme's own value.*

## 14 · Pre-flight — nothing is done until every line passes

- [ ] `docker compose exec frontend npm run typecheck` clean
- [ ] `docker compose exec frontend npm run lint` clean
- [ ] ⚠️ **`npm run build` never in the dev container** — it clobbers the dev `.next` volume and every
      `_next` chunk 404s as HTML ([ADR-0013](../adr/0013-compose-is-development-only.md))
- [ ] `python -m pytest -q && ruff check .` clean
- [ ] No hex in any component; every colour resolves through a token
- [ ] Ink on lilac · white on pine · amber only on dark. **No white on `--primary`**
- [ ] Every § 2.2 row used whole — no mixed pairs
- [ ] No shadow on a static surface; every remaining shadow is on something that floats
- [ ] Light **and** dark checked on a real screen, not reasoned about
- [ ] 360px and 2560px both checked; card and table hairlines still visible on the tinted chrome
- [ ] All 11 presets still pass their own contrast report
- [ ] No `pub-*` class and no `public.css` import under `app/(app)/`
- [ ] The public site is **pixel-identical** — the firewall held

## Related

- [`../system-design/UI_PATTERNS.md`](../system-design/UI_PATTERNS.md) — **authoritative for how the back office is built**
- [`references/README.md`](references/README.md) — the same discipline, for the public surface
- [`references/ANTI_SLOP.md`](references/ANTI_SLOP.md) — § 1's ten tells apply here too
- [`VIHO_THEME_REFERENCE.md`](VIHO_THEME_REFERENCE.md) — the theme this modifies
- [`../planning/FRONTEND_PLAN.md`](../planning/FRONTEND_PLAN.md) — § 15 is the public palette's harvest and audit
- [`../planning/PER_USER_THEMING_PLAN.md`](../planning/PER_USER_THEMING_PLAN.md) — the per-user layer
