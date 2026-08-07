# UI Patterns & Design System

> **Design atoms only** — colours, typography, primitives, dark mode, custom utilities.
> For page composition and data flow read `NEXTJS_STANDARDS.md`.

---

## ✅ The design system was replaced — Viho, completed 2026-08-05

**On 2026-08-05 the owner adopted the Viho theme in full** — new brand hue, squared card surfaces,
Montserrat, and an inverted dark-mode elevation model. See
[`../design/VIHO_ADOPTION_PLAN.md`](../design/VIHO_ADOPTION_PLAN.md).

**The migration is complete.** Every route is on the Viho token system.

| Landed 2026-08-05 | Still pending |
|---|---|
| Token layer in `tailwind.config.ts` (`brand`/`accent`/`surface`/`ink`/`night`/`tone`) | 30px card padding, then re-measuring `useAutoPerPage()`'s `433` (phases 5, 7) |
| `brand` retargeted to teal `#24695c` | Soft badge variant, upload drop zone, ghost bars, stepper, in-cell sparkline (phase 8) |
| Montserrat replacing Inter, 14px body | Retiring the reference screenshots (phase 10) |
| `Button` + `Input` rebuilt on tokens | |
| **Every route migrated** — auth, dashboard, users, roles, activity, settings | |
| **All palette colour eliminated**: 0 occurrences of `#F97316`/`orange-*`/`blue-*`/pastels app-wide | |
| Squared surfaces, inverted dark elevation, `#f5f7fb` canvas | |

**The app is no longer two-tone.** Measured against the reference on 2026-08-05: light canvas
`#f5f7fb`, sidebar/header/card `#ffffff`, border `#e6edef`; dark canvas `#202938`, surfaces `#111727`,
border `#142831` — i.e. the card is *darker* than the page, which is Viho's inverted elevation.

Section-by-section status:

| Section | Status |
|---------|--------|
| § Colour System — Brand | **Updated** — `brand` is teal, with the `brand-on-dark` rule |
| § Typography | **Updated** — Montserrat |
| § Component Primitives → `Button`, `Input` | **Updated** — new radius, variants, `addon`/`trailing` |
| § Colour System — Surfaces | **Updated** — Viho surface tokens everywhere; dark elevation inverted |
| § Layout Conventions — Radius | **Updated** — surfaces `rounded-none`, controls `rounded-[5px]`, nav `rounded-[9px]` |
| § Full-Page Index Layout | ⏳ unchanged; `433` is still valid until card padding moves |

**Rewrite the relevant section as each phase lands.** A phase that ships without updating this file
puts the project back where it was on 2026-08-05 — two documents disagreeing about what the UI is.

---

## 📖 Scope of This File (Read First)

| This file | Not this file |
|-----------|---------------|
| Brand palette and colour tokens | Page structure, routing (`NEXTJS_STANDARDS.md`) |
| `Button`, `Input`, `Skeleton` contracts | Form validation logic (`NEXTJS_STANDARDS.md` § 7) |
| Dark-mode rules | API/state (`NEXTJS_STANDARDS.md`) |
| Custom CSS utilities and keyframes | Backend anything (`FASTAPI_STANDARDS.md`) |
| Typography and spacing conventions | |

**Verified stack:** Tailwind CSS **3.4.19** (not v4) · `darkMode: "class"` · **Montserrat** via
`next/font` (was Inter until 2026-08-05) · `autoprefixer` 10.5 · no component library (no shadcn/ui,
no Radix).

---

## Tech Stack Reality Check

| Assumption | Reality |
|------------|---------|
| Tailwind v4 with CSS-first config | **No.** Tailwind v3 with `tailwind.config.ts` and `@tailwind` directives |
| `@import "tailwindcss"` in CSS | **No.** `@tailwind base/components/utilities` in `app/globals.css` |
| shadcn/ui components available | **No.** Hand-rolled primitives in `components/common/` |
| OKLCH colour tokens / CSS variables for theme | **No.** Hex values and Tailwind's default grey scale |
| `cn()` / `clsx` / `tailwind-merge` helper | **No.** Template-literal class concatenation |

`@tailwindcss/postcss ^4` sits in `devDependencies` but is **not referenced** by
`postcss.config.mjs`, which uses the v3 plugin form:

```js
const config = { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

So the build is internally consistent. That v4 package is dead weight — safe to remove, **not** safe
to activate without a full v3→v4 migration.

---

## Colour System

### Brand

Defined in `tailwind.config.ts`. **Viho tokens as of 2026-08-05** — every value quoted from
`../design/VIHO_THEME_REFERENCE.md`.

| Token | Hex | Use |
|-------|-----|-----|
| `brand` | `#24695c` | Primary actions, focus rings, active states, links |
| `brand-dark` | `#17433b` | Hover on primary |
| `brand-darker` | `#10302a` | Pressed |
| `brand-on-dark` | `#5ec8b4` | **Brand text/icons on a dark surface — see the rule below** |
| `accent` | `#ba895d` | Secondary / tan accent |
| `surface-page` `-card` `-border` `-divider` `-wash` `-tile` | `#f5f7fb` `#ffffff` `#e6edef` `#efefef` `#eaf0ef` `#eff3f2` | Light surfaces. `wash` = brand@10% flattened, `tile` = brand@8% |
| `ink` `-label` `-muted` | `#242934` `#59667a` `#6b7280` | Text. `muted` is **ours** — Viho's `#999` is 2.85:1 and fails AA |
| `night-body` `-card` `-border` `-muted` | `#202938` `#111727` `#142831` `#98a6ad` | Dark surfaces. **`card` is darker than `body` on purpose** |
| `tone-success` `-danger` `-warning` `-info` `-light` `-dark` | `#1b4c43` `#d22d3d` `#e2c636` `#717171` `#e6edef` `#2c323f` | The six semantic tones, which double as Viho's categorical palette |

Usage: `bg-brand`, `text-brand`, `border-brand`, `hover:bg-brand-dark`, `focus:ring-brand`.

### 🔴 The `brand-on-dark` rule (mandatory)

**`text-brand` on a dark surface fails contrast. Always pair it with `dark:text-brand-on-dark`.**

| Combination | Ratio | AA |
|---|---:|:--:|
| `#24695c` on `night-card` `#111727` | **2.83** | ❌ |
| `#5ec8b4` on `night-card` `#111727` | **9.03** | ✅ |

`#5ec8b4` is Viho's own value — it uses it for the primary button's focus ring. This was a real bug
introduced and then fixed on 2026-08-05: the first pass at the auth screens shipped `text-brand` links
that were unreadable in dark mode. Write `text-brand dark:text-brand-on-dark` as a unit.

Two further notes on Viho's palette, adopted as-is and worth knowing so they don't read as mistakes:
**`tone-success` is a dark primary shade, not a green**, and **`tone-info` is grey, not blue.**

> **Historical note — the cost of getting here.** Before the migration, **242 occurrences across 37
> files** (151 × `#F97316`/`#EA6C0A` plus 91 × `orange-*` utilities) painted the brand colour by hand,
> and only 6 files used the `brand` token. This file previously claimed it was just `Button.tsx` and
> `Input.tsx` — an undercount of more than an order of magnitude. Two traps worth remembering if this
> ever recurs: **`orange-*` utilities are brand colour and a hex grep never sees them**, and **nine
> distinct shades were in use** where the token defined two.

**New code must use the tokens — no hardcoded hex, no palette utilities.** The regression guard is:

```bash
grep -rniE 'F97316|EA6C0A|orange-[0-9]|blue-[0-9]|purple-[0-9]|amber-[0-9]|249, *115, *22|234, *108, *10' app components
```

It returns nothing today. If it ever returns something, that is the defect.

> **The last two alternates were added 2026-08-07, because the grep had a blind spot and something
> was hiding in it.** `Sidebar.tsx` still carried the orange as `rgba(249, 115, 22, 0.2)` in an inline
> `boxShadow` — an rgba() triple is neither the hex nor an `orange-*` utility, so the guard reported
> clean for two days while the colour was on screen. Same lesson as the `orange-*` trap noted above:
> **a colour can hide in any notation you did not think to grep for.** If you add a token, add every
> spelling of it here.

### Surfaces & text

There is no semantic token layer — Tailwind's grey scale is used directly. The root layout sets the
baseline:

```
bg-white dark:bg-gray-950   text-gray-900 dark:text-gray-100
```

| Role | Light | Dark |
|------|-------|------|
| Page background | `bg-white` | `dark:bg-gray-950` |
| Raised surface / input | `bg-white` | `dark:bg-gray-800` |
| Primary text | `text-gray-900` | `dark:text-gray-100` |
| Label text | `text-gray-700` | `dark:text-gray-300` |
| Placeholder | `placeholder-gray-400` | `dark:placeholder-gray-500` |
| Border | `border-gray-300` | `dark:border-gray-700` |

### Semantic colours

| Meaning | Light | Dark |
|---------|-------|------|
| Error text | `text-red-600` / `text-red-500` | `dark:text-red-400` |
| Error surface | `bg-red-50` + `border-red-200` | `dark:bg-red-950/30` + `dark:border-red-800` |
| Error field | `border-red-400` + `bg-red-50` | `dark:border-red-700` + `dark:bg-red-950/30` |
| Success (in keyframes) | `rgba(16, 185, 129, …)` — emerald | same |

**Rule:** every colour utility needs a `dark:` counterpart unless it is genuinely identical in both
themes. A light-only colour is a bug — see § Dark Mode Rules.

---

## Typography

| Concern | Value |
|---------|-------|
| Font | **Montserrat**, loaded via `next/font/google`, `subsets: ["latin"]` — Viho's body font, adopted 2026-08-05 (was Inter) |
| CSS variable | `--font-montserrat`, wired into `theme.fontFamily.sans` |
| Fallbacks | `system-ui`, `sans-serif` |
| Applied | `font-sans` + `text-sm` on `<body>`, plus `antialiased` on `<html>` |
| Body size | **14px** (`text-sm` on `<body>`) — Viho's baseline, vs Tailwind's 16px default |

Never add a `<link>` to Google Fonts — `next/font` self-hosts and eliminates layout shift. Montserrat is
a **variable** font here, so the full 100–900 weight range costs one file.

⚠️ Montserrat is wider than Inter at the same size. **Re-check dense tables** after touching type — they
are the tightest thing we render, and `useAutoPerPage()` assumes a 38px row.

### Scale in use

| Class | Used for |
|-------|----------|
| `text-sm` | Body, labels, buttons, inputs — the default |
| `text-xs` | Field error messages, metadata |
| `font-medium` | Labels |
| `font-semibold` | Buttons, headings |

---

## Full-Page Index Layout (MANDATORY for every list page)

Ported from LeapDesk. The class combinations are load-bearing, not cosmetic — get one wrong and the
whole page scrolls instead of the table.

```
Outer      flex h-full min-h-0 flex-col
  Card         flex min-h-0 flex-1 flex-col overflow-hidden
    CardHeader   shrink-0                 (title + create button — never scrolls)
    CardContent  flex min-h-0 flex-1 flex-col
      FilterRow    shrink-0               (filters — never scrolls)
      DataTable    min-h-0 flex-1
        Cols menu    shrink-0
        top pager    shrink-0
        scroll box   flex-1 overflow-auto  ← ONLY this scrolls, maxHeight measured
          sticky thead (top-0 z-10, opaque bg)
        bottom pager shrink-0
```

`min-h-0` is what allows a flex child to shrink below its content height. Without it the table cannot
scroll internally and the page scrolls instead — the exact failure this layout prevents.

**A section using this must be listed in `FULL_HEIGHT_SECTIONS` in `DashboardClient.tsx`**, which
renders it outside the padded scrolling panel the other sections use. Two nested scroll containers
means neither behaves.

### Fixed column order

`#` → `Actions` → `Status` → data columns. `#` and `Actions` are as narrow as possible
(`w-10 text-center px-0.5` and `!px-0 w-0`) so data columns get the room.

### Other mandatory index behaviours

| Behaviour | Where |
|---|---|
| Rows-per-page adapts to viewport height | `useAutoPerPage()` — `floor((h − 433) / 38)`, clamped 5–50 |
| Search debounced 500ms | `useDebouncedValue()` |
| Reset button always visible, disabled when no filter is active | caller |
| Empty state distinguishes "no data" from "filters hid everything" | `DataTable` `filtersActive` |
| Status badge toggles on click when permitted | `Badge` with `onClick` |
| Bulk actions report what they skipped | `Toast` with `details` — never auto-dismisses |
| Table font `text-xs` / `2xl:text-sm`, cells must not override | `DataTable` |

---

## The Signed-In Chrome Is Green

Since 2026-08-07 the whole signed-in frame is `bg-surface-wash` (`#eaf0ef`) in light mode — the brand
teal at 10% over white, the same token the sign-in page uses. That covers the page canvas, the desktop
sidebar, the mobile drawer and its top bar, `TopNav`, and `Card`. Dark mode is unchanged
(`night-card` / `night-body` throughout).

**`surface-page` (`#f5f7fb`) is now unreferenced.** It was the light blue-grey canvas behind the card.
The token still exists in `tailwind.config.ts`; nothing renders it. Delete it or repurpose it, but do
not assume it is live.

Five rules follow. Get these wrong and the result looks like a bug, not a preference:

- **Popovers and menus stay `bg-white`.** There are no shadows in this design, so white-on-green is the
  only cue that something floats. `RowActions`, the column picker and every modal rely on it.
- **Hairlines on green must be `border-brand/20`, not `border-surface-border`.** `#e6edef` on
  `#eaf0ef` is **1.02:1** — not faint, *gone*. Since this design separates surfaces with borders rather
  than elevation, that erases the card, the table frame and every divider. `surface-border` is still
  correct on the white surfaces that remain.
- **`text-ink-muted` (`#6b7280`) is not safe for small text here** — 4.19:1, an AA fail. Use
  `text-ink-label` (`#59667a`, 5.05:1), as `CardHeader`'s description does. It remains fine for *icons*,
  which need only 3:1.
- **Never hover to a grey.** `hover:bg-gray-100` reads as a smudge on green. The house hover is
  `hover:bg-brand/10` with `hover:text-brand`, and its dark twin `dark:hover:bg-brand/20`.
- **Any `ring-offset-*` needs a colour.** Tailwind's offset defaults to white and will draw a halo.
  Pair `focus:ring-offset-2` with `ring-offset-surface-wash dark:ring-offset-night-card`.

Translucent brand fills gain definition for free here. `bg-brand/10` composited on white produced
exactly `#eaf0ef` — the surface colour itself — so anything using it was previously invisible against
its own background. Over green it lands darker. The table header and the Log out button both benefit.

> **The durable fix is one line, and it needs the owner's sign-off.** Retinting `surface.border` in
> `tailwind.config.ts` to a value that works on both white and green would replace the 22 hand-edited
> `border-brand/20` call sites with a single token change. `tailwind.config.ts` is a protected file, so
> it was left alone.

---

## Component Primitives

All in `components/common/`. Hand-written, no library. Keep them dumb — no data fetching, no Redux.

| Component | Purpose |
|---|---|
| `Button` | `primary` / `outline`, `loading`, `fullWidth` |
| `Input` | Required `label` (pass `""` to opt out in filter bars), `error`, `hint` |
| `Select` | Native `<select>` — keyboard and mobile support for free |
| `Badge` | 6 tones, all with dark variants. `onClick` makes it a real `<button>`, so it stays keyboard reachable |
| `Card` / `CardHeader` / `CardContent` / `FilterRow` | The viewport-locked frame above |
| `DataTable` | Sticky head, measured scroll box, dual pagination, sorting, selection, column visibility |
| `Modal` | Portalled to `body` so the dashboard's `overflow-hidden` panel can't clip it; Escape + backdrop close, scroll lock |
| `RowActions` | Three-dot menu, portalled and positioned from the trigger rect because the table clips. Actions with `visible: false` are dropped |
| `Toast` + `useToast` | Auto-dismisses in 3.5s **unless** it carries `details` |
| `Skeleton` | Loading placeholder |
| `ThemeToggle` | Light/dark switch |

### Button — `components/common/Button.tsx`

```tsx
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "outline" | "light";
  loading?: boolean;
  fullWidth?: boolean;
}
```

| Prop | Default | Behaviour |
|------|---------|-----------|
| `variant` | `"primary"` | `primary` = filled brand, no shadow; `outline` = brand border, transparent fill; `light` = Viho's `.btn-primary-light`, brand@10% fill that inverts to solid brand on hover |
| `loading` | `false` | Renders a spinner **and** sets `disabled` |
| `fullWidth` | `false` | Adds `w-full` |

Base classes (shared by all variants):

```
inline-flex items-center justify-center gap-2 rounded-[5px] px-7 py-1.5
text-sm font-semibold transition-colors
focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand
disabled:cursor-not-allowed disabled:opacity-60
```

**No shadow.** `app.css` declares a brand-tinted `box-shadow` for `.btn-primary`, and it was applied
here at first — but it does not render. Pixels directly below and beside real Viho buttons are pure
`#ffffff`. Viho separates with borders, not elevation, and there is deliberately **no `shadow-brand`
token** to reach for. See `../design/VIHO_THEME_REFERENCE.md` § Elevation → Correction 2026-08-06.

**Radius is `rounded-[5px]`, not `rounded-lg`.** Viho's system is squared *surfaces* with rounded
*controls*, so a control keeping its curve is the rule, not an exception. Padding `px-7 py-1.5`
(`.375rem 1.75rem`) comes from Bootstrap's scale, which is why it's an arbitrary value.

Rules:
- **`loading` is the only busy indicator** — never add a second boolean
- Wrap in `forwardRef` and set `displayName` (already done)
- Spread `...props` last so callers can override
- Still **no `danger` variant**. Need a destructive action? **Add one here** using `tone-danger`, don't
  write one-off red classes at the call site.

### Input — `components/common/Input.tsx`

```tsx
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;         // required
  error?: string;
  hint?: string;
  addon?: ReactNode;     // brand-tinted leading icon tile
  trailing?: ReactNode;  // in-field trailing control, e.g. a "Show" toggle
}
```

Behaviour worth knowing:

- **`label` is mandatory** — accessibility is not optional here
- **`id` is auto-derived** from the label (`"Email address"` → `email-address`) when not supplied, and
  wired to `htmlFor`
- **`error` swaps the border to `tone-danger`** and renders `text-xs text-tone-danger` below the field
- **Everything renders through one group wrapper** whether or not `addon` is passed, so a field with an
  icon and one without cannot drift apart in height, radius or focus treatment
- `addon` is Viho's `.input-group-text`: `bg-brand/10`, no outer border, icon in brand. Pass an SVG
  sized `h-4 w-4`; the tile handles centring. It is `aria-hidden` — decorative
- `trailing` sits on the input's own background. The sign-in password `Show` toggle is the reference use
- Field radius is `rounded-[5px]`, border `surface-border` — not `rounded-lg`/`border-gray-300`

⚠️ **`label=""` opts out of the visible label** (for filter bars, and for the two-up First/Last Name pair
on sign-up). When you do that you **must** pass an explicit `id` *and* an `aria-label` — otherwise the
auto-derived id is the empty string and the field has no accessible name.

**The focus ring is deliberately ours.** Viho's login stylesheet sets `:focus { box-shadow: none }` and
removes the indicator; that is exception E4 in `../design/VIHO_ADOPTION_PLAN.md` and we do not copy it.
The ring is on the *group*, so the addon tile is enclosed by it.

Usage with React Hook Form:

```tsx
<Input label="Email address" type="email" error={errors.email?.message} {...register("email")} />
```

⚠️ Auto-derived IDs collide if two inputs share a label on one page. Pass an explicit `id` then.

### Skeleton

`components/common/Skeleton.tsx` (generic)
(shape-specific). Use for initial loads. A skeleton must **match the final layout's dimensions** —
otherwise it trades a spinner for layout shift.

### ThemeToggle

`components/common/ThemeToggle.tsx`, backed by `lib/hooks/useTheme.ts`. Place it in a nav/header;
there should be exactly one per page.

---

## Sidebar Anatomy

Matched to `dashboard-default-light-top.png` / `dashboard-default-dark.png` on 2026-08-06.

| Region | Treatment |
|--------|-----------|
| Surface | `bg-surface-wash` (`#eaf0ef`) / `dark:bg-night-card`, right border, **no shadow**. Green since 2026-08-07 — see § The Signed-In Chrome Is Green |
| Logo row | Brand tile + wordmark, collapse toggle on the right |
| **Section heading** | `text-[17px] font-semibold text-brand`, **sentence case**, hairline rule beneath. **Not** a 10px uppercase micro-label, and **not** clickable |
| Nav item | **Bare outline icon** (never in a tinted tile) + bold label, `rounded-[10px]` |
| Nav item — active | Solid `bg-brand`, white text and icon, **no shadow** |
| Nav item — hover | `bg-brand/10` + `text-brand` |
| Nav item — expandable | Chevron on the right, rotating 90° when open |

**No profile block, and no sign-out.** Viho's sidebar carries a user card (avatar, name, department,
a three-up `Follow`/`Experience`/`Follower` row); one was built and then **removed on the owner's
instruction** — the identity already lives in the header's account menu, and the three stats had no
real source. Sign-out moved to the header for the same reason. **The mobile drawer keeps its sign-out**,
because `TopNav` is `hidden md:flex` and dropping it there would leave phone users unable to log out.

**Chevrons belong to nav items, not section headings.** Sections are inert labels whose items are
always visible. A collapsible heading is indistinguishable from a static one at this type size, and it
hid a whole group behind a chevron on first load.

---

## Header Anatomy

Matched to `dashboard-default-light-top.png`. Left to right: a **bare search** (magnifier +
placeholder, no border and no fill), then the action cluster, then a tinted `Log out`.

| Control | State |
|---------|-------|
| Fullscreen | **Real** — Fullscreen API |
| Dark mode | **Real** — the `useTheme` cycle |
| Avatar badge | Ours, not Viho's. **Initials only** — a `Link` straight to `/settings/profile`, no name, no email, no dropdown |
| `Log out` | **Real.** `bg-brand/10` + brand text + brand icon — Viho's `.btn-primary-light` |

**Order matters: `Log out` is last, hard against the corner**, with the avatar badge to its left.
That is where the theme puts it.

**The badge is initials only.** The name and role beside it, and the email inside a dropdown, were all
removed — the badge already identifies you, and repeating the name in the chrome of every page earns
nothing. The full name survives as `aria-label` and `title`, so screen-reader and hover users still get
it. With `Log out` promoted to its own button the dropdown held a single item, so it went too: **a menu
that opens to reveal one choice is ceremony**, and a direct link is better.

### 🔴 Only render a control that does something

Viho's row also has search, language, bookmarks, notifications and messages. All five were built,
greyed out and `aria-disabled` — and then **removed on the owner's instruction**, which was right. A
permanently dead control is not a placeholder, it is noise that teaches people to ignore that corner of
the screen, and greying it out advertises the absence rather than hiding it.

**Add each one back here, live, when its feature lands.** The full row is recorded in
`../design/VIHO_THEME_REFERENCE.md` § Dashboard Shell so nothing is lost. Viho's bell also carries a red
unread dot; it stays unimplemented for the same reason — a badge that can never clear is worse than no
badge.

---

## Dark Mode Rules (Mandatory)

Dark mode is **class-based** (`darkMode: "class"` in `tailwind.config.ts`) — the `dark` class is
toggled on `<html>`.

### How it works

Three pieces must agree:

1. **The anti-FOUC script** in `app/layout.tsx` `<head>` — runs before React paints:
   ```js
   var t = localStorage.getItem('theme');
   var d = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
   if ((t || d) === 'dark') document.documentElement.classList.add('dark');
   ```
2. **`suppressHydrationWarning`** on `<html>` — the script mutates `class` pre-hydration, so
   server/client markup legitimately differs
3. **`useTheme()`** — reads `localStorage`, falls back to the OS preference, writes both
   `localStorage` and the DOM class on toggle

**Do not remove any of the three.** Removing the script reintroduces the white flash; removing
`suppressHydrationWarning` produces console errors on every load.

### Rules

1. **Every colour utility needs a `dark:` variant.** `bg-white` alone is a bug.
2. **Never use `bg-white` for a surface inside a dark-capable page** — use
   `bg-white dark:bg-gray-800`.
3. **Test both themes before calling a component done.** Toggle it, don't assume.
4. **Tinted dark surfaces use an alpha suffix** — `dark:bg-red-950/30`, not a solid `dark:bg-red-950`.
5. **Borders need dark variants too** — a light border on a dark surface is the most common miss.
6. **Never read `theme` to branch markup.** Use `dark:` utilities so there's no hydration mismatch.

---

## Custom Utilities — `app/globals.css`

Defined in `@layer utilities`. Prefer these over reinventing them.

| Utility | Effect |
|---------|--------|
| `.texture-bg` | CSS-only dot-grid background via `radial-gradient`. Zero JS, zero image requests. Driven by `--texture-dot` / `--texture-size`. |
| `.scrollbar-hide` | Hides the scrollbar, keeps scrolling (Firefox + WebKit + IE) |
| `.scrollbar-thin` | 6px scrollbar, translucent grey thumb, darker on hover, transparent track |
| `.scroll-smooth` | `scroll-behavior: smooth` |

### Texture variables

```css
:root  { --texture-dot: rgba(0, 0, 0, 0.055); --texture-size: 20px; }
.dark  { --texture-dot: rgba(255, 255, 255, 0.04); }
```

The texture is **theme-aware through the variable**, so `.texture-bg` needs no `dark:` variant. This
is the one place a CSS variable carries theme state — follow the pattern if you add another texture.

---

## Animation

Custom keyframes in `tailwind.config.ts`:

| Class | Duration | Use |
|-------|----------|-----|
| `animate-pulse-glow` | 2s infinite | Emerald expanding glow — active/live status |
| `animate-pulse-ring` | 2s infinite | Brand-orange expanding ring — attention on a control |
| `animate-bounce-slow` | 2s infinite | Gentle 4px vertical bounce (subtler than Tailwind's `animate-bounce`) |
| `animate-shimmer` | 2s infinite | Horizontal background sweep — skeleton loading |

Rules:
- **Reuse these four** before defining a fifth
- Loading shimmer → `animate-shimmer`; status dot → `animate-pulse-glow`
- Don't animate `width`/`height`/`top`/`left` — stick to `transform`, `opacity`, `box-shadow`
- Keep infinite animations subtle; they run forever on screen

---

## Focus & Accessibility

Already established — hold the line:

| Concern | Pattern |
|---------|---------|
| Button focus | `focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand` |
| Input focus | `focus:border-brand focus:ring-2 focus:ring-brand/20` |
| Labels | `Input` requires `label` and wires `htmlFor` ↔ `id` |
| Error announcement | Server-error banners use `role="alert"` |
| Disabled state | `disabled:cursor-not-allowed disabled:opacity-60` |
| Language | `<html lang="en">` |

Rules:
- **Never `outline-none` without a replacement ring.** Removing the focus indicator breaks keyboard use.
- **Every input needs a real label** — a placeholder is not a label.
- **Error text must be adjacent to its field**, not only in a page-level banner.
- Colour alone must never carry meaning — pair red with text.

---

## Layout Conventions

| Concern | Pattern |
|---------|---------|
| Page frame | `<body className="min-h-full flex flex-col …">` — column flex, full height |
| Form spacing | `flex flex-col gap-5` |
| Field internals | `flex flex-col gap-1` (label / control / error) |
| Radius | `rounded-lg` everywhere — don't mix radii |
| Control padding | Buttons `px-5 py-2.5`; inputs `px-3.5 py-2.5` |
| Theme transition | `transition-colors duration-200` on `<body>` |

**Use `gap-*` on a flex/grid parent, not margins on children.** Consistent and no collapse surprises.

---

## New Component Checklist

- [ ] Does a `components/common/` primitive already do this? Extend it rather than fork it
- [ ] `"use client"` only if it needs hooks, events, or browser APIs
- [ ] Brand colour via the `brand` token — no new hardcoded hex
- [ ] Every colour has a `dark:` counterpart
- [ ] Verified visually in **both** themes
- [ ] Focus ring present and visible on keyboard navigation
- [ ] Labels wired to controls; errors adjacent
- [ ] `rounded-lg`; spacing via `gap-*`
- [ ] Extends the native props interface if it wraps a DOM element
- [ ] `forwardRef` + `displayName` if a parent may need the ref
- [ ] Lives in `app/**` or `components/**` so Tailwind actually scans it

---

## Known Issues

| Issue | Detail |
|-------|--------|
| ~~Hardcoded brand colour~~ | ✅ **Resolved 2026-08-05.** All 242 occurrences across 37 files migrated to tokens. Guard with `grep -rn 'F97316\|EA6C0A\|orange-[0-9]' app components` — it must stay empty |
| ~~App is visibly two-tone~~ | ✅ **Resolved 2026-08-05** by completing the migration |
| No privacy-policy route | Sign-up's required "Agree With Privacy Policy" renders "Privacy Policy" as **plain text, not a link**, because the page does not exist. Make it a `<Link>` when it does |
| Mixed radii | § Layout Conventions mandates `rounded-lg` and says "don't mix radii"; the code uses five — `rounded-lg` ×92, `rounded-xl` ×49, `rounded-full` ×31, `rounded-2xl` ×23, `rounded-md` ×7 |
| No semantic colour tokens | Grey scale used directly; a rebrand means touching every component |
| No `cn()` helper | Class strings are template literals; conditional classes get unwieldy. A 3-line `cn()` would help |
| Only two Button variants | No `danger` variant, so destructive actions have nowhere consistent to live |
| `Skeleton` is generic | Most pages have no matching skeleton shape |
| `@tailwindcss/postcss ^4` unused | Dead dependency — see § Tech Stack Reality Check |
| No focus-visible distinction | `focus:` fires on mouse click too; `focus-visible:` would be tidier |

---

## Related Documentation

- [`NEXTJS_STANDARDS.md`](./NEXTJS_STANDARDS.md) — page composition, forms, state
- [`../core/ARCHITECTURE.md`](../core/ARCHITECTURE.md) — frontend architecture overview

---

## Pending

> **Design-system work still outstanding.** Last audited **2026-08-06**. The Viho migration is complete
> and § *Known Issues* is accurate — unusually, this file is the least stale of the standards docs. What
> remains is mostly consistency debt the migration exposed rather than created.

### 🟠 Rules this file mandates that the code does not follow

- [ ] **Mixed radii — § *Layout Conventions* says "don't mix radii" and the code uses five.**
      `rounded-lg` ×92, `rounded-xl` ×49, `rounded-full` ×31, `rounded-2xl` ×23, `rounded-md` ×7. Either
      the rule is wrong or the code is; **a mandatory rule with 110 violations is not a rule.** Decide
      which, then either fix the outliers or rewrite the rule to describe the intended ladder (there
      probably *is* one — `rounded-full` for avatars and pills, `rounded-xl`/`2xl` for cards, `rounded-lg`
      for controls — in which case write that down and keep the guard).
- [ ] **No semantic colour tokens.** The grey scale is used directly, so the next rebrand touches every
      component again. The Viho migration is the proof: 242 occurrences across 37 files had to move
      because the brand colour was written at the call site. **The same exposure still exists for
      surfaces and text** — it was only the brand hue that got a token layer.
- [ ] **`brand-on-dark` is marked 🔴 mandatory and has no automated guard.** The brand-hex regression
      guard exists (`grep -rn 'F97316\|EA6C0A\|orange-[0-9]' app components` must stay empty) — add the
      equivalent for this rule, or it will be violated silently by the next component.

### 🟡 Primitives that are missing and get improvised

- [ ] **Only two Button variants — no `danger`.** Destructive actions have nowhere consistent to live, so
      each one invents its own red. This matters more now than when it was written: the app has
      delete, bulk-delete, suspend, revoke-session and reset-2FA actions.
- [ ] **No `cn()` helper.** Class strings are template literals; conditional classes get unwieldy. Three
      lines. Also tracked in [`NEXTJS_STANDARDS.md`](./NEXTJS_STANDARDS.md).
- [ ] **`Skeleton` is generic and most pages have no matching shape.** Worth pairing with PM-41 rather
      than doing alone — today `loading.tsx` barely renders because every page fetches client-side, so a
      shaped skeleton has almost nowhere to appear. **Do the data layer first, then the skeletons have a
      job.**
- [ ] **No `focus-visible` distinction.** `focus:` fires on mouse click too. A tidy-up, but it is the
      difference between a keyboard user seeing a ring where they need it and every user seeing one where
      they do not.
- [ ] **No toast/confirm convention for destructive actions.** `Toast.tsx` and `Modal.tsx` exist; nothing
      in this file says which destructive actions must confirm, or what the copy should be. Improvised
      per screen today.

### 🟡 Product gaps that surface as UI defects

- [ ] **No privacy-policy route.** Sign-up's required *"Agree With Privacy Policy"* renders "Privacy
      Policy" as **plain text, not a link**, because the page does not exist. Asking a user to agree to a
      document they cannot read is the kind of thing that only looks fine until someone asks.
      Make it a `<Link>` when it exists.
- [ ] **`GET /api/v1/activity/export` has no UI.** The endpoint streams CSV and is gated on `activity-view`;
      there is no button. When adding one, pass `LONG_TIMEOUT_MS` from `lib/api/axiosInstance.ts` — the
      5s default kills a working export, and the failure will look like a server error.
- [ ] **2FA enrolment UI needs an end-to-end pass.** `TwoFactorSettings.tsx` and
      `TwoFactorChallenge.tsx` exist; confirm the whole path renders and recovers — enrol → QR → confirm →
      recovery codes → challenge → recover. **This is the screen where a missing state locks a real user
      out of their account.**

### 🟡 Verification the design system has never had

- [ ] **No component renders have been checked in a browser since the Viho migration completed.** The
      register is explicit that error boundaries were verified via the build manifest and **not** rendered
      (PM-19), and that proving a fallback's appearance needs the Chrome-DevTools-Protocol harness. The
      same gap applies to dark mode across all 76 components — § *Dark Mode Rules* is mandatory and
      unenforced.
- [ ] **No accessibility audit.** § *Focus & Accessibility* sets rules; nothing measures contrast,
      keyboard traps in `Modal`, or whether `DataTable` is navigable. The teal-on-dark combinations from
      the rebrand are exactly where a contrast regression would hide.
- [ ] **PM-22 — remove `@tailwindcss/postcss ^4`.** Dead dependency. Safe to remove; **not** safe to
      activate without a full v3→v4 migration.
