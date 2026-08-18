# `DESIGN.md` — the format, the rules, and which brands to actually read

Distilled 2026-08-18 from [voltagent/awesome-design-md](https://github.com/voltagent/awesome-design-md)
(74 brand files, MIT) and [xiaopu-ai/web-design](https://github.com/xiaopu-ai/web-design)'s
`references/design-md-template.md` (MIT, originally Chinese — rendered into English below).

**Read [`README.md`](./README.md) first** for how this fits the other two references and for the
house constraints a `DESIGN.md` may not override.

---

## 1. The contract

A `DESIGN.md` is one markdown file that an agent reads *before* generating UI. It succeeds or fails
on one property: **can a competent stranger build a page from it without asking a question?** If any
section is a placeholder, the agent fills the gap with its training-data average — which is the
definition of slop.

Four rules from the template, and each exists because of a specific failure:

| Rule | The failure it prevents |
|---|---|
| **Every section has substance. No heading-only placeholders** | A blank section is an invitation to improvise |
| **All CSS is runnable, not pseudo-code** | "subtle shadow" resolves to a different shadow every time it is read |
| **Every component states all five states** — default · hover · active · focus · disabled | Focus rings are the state that gets skipped, and it is the accessibility one |
| **Do's and Don'ts is the core section, not the appendix** | **Anti-patterns constrain a model harder than positive advice does.** This is the single most transferable claim in either repo |

---

## 2. The ten sections

Sections 1–9 are `web-design`'s template. Section 10 is the one the mature brand files in
`awesome-design-md` all carry and the template omits.

### 1 · Visual theme & atmosphere
Style name · 5–8 keywords · tone, **stated as a contrast** (`"warm and plain — NOT playful"`) · one
metaphor for the feel.

Plus the **interaction tier**, which is really a dependency budget:

| Tier | Means | Costs |
|:--:|---|---|
| **L1** | Refined but static | CSS only |
| **L2** | Fluid interaction | + a scroll/animation library |
| **L3** | Immersive | + smooth-scroll on top |

> **For us this is decided, not chosen: L1.** The public budget is < 150 kB first-load JS per route
> (`FRONTEND_PLAN.md` § 11). L2 spends a meaningful share of that on motion, on pages whose job is to
> load fast for a stranger on 4G. Pick L1 and the tier stops being a debate on every page.

### 2 · Colour palette & roles
Every colour as a CSS variable with its **role written beside it** — background, surface, surface-alt,
surface-hover, border, border-hover, text, text-secondary, text-tertiary, accent, accent-hover,
semantic (success/error/warning), plus RGB channel variants for `rgba()`.

Then the colour *rules*: no hard-coded hex in components, one accent per section, and so on.

> **We are already ahead here and must not regress.** `tailwind.config.ts` defines brand and accent as
> `rgb(var(--brand) / <alpha-value>)` precisely so runtime theming works. ⚠️ **The channels are
> space-separated RGB — put a hex in the variable and all twelve opacity variants in use silently
> render opaque.**

### 3 · Typography rules
Font stack with fallbacks, then a table: role × font × size × weight × line-height × letter-spacing,
for Hero H1 / Section H2 / H3 / Body / Label / Mono. Then rules, and an explicit **NEVER use** list.

> **Ours is fixed:** Montserrat via `next/font` (variable, 100–900, one file), `system-ui` then
> `sans-serif` as fallbacks, 14px body baseline. **No second family** — it is in the perf budget.
> Never add a Google Fonts `<link>`; `next/font` self-hosts and removes the layout shift.
> ⚠️ Montserrat is wider than Inter at the same size.

### 4 · Component stylings
Complete runnable CSS per component — buttons, cards, navigation, links, tags/badges — each with all
five states.

> Our public list is in `FRONTEND_PLAN.md` § 4: `PublicHeader` · `PublicFooter` · `SearchBar` ·
> `PartnerCard` · `ListingCard` · `VerificationBadge` · `EnquiryForm` · `EmptyState` · `Breadcrumb`.
> (`FacetGroup` and `Pagination` are deferred — § 13.3.) **`VerificationBadge` is the one that
> carries the product**, not just the design.

### 5 · Layout principles
Container max-width + padding + a narrow text variant · the spacing scale · the grid CSS.

### 6 · Depth & elevation
A table: level → treatment → where it is used. Flat / subtle / elevated.

> ⚠️ **A live trap.** `tailwind.config.ts` deliberately ships **no** `boxShadow.brand` token, with a
> comment explaining why: Viho separates surfaces with **borders, not elevation**, and the pixels
> under a real Viho button are pure `#ffffff`. A public design that leans on shadows is choosing to
> look different from the signed-in app — which is allowed, but must be chosen out loud.

### 7 · Animation & interaction
Motion philosophy in one line · the tier · entrance animation · scroll behaviour · hover and focus
states for every interactive element · **and a `prefers-reduced-motion` block, mandatory at L2+**.

> We already ship four keyframes — `pulse-glow`, `pulse-ring`, `bounce-slow`, `shimmer`. The first two
> read the live brand variable rather than a frozen rgba, which is the bug shape to avoid repeating.

### 8 · Do's and Don'ts
**The section that does the work.** At least 5 do's and **at least 8 don'ts**, each prefixed ❌.
See [`ANTI_SLOP.md`](./ANTI_SLOP.md) — our don'ts are half-written already, across
`PARTNER_DIRECTORY_PLAN.md` § 20.4's "Must NOT have" lines.

### 9 · Responsive behaviour
Breakpoint table with the layout change at each · touch-target minimum · collapsing strategy · the CSS.

> Ours is not a blank section either: 360px → 2560px, `dvh` never `vh`, ≥36px touch targets below
> `sm`, single-column grid base. Thirteen rules, each closing a measured defect —
> `UI_PATTERNS.md` § Responsive Contract.

### 10 · Iteration guide *(not in the template; every mature brand file has it)*
How to extend the system without breaking it — what to do when a component is needed that the system
does not cover. **This is what stops the file rotting**, and it is the section a template omits
because a template has nothing to iterate on yet.

---

## 3. Which of the 74 to read — not all of them

Reading all 74 is a week and teaches less than reading five with a question in mind. Our problem is
specific: **a low-inventory, trust-first B2B directory that must not look like a CRM or like every
other AI landing page.**

| Read | For | Why this one |
|---|---|---|
| **stripe** | Density, elevation, restraint at scale | The canonical "serious about money" surface. Its file is one of the most complete in the repo |
| **linear.app** | Doing a lot with almost no colour | The closest thing to proof that L1 can look expensive |
| **wise** | Trust conveyed by a financial brand to consumers | Nearest analogue to our problem — a stranger deciding whether to hand over a transaction |
| **intercom** | Marketing surface + product surface from one system | Exactly our Surface A vs Surface C/D split |
| **cal** | A small product's public site that does not look small | The single most relevant reference for Band 0–1 (`FRONTEND_PLAN.md` § 13.3) |
| **shopify** | A partner/merchant ecosystem's public face | Same shape as ours, and § 12.6 already flags its tiered directory as our model |
| **notion** *or* **mintlify** | Typographic hierarchy carrying a content-heavy page | Category and profile pages are mostly text |

Skip the automotive and luxury files (ferrari, lamborghini, bugatti, bmw-m) — they are visually
instructive and behaviourally useless for a directory: full-bleed imagery, heavy motion, and no
density problem to solve.

```bash
# read one without cloning 153 files
curl -sL https://raw.githubusercontent.com/voltagent/awesome-design-md/main/design-md/cal/DESIGN.md
```

**Read them for technique, never for tokens.** Copying Stripe's palette into a public repo is passing
off, and operating-contract rule 7 covers the adjacent case. What transfers is *how* a decision is
recorded, not the decision.

---

## 4. The workflow, once we adopt this

```
Phase A — understand    inputs: FRONTEND_PLAN.md §§ 12–14 · the Justdial R&D · the owner's taste call
Phase B — DESIGN.md     fill PUBLIC_DESIGN_WORKSHEET.md → ⛔ STOP. The owner approves it
Phase C — code          build app/(public)/ against the approved file. Delegate; it is now mechanical
```

**Phase B's stop is the whole point.** Code written before the spec is agreed gets defended rather
than replaced, and this is a surface where the second draft is much more expensive than the first —
it is what strangers judge the company on (`FRONTEND_PLAN.md` § 1).

**Where the approved file lives:** the convention is `DESIGN.md` at the project root, because that is
where agents look for it without being told. Our root already carries `CLAUDE.md` and `AGENTS.md`, so
adding a third agent-facing file there is the owner's decision, not an agent's. Until then it lives in
this folder and gets pointed at explicitly.
