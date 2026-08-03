# UI Patterns & Design System

> **Design atoms only** — colours, typography, primitives, dark mode, custom utilities.
> For page composition and data flow read `NEXTJS_STANDARDS.md`.

---

## 📖 Scope of This File (Read First)

| This file | Not this file |
|-----------|---------------|
| Brand palette and colour tokens | Page structure, routing (`NEXTJS_STANDARDS.md`) |
| `Button`, `Input`, `Skeleton` contracts | Form validation logic (`NEXTJS_STANDARDS.md` § 7) |
| Dark-mode rules | API/state (`NEXTJS_STANDARDS.md`) |
| Custom CSS utilities and keyframes | Backend anything (`FASTAPI_STANDARDS.md`) |
| Typography and spacing conventions | |

**Verified stack:** Tailwind CSS **3.4.19** (not v4) · `darkMode: "class"` · Inter via `next/font` ·
`autoprefixer` 10.5 · no component library (no shadcn/ui, no Radix).

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

Defined in `tailwind.config.ts`:

| Token | Hex | Use |
|-------|-----|-----|
| `brand` / `brand-DEFAULT` | `#F97316` (orange-500) | Primary actions, focus rings, active states |
| `brand-dark` | `#EA6C0A` | Hover on primary |

Usage: `bg-brand`, `text-brand`, `border-brand`, `hover:bg-brand-dark`, `focus:ring-brand`.

⚠️ **Existing components hardcode the hex** — `Button.tsx` and `Input.tsx` write `bg-[#F97316]` and
`focus:border-[#F97316]` instead of using the token. **New code must use `brand`.** When you touch
those files, migrate them; don't add more hardcoded hex.

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
| Font | **Inter**, loaded via `next/font/google`, `subsets: ["latin"]` |
| CSS variable | `--font-inter`, wired into `theme.fontFamily.sans` |
| Fallbacks | `system-ui`, `sans-serif` |
| Applied | `font-sans` on `<body>`, plus `antialiased` on `<html>` |

Never add a `<link>` to Google Fonts — `next/font` self-hosts and eliminates layout shift.

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
  variant?: "primary" | "outline";
  loading?: boolean;
  fullWidth?: boolean;
}
```

| Prop | Default | Behaviour |
|------|---------|-----------|
| `variant` | `"primary"` | `primary` = filled brand; `outline` = brand border + transparent fill |
| `loading` | `false` | Renders a spinner **and** sets `disabled` |
| `fullWidth` | `false` | Adds `w-full` |

Base classes (shared by both variants):

```
inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5
text-sm font-semibold transition-colors
focus:outline-none focus:ring-2 focus:ring-offset-2
disabled:cursor-not-allowed disabled:opacity-60
```

Rules:
- **`loading` is the only busy indicator** — never add a second boolean
- Wrap in `forwardRef` and set `displayName` (already done)
- Spread `...props` last so callers can override
- Only two variants exist. Need a destructive action? **Add a `danger` variant here**, don't write
  one-off red classes at the call site.

### Input — `components/common/Input.tsx`

```tsx
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;      // required
  error?: string;
}
```

Behaviour worth knowing:

- **`label` is mandatory** — accessibility is not optional here
- **`id` is auto-derived** from the label (`"Email address"` → `email-address`) when not supplied, and
  wired to `htmlFor`
- **`error` swaps the border and background to the red variant** and renders `text-xs text-red-500`
  below the field
- Wraps in `flex flex-col gap-1`

Usage with React Hook Form:

```tsx
<Input label="Email address" type="email" error={errors.email?.message} {...register("email")} />
```

⚠️ Auto-derived IDs collide if two inputs share a label on one page. Pass an explicit `id` then.

### Skeleton

`components/common/Skeleton.tsx` (generic) and `components/dashboard/TestCardSkeleton.tsx`
(shape-specific). Use for initial loads. A skeleton must **match the final layout's dimensions** —
otherwise it trades a spinner for layout shift.

### ThemeToggle

`components/common/ThemeToggle.tsx`, backed by `lib/hooks/useTheme.ts`. Place it in a nav/header;
there should be exactly one per page.

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
| Hardcoded `#F97316` | `Button.tsx`, `Input.tsx` bypass the `brand` token |
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
