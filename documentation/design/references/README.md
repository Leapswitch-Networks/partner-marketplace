# Frontend design references — the three the owner picked

**Added 2026-08-18** at the owner's request, ahead of the public-website build. Everything here is
**for Surface A — the public directory** (`FRONTEND_PLAN.md` § 2). It is not for the signed-in
back office: that surface already has a design system, it is Viho, and
[`../../system-design/UI_PATTERNS.md`](../../system-design/UI_PATTERNS.md) remains authoritative for it.

> **Why this folder exists.** The public pages are, in this file's own plan's words, *"architecture
> this codebase has never produced"*. Every screen we have built so far is an admin table. The
> failure mode for a marketing surface built by the people who built an admin panel is not ugliness —
> it is **genericness**: a page that looks like every other AI-generated landing page, which is the
> exact thing a buyer judging whether to trust us will notice first.
>
> These three resources each attack a different half of that problem. **None of them is a design.**
> They are a format, a process, and a set of guardrails.

---

## The three, and what each actually is

Metadata verified against the live repos on **2026-08-18**, not quoted from the links.

| | Resource | What it really is | Size / licence |
|:--:|---|---|---|
| **1** | [voltagent/awesome-design-md](https://github.com/voltagent/awesome-design-md) | **A library of 74 `DESIGN.md` files** reverse-engineered from real brands — Stripe, Linear, Vercel, Apple, Notion, Shopify, Wise, Supabase, Figma, Intercom… Each is a complete, readable design system in one markdown file | 109k ★ · MIT |
| **2** | [tasteskill.dev](https://www.tasteskill.dev/) → [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) | **Anti-slop guardrails.** A Claude Code skill/plugin whose entire purpose is stopping an agent producing generic output. v2 adds brief inference, a redesign protocol for existing projects, and a hard pre-flight check. Ships a `research/laziness/` corpus on *why* models default to generic | 77k ★ · MIT · updated 2026-08-17 |
| **3** | [xiaopu-ai/web-design](https://github.com/xiaopu-ai/web-design) | **A process, not a library.** A Claude Code skill enforcing *spec first, code second*: Phase A understand → Phase B emit a `DESIGN.md` **and stop for approval** → Phase C generate code. Carries its own 9-section `DESIGN.md` template | 635 ★ · MIT |

### How they compose

They are not three alternatives. They are three stages of one workflow, and they only work in order:

```
  ┌── 3. web-design ─────────────── the PROCESS ────────────────────────────┐
  │                                                                          │
  │   Phase A          →      Phase B              →      Phase C            │
  │   understand              write DESIGN.md             write the code     │
  │                           ↑ STOP for approval                            │
  │                           │                                              │
  │              1. awesome-design-md                                        │
  │              the FORMAT + 74 worked examples                             │
  │                                                                          │
  └──────────────────── 2. taste-skill: the GUARDRAIL ───────────────────────┘
                        runs across all three phases
```

**The single most valuable idea in all three is the stop.** `web-design` refuses to write code until a
`DESIGN.md` has been agreed. That is the same discipline this project already applies to backend work
— spec, then implement, then verify — and it is the one that has never been applied to a page here.

---

## What `DESIGN.md` is, and why it is not another standards file

`DESIGN.md` is a convention [introduced by Google Stitch](https://stitch.withgoogle.com/docs/design-md/overview/):
a plain-markdown design system that AI agents read before generating UI. The division of labour is
exactly the one this repo already uses:

| File | Who reads it | What it decides |
|---|---|---|
| `AGENTS.md` | coding agents | **How** the project is built |
| `DESIGN.md` | design agents | **How it should look and feel** |

We have the first and not the second. Full format spec, generation rules and the shortlist of which
of the 74 brands are worth reading for *our* problem: **[`DESIGN_MD.md`](./DESIGN_MD.md)**.

---

## The files in this folder

| File | What it gives you |
|---|---|
| [`DESIGN_MD.md`](./DESIGN_MD.md) | The format, the ten sections, the generation rules, and **which brands to read for a trust-first directory** — not all 74 |
| [`ANTI_SLOP.md`](./ANTI_SLOP.md) | What generic AI output concretely looks like, and a pre-flight checklist bound to *our* constraints |
| [`PUBLIC_DESIGN_WORKSHEET.md`](./PUBLIC_DESIGN_WORKSHEET.md) | The ten sections with **every value we already know pre-filled from the code**, and the aesthetic decisions left explicitly open |

---

## Using them

### Neither skill is installed, and that is deliberate

Both are one command, and each installs differently — **verified against the repos on 2026-08-18**,
not assumed:

```bash
# taste-skill — also installable as a Claude Code plugin (the repo ships
# .claude-plugin/marketplace.json)
npx skills add Leonxlnx/taste-skill

# web-design — a git clone into the user-global skills directory. Note the
# canonical org is KAOPU-XiaoPu; xiaopu-ai/web-design is the same project.
git clone https://github.com/KAOPU-XiaoPu/web-design ~/.claude/skills/web-design
```

**Neither has been run.** `taste-skill` writes third-party code into the project — and this repo is
public, so vendoring somebody else's tree into it is the owner's call, not an agent's. `web-design`
installs into `~/.claude/skills/`, which is outside the repo but is still the owner's machine-wide
agent configuration.

**They are useful without being installed.** This folder distils what they teach; the install only
automates it.

### The one rule that makes them safe here

> **A `DESIGN.md` governs `app/(public)/` and nothing else.**

`FRONTEND_PLAN.md` § 2 settles that Surface A shares nothing with the back office — different fetch
path, different actor, different shells. So a public design language cannot contradict
`UI_PATTERNS.md`; they govern disjoint route groups. **If a rule in a `DESIGN.md` ever appears to
apply to `/dashboard`, it is being read wrong.**

Where a public design must still obey the house rules regardless of taste:

| Constraint | Source | Non-negotiable because |
|---|---|---|
| Montserrat only — **no second font family** | `FRONTEND_PLAN.md` § 11 | It is in the performance budget, and `next/font` self-hosts it |
| `text-brand dark:text-brand-on-dark` **as a unit** | `UI_PATTERNS.md` | `#24695c` on the dark card is **2.83:1** and fails AA outright |
| Brand colours are **space-separated RGB channels**, never hex | `tailwind.config.ts` | 12 opacity variants are in use; a hex silently renders every one of them opaque |
| LCP < 2.5s · CLS < 0.1 · < 150 kB first-load JS · ≤ 1 above-fold image | `FRONTEND_PLAN.md` § 11 | A stranger on an Indian 4G phone is the reviewer |
| 360px → 2560px, `dvh` never `vh`, touch targets ≥ 36px | `UI_PATTERNS.md` § Responsive Contract | 28 breakpoint defects were closed to write those rules |

---

## Honest caveats

Recorded because each one costs time to discover.

- **`web-design`'s `SKILL.md` and its template are written in Chinese.** They are usable — the CSS and
  the structure are language-neutral, and [`DESIGN_MD.md`](./DESIGN_MD.md) carries an English
  rendering of the template — but do not hand the raw file to someone and expect them to follow it.
- **`awesome-design-md`'s README is heavily monetised** — sponsor blocks, a paid request service, a
  "LaunchKit" upsell. The `design-md/` directory itself is clean and is the only part worth reading.
- **These are brand *analyses*, not brand *assets*.** Reading Stripe's `DESIGN.md` to learn how a
  trust-heavy fintech handles density and elevation is fair use of a technique. Copying its palette
  and shipping it is passing off. **Rule 7 of the operating contract already covers the adjacent
  version of this** — do not put another company's identity in a public repo.
- **`UI_PATTERNS.md` says "no component library (no shadcn/ui, no Radix)". That is stale** —
  `frontend/package.json` lists four `@radix-ui/*` packages, and `tailwind.config.ts` carries a block
  of shadcn semantic aliases added 2026-08-10. Measured 2026-08-18. It matters here because a public
  design decision that assumes zero primitives will be wrong about what already exists.
- **None of these three will give the site taste.** They remove the ways it can be generic. What it
  should actually feel like is a decision the owner has not made yet, and
  [`PUBLIC_DESIGN_WORKSHEET.md`](./PUBLIC_DESIGN_WORKSHEET.md) § A is where it gets made.

*(Not to be confused with the repo-root `references/` folder, which holds the LeapDesk reference
implementation and is unrelated to this.)*

## Related

- [`../../planning/FRONTEND_PLAN.md`](../../planning/FRONTEND_PLAN.md) — the page register; §§ 12–14 are the Justdial scale research
- [`../../system-design/UI_PATTERNS.md`](../../system-design/UI_PATTERNS.md) — **authoritative for the signed-in surface**
- [`../VIHO_THEME_REFERENCE.md`](../VIHO_THEME_REFERENCE.md) — the adopted theme's measured tokens
- [`../LOGO_BRIEF.md`](../LOGO_BRIEF.md) — the 32px floor and every brand hex
