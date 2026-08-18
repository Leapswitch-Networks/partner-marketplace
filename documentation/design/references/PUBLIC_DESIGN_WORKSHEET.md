# Public site `DESIGN.md` — worksheet

**Started 2026-08-18. Not yet a `DESIGN.md` — this is the thing you fill in to get one.**

> ## ✅ Unblocked 2026-08-18 — § A is answered
>
> The owner named [wisprflow.ai](https://wisprflow.ai/) as the visual reference, approved the harvest
> in [`FRONTEND_PLAN.md` § 15](../../planning/FRONTEND_PLAN.md), and settled all four of § 15.8's
> collisions. **Sections A, 1, 2, 3 and 6 of this worksheet are now decided.** The four still open —
> 4, 5, 9 and 10 — are component anatomy, layout, breakpoint behaviour and the iteration guide.
>
> **The decision with the longest tail: no dark mode on the public surface.** It holds only while
> § 15.8 ①'s four reversibility conditions are obeyed. The load-bearing one is repeated in § 2 below
> because it is the one an implementer will otherwise break on day one.

Follows the ten sections in [`DESIGN_MD.md`](./DESIGN_MD.md) § 2. Sections marked ✅ are **measured
from the code** and are not up for debate. Sections marked 🟠 are **aesthetic decisions the owner has
not made**, each with options and a recommendation.

> **Why it is split this way.** Roughly two-thirds of a `DESIGN.md` for this project is already
> decided — tokens, fonts, breakpoints, accessibility floors, the performance budget. Writing those
> out is transcription. The remaining third is taste, and an agent inventing it is exactly the
> failure [`ANTI_SLOP.md`](./ANTI_SLOP.md) exists to prevent. **So it is left blank on purpose.**

**Scope: `app/(public)/` only.** The signed-in surface is governed by
[`../../system-design/UI_PATTERNS.md`](../../system-design/UI_PATTERNS.md) and nothing here touches it.

---

## A · The decision everything else waits on 🟠

> **What should a stranger feel in the first three seconds?**

`FRONTEND_PLAN.md` § 1 sets the job: a buyer who has never heard of Leapswitch forms their whole
opinion here, and § 9 says the differentiator is **trust**, not selection — we will have a dozen
partners, not five crore (§ 13.1). So the register is somewhere in the band between *"a serious
infrastructure company vouches for these people"* and *"a friendly place to find a supplier"*.

| Option | Reads as | Costs | Risk |
|---|---|---|---|
| **A1 · Institutional restraint** *(recommended)* | An audit report you can trust. Type-led, generous whitespace, borders not shadows, colour used sparingly and meaningfully | Nothing — it is what the existing tokens already do well | Can tip into austere if the copy is not warm |
| **A2 · Warm directory** | Approachable, card-led, photography and colour carrying the page | A photography source we do not have, and 20.2's one-image budget | Looks like every other marketplace, and § 12 says we lose that comparison |
| **A3 · Technical/developer** | Mono accents, dense, dark-first | Cheap to build, we already have dark mode | Wrong audience — the buyer is a business, not a developer |

✅ **Decided 2026-08-18 — A1, executed warm.** Wispr Flow *is* A1 in warm colours: cream instead of
white, one serif for display, 2px borders instead of shadows, hover states that shrink rather than
glow. § 15 supplies the palette.

**The four sub-decisions, answered:**

- ✅ **Tone:** *"warm and certain — NOT playful, and NOT corporate-neutral."* The cream ground and the
  serif carry the warmth; the near-black borders and the flat fills carry the certainty
- ✅ **The one deliberate constraint:** **borders, never shadows.** 2px and 4px, never 1px. It is true
  of the reference, true of our existing token set, and free
- ✅ **Light-first — and light-only.** The public surface ships no dark mode (§ 15.8 ①)
- ✅ **No photography** for launch. The reference barely uses any, and we have no source

**Decide these four with it:**

- [ ] **Tone in one contrast line** — `"____ and ____ — NOT ____"`
- [ ] **The one deliberate constraint** held site-wide ([`ANTI_SLOP.md`](./ANTI_SLOP.md) § 2②).
      Recommended: **borders, never shadows** — it is already true of the token set
- [ ] **Light-first or dark-first?** The app is light-first with a dark mode. Recommended: match it
- [ ] **Photography: yes or no?** Recommended **no** for launch. We have no source, and stock imagery
      is the fastest way to look like a template

---

## 1 · Visual theme & atmosphere

| Field | Value |
|---|---|
| Style | 🟠 from § A |
| Keywords (5–8) | 🟠 |
| Tone | 🟠 stated as a contrast |
| Feel (one metaphor) | 🟠 |
| Style | ✅ **Institutional restraint, executed warm** (§ A) |
| Keywords | ✅ warm · certain · quiet · bordered · flat · unhurried · serif-led |
| Tone | ✅ *"warm and certain — NOT playful, and NOT corporate-neutral"* |
| Feel | ✅ A well-set printed page, not an app screen |
| **Interaction tier** | ✅ **L1 — CSS only.** Not a preference: < 150 kB first-load JS per public route |
| **Dependencies** | ✅ **None.** No GSAP, no Lenis, no scroll library |
| **Motion vocabulary** | ✅ From the reference: hover **shrinks** (`transform: scale(.98)`), it does not lift, glow or recolour |

---

## 2 · Colour palette & roles ✅ **decided** — the public surface

Adopted 2026-08-18. Values are Wispr Flow's exactly; **names are ours** (§ 15.8 ④). The full harvest —
alpha ramps, all nine button variants, four card treatments, nav, footer, contrast audit — is
[`FRONTEND_PLAN.md` § 15](../../planning/FRONTEND_PLAN.md); this is the working set.

| Token | Value | Role |
|---|---|---|
| `public.bg` | `#ffffeb` | **Page background — warm cream, not white** |
| `public.bg-alt` | `#e4e4d0` | Borders on cream · secondary button fill |
| `public.ink` | `#1a1a1a` | Body text · borders · dark section and card fill |
| `public.deep` | `#034f46` | Premium section fill · **every link hover** |
| `public.lilac` | `#f0d7ff` | **Primary button fill** |
| `public.amber` | `#ffa946` | Accent · footer link hover **on dark only** |
| `public.coral` | `#ff6c4c` | Accent, display sizes only |
| `public.blush` | `#ffbcf2` | Rare accent |
| `public.wine` | `#7f1c34` | Error text |
| `public.focus` | `#2d62ff` | Focus ring |

**Rules — the first is load-bearing, the rest are from the contrast audit**

1. 🔴 **Reference the token, never the hex.** `bg-public-bg`, not `bg-[#ffffeb]`. **This is what keeps
   "no dark mode for now" a ten-value change later instead of the file sweep § 11 exists to prevent**
2. 🔴 **Never write a `dark:` variant on a public component.** A half-built dark mode reads as a bug
3. The `(public)` layout declares `color-scheme: light` and never receives the `dark` class — without
   it, a dark-mode browser restyles the enquiry form's inputs and nothing in our code did it
4. **`coral` and `amber` are never text on cream** — 2.77:1 and 1.88:1, both fail AA outright
5. **`#e4e4d0` borders are decorative.** Anything conveying state needs 3:1 — use `ink` at an alpha step
6. Tints come from the two alpha ramps in § 15.2. **Never improvise a grey**

> The signed-in palette is unchanged and still governed by
> [`../../system-design/UI_PATTERNS.md`](../../system-design/UI_PATTERNS.md) — brand tokens, the
> `brand-on-dark` rule, and dark mode all still apply there.


Defaults from `app/globals.css`; the Tailwind names from `tailwind.config.ts`. **These are runtime
CSS variables** — eight brand presets ship, and `backend/app/core/theme.py` is the only place a new
one may be added.

| Role | Token | Default | Note |
|---|---|---|---|
| Brand | `brand` | `#24695c` | Viho `--theme-deafult` *(their typo; ours is spelled correctly)* |
| Brand hover | `brand-dark` | `#17433b` | |
| Brand pressed | `brand-darker` | `#10302a` | |
| **Brand on dark** | `brand-on-dark` | `#5ec8b4` | 🔴 **Mandatory.** Base brand on `night.card` is **2.83:1** and fails AA; this is ~8.8:1 |
| Accent | `accent` | `#ba895d` | Viho `--theme-secondary` |
| Page | `surface.page` | `#f5f7fb` | |
| Card | `surface.card` | `#ffffff` | |
| Border | `surface.border` | `#e6edef` | Brand at 11% over white — theme-derived, not frozen |
| Text | `ink` | `#242934` | |
| Text secondary | `ink.label` | `#59667a` | |
| Text tertiary | `ink.muted` | `#6b7280` | **Ours, deliberately** — Viho's `#999999` is 2.85:1 and fails AA |
| Dark page | `night.body` | `#202938` | Lighter than the dark card, inverted on purpose |
| Dark card | `night.card` | `#111727` | |
| Success | `tone.success` | brand-derived | Follows the active brand — owner's decision 2026-08-13 |
| Danger | `tone.danger` | `#d22d3d` | |
| Warning | `tone.warning` | `#e2c636` | |

**Rules**

1. ⚠️ **Channels are space-separated RGB (`36 105 92`), never hex.** Twelve opacity variants are in
   use (`bg-brand/[.04]` → `bg-brand/70`); a hex silently renders every one opaque
2. No hard-coded hex in a component — everything through a token
3. `text-brand` and `dark:text-brand-on-dark` are **written as a unit**, always
4. 🟠 **Open:** how much accent (`#ba895d`) the public surface uses. It is nearly unused in the app

---

## 3 · Typography ✅

| Role | Font | Size | Weight | Notes |
|---|---|---|---|---|
| Body | Montserrat | **14px** (`text-sm`) | 400 | Viho baseline, not Tailwind's 16px |
| Label | Montserrat | 14px | 500 | |
| Metadata / errors | Montserrat | 12px (`text-xs`) | 400 | |
| Buttons, headings | Montserrat | — | 600 | |
| **Public H1** | **EB Garamond 400** | 6rem → 3.5rem | 400 | `letter-spacing:-.05em` · `line-height:.85` |
| **Public H2** | **EB Garamond 400** | 4rem → 2.5rem | 400 | `letter-spacing:-.03em` · `line-height:.95` |
| **Public H3** | **EB Garamond 400** | 3rem → 2rem | 400 | `line-height:1.1` |
| **Public H4** | **EB Garamond 400** | 2rem → 1.5rem | 400 | `letter-spacing:-.03em` · `line-height:1.3` |

- ✅ **Montserrat only.** Variable font, 100–900, one file, via `next/font/google`, `subsets: ["latin"]`
- ✅ Fallbacks `system-ui`, `sans-serif`
- ✅ **NEVER** add a Google Fonts `<link>` — `next/font` self-hosts and removes the layout shift
- ✅ **NEVER** a second family — it is in the performance budget
- ⚠️ Montserrat is wider than Inter at the same size
- ✅ **Decided 2026-08-18 — one display face, EB Garamond, public headings only** (§ 15.8 ②). The
  "no second family" rule is amended to *"one display face on the public surface, Montserrat
  everywhere else"*. **Figtree is not adopted** — body stays Montserrat
- ⚠️ **Load it in the `(public)` layout, never the root layout**, or the signed-in app pays for a font
  it never renders. `next/font/google`, `subsets: ["latin"]`, **weight 400 only**, `display: "swap"`
- **A light serif at 96px with negative tracking is the look.** Keeping a 600-weight sans for headings
  and taking only the colours produces a lavender admin panel — § 15.5

---

## 4 · Components

Public components only — `components/public/`, **never** `components/common/`.

| Component | Status | Note |
|---|---|---|
| `PublicHeader` · `PublicFooter` | 🟠 | Marketing chrome. **Not** the signed-in green chrome. Header carries a permanent `/become-a-partner` CTA (`FRONTEND_PLAN.md` § 14.3) |
| `SearchBar` | 🟠 | Client. Navigates, does not fetch. Above the fold, primary action |
| `PartnerCard` | 🟠 | **The one that carries the launch.** Fixed height — a ragged grid reads as broken |
| `VerificationBadge` | 🟠 | **The trust signal — one component, one meaning.** Tooltip states the **criteria**, not the level's name (§ 14.6) |
| `EnquiryForm` | 🟠 | Client, RHF + Zod. A component, never a route |
| `EmptyState` | 🟠 | **The launch condition, not an edge case** — zero partners today |
| `Breadcrumb` | 🟠 | Emits `BreadcrumbList` JSON-LD |
| `ListingCard` | ⏸ | Blocked — `service_listings` does not exist |
| `FacetGroup` · `Pagination` | ⏸ | **Deferred to Band 2** — § 13.3 |

✅ Every one states all five states: default · hover · active · focus · disabled.
⚠️ `UI_PATTERNS.md` says "no Radix" — **stale.** Four `@radix-ui/*` packages are installed
(checkbox, dropdown-menu, select, slot), plus shadcn semantic aliases in `tailwind.config.ts`.
Decide per component whether to reuse them; do not assume zero primitives exist.

---

## 5 · Layout 🟠 — still open

Container width, section padding and the spacing scale are all open. The admin app's numbers do not
transfer — it caps page forms at `max-w-4xl` and show pages at `max-w-6xl`, both for dense data, and a
marketing page is neither.

---

## 6 · Depth & elevation ✅ **decided** — with one measured warning

⚠️ `tailwind.config.ts` ships **no** `boxShadow.brand` token, on purpose: Viho separates surfaces with
**borders**, and the pixels under a real Viho button are pure `#ffffff`. A public surface that leans
on shadows is choosing to look different from the signed-in app. **Allowed — but chosen out loud.**

✅ **Decided 2026-08-18 — flat + border, no elevation at all.** The reference agrees with our token
set: 2px and 4px borders, flat fills, and essentially no shadow. Hover **shrinks** rather than lifts.

The one shadow in the reference worth knowing about is not a blur — `box-shadow: 0 2px 0 0 <ink>`, a
hard 2px offset. Available if a component needs an edge; **not** a general elevation scale.

---

## 7 · Animation ✅ mostly

- ✅ Tier **L1**, CSS only
- ✅ Existing keyframes available: `pulse-glow`, `pulse-ring`, `bounce-slow`, `shimmer` — the first two
  read the **live** brand variable rather than a frozen rgba, which is the bug shape not to repeat
- ✅ `prefers-reduced-motion` block regardless of tier
- ✅ Hover **and focus** on every interactive element — focus is the state that gets skipped
- 🟠 Open: entrance animation, or none. **Recommended: none.** Fade-up-on-scroll is
  [`ANTI_SLOP.md`](./ANTI_SLOP.md) § 1's third tell

---

## 8 · Do's and Don'ts — half-written already

Do not restate them here. The don'ts exist as *Must NOT have* lines under every page in
`PARTNER_DIRECTORY_PLAN.md` § 20.4, and [`ANTI_SLOP.md`](./ANTI_SLOP.md) § 1 lists the generic ones.
**Assembling those two into one section is a mechanical task and belongs in the final file.**

The five that must survive assembly, because each is a rule rather than a preference:

- ❌ Never a number we cannot back — and **no inventory count at all until Band 2**
- ❌ Never a rating, review count or response time before the data exists. **Omit the block, never zero it**
- ❌ Never `components/common/` on a public page — that folder is the admin shell's
- ❌ Never a partner's `notes`, `gst_number`, `pan_number` or `status` in public output
- ❌ Never an unlabelled sponsored placement, and never a featured slot outranking a verification failure

---

## 9 · Responsive ✅

Inherited whole from `UI_PATTERNS.md` § Responsive Contract — thirteen rules, each closing a measured
defect from the 2026-08-13 audit. The load-bearing ones:

- 360px → 2560px
- `dvh`, never `vh`/`h-screen`; JS measures `visualViewport.height`, never `innerHeight`
- Touch targets ≥ 36px below `sm`
- Grids give a single-column base — `grid gap-* sm:grid-cols-2`, never a bare `grid-cols-2`
- Fixed surfaces clamp to the viewport
- User-supplied text rows: `min-w-0` + `truncate` on the text, `shrink-0` on the controls beside it

🟠 Open: the public breakpoint *layout* changes — what the header collapses to, when the card grid
goes 3 → 2 → 1.

---

## 10 · Iteration guide 🟠

Write last. What to do when a page needs something the system does not cover — and what may never be
added without a decision (a second font, a shadow scale, a motion library, a new brand colour).

---

## What happens next

1. ✅ ~~Owner answers § A~~ — **done 2026-08-18.** A1 executed warm, light-only, borders not shadows
2. **Fill the four sections still open: 4 (component anatomy), 5 (layout), 9 (breakpoint behaviour),
   10 (iteration guide).** These need no further decisions from the owner — they are derivable from
   § 15's measurements plus our responsive contract
3. ⛔ **Stop. Get the completed file approved before any page is written**
4. Then build, in `FRONTEND_PLAN.md` § 14.5's order — `/become-a-partner` first
5. Every page passes [`ANTI_SLOP.md`](./ANTI_SLOP.md) § 4 before it is called done

**Nothing in step 1 is blocked on code.** The only backend prerequisite in the whole public surface is
a public read endpoint for listed partners (§ 14.5 step 4).
