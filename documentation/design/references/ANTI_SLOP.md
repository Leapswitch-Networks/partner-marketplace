# Anti-slop — the taste-skill lens, bound to our constraints

Distilled 2026-08-18 from [tasteskill.dev](https://www.tasteskill.dev/) /
[Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) (MIT, 77k ★, last updated
2026-08-17), and turned into checks that can actually fail on *this* codebase.

> Its own framing: **"The anti-slop frontend framework for AI agents."** The premise is that agents —
> Claude Code included — do not produce bad design so much as **average** design, because averaging is
> what a model does under uncertainty. The repo carries a `research/laziness/` corpus arguing this
> from training-data bias, RLHF incentives and output limits.

**Why this matters more here than on a normal project.** Our public surface is being built by a team
whose entire frontend output so far is an admin panel, under an operating contract that says the
frontend is what the company is judged on. That is precisely the setup that produces a competent,
forgettable page.

---

## 1. What slop concretely looks like

Not a vibe — a list you can check a rendered page against.

| Tell | What it looks like | Why the model reaches for it |
|---|---|---|
| **The purple gradient hero** | A full-width violet-to-indigo gradient behind centred white text | The single most-represented landing page in the training set |
| **Three identical feature cards** | Icon, bold heading, two grey lines. Always three. Always equal width | The default answer to "explain the product" |
| **Meaningless motion** | Everything fades up 20px on scroll, staggered 100ms | Motion reads as "designed" without requiring a decision |
| **Fake social proof** | "Trusted by 10,000+ teams", animated counters, five logo silhouettes | The convention is so strong it appears even with no data |
| **Emoji as iconography** | 🚀 ⚡ 🎯 in feature headings | Free icons that never look considered |
| **Zero typographic hierarchy** | Everything 16px/1.5 in two weights | Safest possible answer |
| **Centred everything** | Every section centre-aligned to 1200px | Centring never looks broken, so it is the low-risk default |
| **Rounded-2xl on all of it** | Same radius on cards, buttons, inputs, images, avatars | One radius is one fewer decision |
| **The dead footer** | Four columns: Product, Company, Resources, Legal — half the links go nowhere | Structure copied without the content to fill it |
| **Generic voice** | "Empower your business with cutting-edge solutions" | The mean of all marketing copy |

**Six of these ten are already banned in writing** by `PARTNER_DIRECTORY_PLAN.md` § 20.4's *Must NOT
have* lines — no stock-photo carousel, no animated counters, no testimonials we do not have, no
"trusted by" logos without permission, no fake scarcity, no invented success stories. This document
is not new policy so much as the reason those lines were right.

---

## 2. The four moves that actually help

Distilled from what taste-skill's v2 does, minus the parts that need the skill installed.

### ① Infer the brief before generating
v2 calls this *brief inference*: read the project's context first, generate second. **We have an
unusually rich brief and it is written down** — `FRONTEND_PLAN.md` §§ 12–14 (the Justdial research and
the scale bands), § 20.4's per-page contracts, § 9's trust argument, § 18.1's verifiable facts. An
agent that generates a public page without reading those is generating the average of the internet.

### ② Commit to one deliberate constraint
Slop is the absence of constraint. Pick a rule that is visibly *chosen* and hold it everywhere. We
have three inherited free of charge, and they are worth treating as design decisions rather than
limitations:

- **Two faces, one of them a serif, and nothing else.** EB Garamond 400 for public headings,
  Montserrat for everything else — decided 2026-08-18. The serif *is* the design; the discipline is
  that there is no third.
- **Borders, not shadows.** The token set deliberately ships no `boxShadow.brand`; Viho separates
  surfaces with borders. A public site that holds this line looks unlike the shadow-stack default.
- **L1 motion.** CSS only, no scroll library — the honest tier under a 150 kB budget. The one
  vocabulary rule from the reference: **hover shrinks** (`scale(.98)`), it does not lift or glow.

### ③ Run a hard pre-flight before calling it done
v2's *pre-flight check* — a page is not finished when it renders. § 4 below is ours.

### ④ Redesign existing work rather than only greenfield
v2 ships a redesign protocol. Relevant sooner than it sounds: `app/not-found.tsx` already exists and
must serve the **public** 404 (`FRONTEND_PLAN.md` § 4), and a crawled 404 is judged like any page.

---

## 3. The specific temptation this project has

**The admin shell is right there, it is good, and it is wrong for this.**

`FRONTEND_PLAN.md` § 2 says it plainly: *"A category page built out of `ResourceIndex` is the single
most likely way this surface ends up looking like a CRM."* That is our version of slop — not a purple
gradient, but a filter bar, a data table and a pager on a page whose job is to make a stranger trust a
company they have never heard of.

Concretely, for the launch surface (`FRONTEND_PLAN.md` § 14.2):

- `/partners` is **not** a table. No column headers, no per-page selector, no bulk anything.
- `PartnerCard` is not a table row with rounded corners. It is the smallest complete argument for
  that company — and at Band 1 it has to be, because there are only a dozen of them and the list
  cannot carry the page (§ 12.6: **make each row deep, not the list long**).
- `EmptyState` is a designed screen, not a centred grey sentence. It is the **launch condition**, not
  an edge case — the database has zero partners today.

---

## 4. Pre-flight — a page is not done until every line passes

Ordered so the cheap mechanical checks fail first.

**Mechanical**

- [ ] `npm run typecheck` and `npm run lint` clean (⚠️ never `npm run build` in the dev container)
- [ ] No hard-coded hex anywhere in the component — every colour resolves through a token
- [ ] **No `dark:` variant anywhere on a public component** — the public surface is light-only
      (`FRONTEND_PLAN.md` § 15.8 ①). *(In `(app)`, the opposite rule holds: `text-brand` never appears
      without `dark:text-brand-on-dark` beside it)*
- [ ] Every colour is a `public.*` token, **never a raw hex** — this is what keeps light-only reversible
- [ ] `coral` and `amber` are not text on cream — 2.77:1 and 1.88:1, both fail AA
- [ ] 360px and 2560px both checked. `dvh`, never `vh`. Touch targets ≥ 36px below `sm`
- [ ] Every interactive element has a visible focus ring and is reachable by keyboard
- [ ] Images carry explicit `width`/`height`; skeletons match final dimensions
- [ ] ≤ 1 above-the-fold image, `priority`; first-load JS < 150 kB for the route
- [ ] `metadata` exported — title, description, canonical, OpenGraph. Exactly one `<h1>`

**Honesty** — every one of these is a rule from the operating contract or § 20.2, not taste

- [ ] No number on the page that is not backed by `§ 18.1` or a live query
- [ ] No count of our own inventory at all until Band 2 (`FRONTEND_PLAN.md` § 13.3)
- [ ] No rating, review count or "responds in X" until the data exists — **omit the block, never zero it**
- [ ] No testimonial, logo or success story we do not have permission for
- [ ] Page reads correctly with **zero** partners in the database

**Anti-slop**

- [ ] None of § 1's ten tells is present
- [ ] The one deliberate constraint from § 2② is visibly held
- [ ] Nothing on the page came out of `components/common/` — that folder is the admin shell's
- [ ] Every section would be missed if deleted. If a section can go without loss, it should
- [ ] The copy says something only *we* could say. If it would fit any B2B company, rewrite it

**The last check, and it is the real one**

- [ ] Shown to somebody who has never seen the project, they can say what it is and what to do next —
      **without scrolling past the fold to find the search box** (§ 20.4's own done-when for `/`)

---

## Related

- [`README.md`](./README.md) — the three references and how they compose
- [`DESIGN_MD.md`](./DESIGN_MD.md) — the format; § 8 of a `DESIGN.md` is where these don'ts land
- [`PUBLIC_DESIGN_WORKSHEET.md`](./PUBLIC_DESIGN_WORKSHEET.md) — the decisions still open
- [`../../planning/FRONTEND_PLAN.md`](../../planning/FRONTEND_PLAN.md) §§ 12–14 — the scale research these checks assume
