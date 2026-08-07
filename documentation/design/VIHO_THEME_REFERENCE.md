# Viho Theme — Design Reference (Adopted)

> **What this is:** a design-token reference extracted from the **Viho** admin theme (Pixelstrap), the
> visual direction the project owner selected on **2026-08-03** and **formally adopted in full on
> 2026-08-05**. It records colours, typography, spacing and component anatomy so we can build the same
> *look* in our own stack.
>
> **What this is not:** the theme's source code. Viho is a **paid, licensed** template and its source
> is deliberately **not** in this repository.
>
> **What this is also not: a record of what we have built.** Adoption is decided; implementation has
> **not started**. This file describes *Viho*. For what our code actually does today, read
> [`../system-design/UI_PATTERNS.md`](../system-design/UI_PATTERNS.md); for how we get from one to the
> other, read [`VIHO_ADOPTION_PLAN.md`](./VIHO_ADOPTION_PLAN.md).

**Reference URL (login screen the owner shared):** <https://vue.pixelstrap.net/viho/auth/login>

---

## ⚖️ Licensing Boundary — Read Before Using This

Viho is commercial. The project owner holds the licence; this repo does not contain the theme.

| Allowed | Not allowed |
|---------|-------------|
| Reading the public demo to understand layout and spacing | Copying `.vue`, `.js` or `.scss` files into this repo |
| Recording colour values, type scale, and structure as notes (this file) | Vendoring the theme's compiled CSS bundle |
| Rebuilding a screen from scratch in **our** stack (React 18 + Tailwind 3) | Copying its icon fonts (Themify, IcoFont, FontAwesome) or images |
| Keeping screenshots in `assets/screenshots/` for internal reference | Committing the theme's own image/font assets as project assets |

Two practical consequences:

1. **Colour values and a type scale are facts about an appearance, not copyrightable code.** Writing
   `#24695c` in our `tailwind.config.ts` is fine. Pasting Viho's stylesheet is not.
2. **This repo is PUBLIC** (`documentation/AGENTS.md` § Repository Visibility). The screenshots in
   `assets/screenshots/` will be world-readable once pushed. Keep them to UI framing only — no
   customer data, no partner names, and do not bulk-mirror the demo. See
   [`assets/screenshots/README.md`](./assets/screenshots/README.md).

---

## 🔬 How These Values Were Obtained (Reproducible)

Not eyedropped from a screenshot, and not recalled from training data — parsed from the stylesheets
the live demo actually serves, on 2026-08-03:

```bash
curl -sL https://vue.pixelstrap.net/viho/auth/login -o login.html
# the SPA shell references exactly two stylesheets:
curl -sL https://vue.pixelstrap.net/viho/css/app.44f0a026.css      -o app.css       # 1,337,229 B
curl -sL https://vue.pixelstrap.net/viho/css/chunk-vendors.792549f7.css -o vendors.css  # 1,284,289 B
```

`app.css` holds **3,878 hex literals across 258 distinct colours**. Every value below is quoted from a
real rule, with the selector named so it can be re-checked. The filenames are content-hashed — when
Pixelstrap redeploys, the hashes change and these numbers should be re-verified.

> **Note the theme's own typo:** the primary CSS variable is spelled **`--theme-deafult`**
> (not `--theme-default`). It appears that way throughout `app.css`. Quoted verbatim below so nobody
> "fixes" it while comparing against the demo — but **our** token must be spelled correctly.

---

## 🎨 Colour System

### Brand

Viho drives its brand colour through two custom properties on `:root`:

```css
--theme-deafult:  #24695c;   /* primary — deep teal-green */
--theme-secondary:#ba895d;   /* secondary — muted tan / bronze */
```

| Token | Hex | RGB | Character | Where it shows |
|-------|-----|-----|-----------|----------------|
| Primary | `#24695c` | `36, 105, 92` | Deep desaturated teal-green | Buttons, active nav, links, focus, icon accents |
| Secondary | `#ba895d` | `186, 137, 93` | Warm tan / bronze | Secondary buttons, accent charts, badges |

This is a **teal + tan** pairing — cool primary, warm accent. It reads calm and finance-adjacent,
which is a different personality from our current **orange `#F97316`** brand. That is the single
biggest decision this document surfaces; see § Adoption Decision.

**Primary used at low alpha is a signature move of this theme** — the tinted-surface trick appears
constantly, most visibly as the login page background:

| Usage | Value | Flattened | Selector |
|-------|-------|-----------|----------|
| Page wash behind the login card | `rgba(36,105,92,.1)` | **`#eaf0ef`** | `.login-card` |
| Input group addon fill | `rgba(36,105,92,.1)` | **`#eaf0ef`** | `.login-form .form-group .input-group-text` |
| Light button fill | `rgba(36,105,92,.1)` | `#eaf0ef` | `.btn-primary-light` |
| Light button hover | `rgba(36,105,92,.5)` | — | `.btn-primary-light:hover` |
| Social icon tile fill | `rgba(36,105,92,.08)` | **`#eff3f2`** | `.login-form ul.login-social li` |
| Card border in dark mode | `rgba(36,105,92,.2)` | **`#142831`** (over `#111727`) | `body.dark-only … .card` |
| Primary button shadow | `0 5px 10px 2px rgba(36,105,92,.19)` | — | `.btn-primary` |
| Focus ring | `0 0 0 .2rem #5ec8b4` | — | `.btn-primary:focus` |

The **Flattened** column is the composited result, measured pixel-by-pixel from the owner's
screenshots (§ Screenshots). Those are the values to use if you need an opaque fill rather than an
alpha layer — handy because an alpha wash over a *dark* surface gives a completely different result.

Tailwind equivalent: `bg-brand/10`, `bg-brand/8`, `border-brand/20`. Our Tailwind 3 setup supports
that slash syntax already, so this pattern ports with no config work.

### Semantic

Quoted from the `.btn-*` rules in `app.css`:

| Role | Hex | RGB | Notes |
|------|-----|-----|-------|
| `primary` | `#24695c` | `36, 105, 92` | = brand |
| `secondary` | `#ba895d` | `186, 137, 93` | = brand secondary |
| `success` | `#1b4c43` | `27, 76, 67` | **A darker shade of the primary, not a green.** Unusual — success and primary are nearly indistinguishable at a glance |
| `danger` | `#d22d3d` | `210, 45, 61` | Warm red |
| `warning` | `#e2c636` | `226, 198, 54` | Mustard yellow |
| `info` | `#717171` | `113, 113, 113` | **A grey, not a blue.** Also unusual |
| `light` | `#e6edef` | `230, 237, 239` | Cool off-white — the theme's border colour too |
| `dark` | `#2c323f` | `44, 50, 63` | Blue-tinted charcoal |

⚠️ **Two of these are traps if copied literally.** `success` being a primary shade means a success
state and a normal action look the same, and `info` being grey means informational messages read as
disabled. Recommendation in § Adoption Decision.

### Neutrals & Surfaces — Light

| Role | Hex | Selector |
|------|-----|----------|
| Page background | `#f5f7fb` | `body` |
| Card / raised surface | `#ffffff` | `.card`, `.login-form`, `.page-main-header` |
| Border (primary) | `#e6edef` | `.card`, `.input-group-text` |
| Border (divider) | `#efefef` | `.theme-form .login-divider`, `.logo-wrapper` |
| Body text | `#242934` | `body` |
| Form label text | `#59667a` | `.form-label, .theme-form .col-form-label` |
| Placeholder | `#898989` | `.theme-form … ::placeholder` |
| Muted / helper text | `#999999` | `.login-form h6`, `.login-form .checkbox label` |
| Secondary muted | `#98a6ad` | widely used for meta text |

### Neutrals & Surfaces — Dark

Dark mode is **class-based on `<body>`**: `body.dark-only`. (Ours is class-based on `<html>` — same
idea, different element.)

**Measured from the dark-mode screenshot, not inferred** — the CSS alone is ambiguous here because
several rules set both colours and static specificity analysis on a 1.3 MB minified file is
unreliable. Sampled pixel values:

| Role | Hex | How confirmed |
|------|-----|---------------|
| **Page background** (gaps between cards) | `#202938` | sampled at a card gutter |
| **Card surface** | `#111727` | sampled inside 3 different cards |
| **Sidebar background** | `#111727` | sampled at two heights |
| **Header background** | `#111727` | sampled |
| Card border | `rgba(36,105,92,.2)` → renders **`#142831`** | 1px border scan across a card's top edge |
| Body text | `hsla(0,0%,100%,.7)` | `body.dark-only` |
| Heading text | `#ffffff` | `body.dark-only .card .card-header h5` |
| Muted text | `#98a6ad` | most `dark-only` meta rules |
| Accordion border | `#374252` | `body.dark-only … .default-according .card` |

Area shares in the dark screenshot corroborate it: `#111727` covers **64.24%** (sidebar + every card),
`#202938` **7.99%** (only the gutters between cards), `#24695c` **7.44%** (banner, active nav, charts).

> **The important finding: dark mode inverts the elevation convention.**
>
> | | Page | Card | Relationship |
> |---|---|---|---|
> | Light | `#f5f7fb` | `#ffffff` | card **lighter** than page — conventional |
> | Dark | `#202938` | `#111727` | card **darker** than page — inverted |
>
> Most dark themes (including Tailwind's own grey scale as we use it — `dark:bg-gray-950` page with
> `dark:bg-gray-800` surfaces) make cards *lighter* than the page, so surfaces appear to rise. Viho
> does the opposite: cards recede into darkness and the *page* is the lighter plane. Combined with the
> brand-tinted `#142831` border, cards read as cut-out wells rather than raised panels.
>
> **This is a deliberate look, and it is the reverse of our current dark mode.** Adopting Viho's dark
> palette therefore means inverting our surface tokens, not just re-hexing them — `UI_PATTERNS.md`
> currently mandates `bg-white dark:bg-gray-800` for raised surfaces on a `dark:bg-gray-950` page.

An earlier draft of this document guessed from the CSS that the content wrapper and the cards were
both `#111727`, and warned that cards would look flat. **That was wrong** — the gutters really are
`#202938`, so cards separate cleanly. The pixel measurements above supersede it.

### Full Palette by Frequency

Top values across all 3,878 hex literals in `app.css` — this is the *working* palette, weighted by
how much of the UI each colour actually paints:

| # | Hex | Count | Role |
|---|-----|-------|------|
| 1 | `#ffffff` | 645 | Surfaces, text on colour |
| 2 | `#e6edef` | 333 | Borders, `light` |
| 3 | `#24695c` | 283 | **Primary** |
| 4 | `#717171` | 189 | `info`, grey text |
| 5 | `#111727` | 151 | Dark surface |
| 6 | `#202938` | 145 | Dark body |
| 7 | `#1b4c43` | 142 | `success` |
| 8 | `#e2c636` | 140 | `warning` |
| 9 | `#d22d3d` | 140 | `danger` |
| 10 | `#2c323f` | 139 | `dark` |
| 11 | `#ba895d` | 115 | **Secondary** |
| 12 | `#999999` | 110 | Muted text |
| 13 | `#98a6ad` | 80 | Secondary muted |
| 14 | `#242934` | 53 | Body text |
| 15 | `#efefef` | 47 | Dividers |
| 16 | `#898989` | 38 | Placeholder |
| 17 | `#f5f7fb` | 30 | Page background |
| 18 | `#59667a` | 30 | Label text |

**Derived shade ladders** (hover/active states the theme hand-rolled rather than computing):

| Base | Darker shades found |
|------|--------------------|
| Primary `#24695c` | `#17433b`, `#10302a`, `#0e2622`, `#236559` |
| Secondary `#ba895d` | `#a07044`, `#8e633c`; lighter `#d1b093` |
| Danger `#d22d3d` | `#a82431`, `#93202b`; lighter `#e06c77` |
| Warning `#e2c636` | `#c8ac1d`; lighter `#ecd979` |

---

## ♿ Accessibility Audit of This Palette

Computed WCAG 2.1 contrast ratios (sRGB relative luminance). **Do not adopt the failures.**

| Combination | Ratio | AA normal (4.5) | AA large (3.0) |
|-------------|------:|:---------------:|:--------------:|
| White on primary `#24695c` | **6.46** | ✅ | ✅ |
| White on success `#1b4c43` | **9.72** | ✅ | ✅ |
| White on danger `#d22d3d` | **5.02** | ✅ | ✅ |
| White on info `#717171` | **4.88** | ✅ | ✅ |
| White on dark `#2c323f` | **12.84** | ✅ | ✅ |
| Body `#242934` on page `#f5f7fb` | **13.58** | ✅ | ✅ |
| Body `#242934` on light `#e6edef` | **12.29** | ✅ | ✅ |
| Label `#59667a` on white | **5.82** | ✅ | ✅ |
| Muted `#98a6ad` on dark card `#111727` | **7.14** | ✅ | ✅ |
| White-70% on dark body `#202938` | ~**6.98** | ✅ | ✅ |
| **White on secondary `#ba895d`** | **3.08** | ❌ | ✅ |
| **Placeholder `#898989` on white** | **3.50** | ❌ | ✅ |
| **Muted `#999999` on white** | **2.85** | ❌ | ❌ |
| **White on warning `#e2c636`** | **1.70** | ❌ | ❌ |

Four problems, in severity order:

1. **`.btn-warning { color:#fff }` at 1.70 is unusable** — the theme really does set white text on
   mustard. Use `#242934` on warning instead: **8.58**, passes comfortably.
2. **`#999999` muted text at 2.85 fails outright.** Viho uses it for the login subtitle
   (`.login-form h6`) and the "remember me" label. Our existing `text-gray-500` (`#6b7280`, 4.83 on
   white) already passes — keep ours.
3. **White on secondary `#ba895d` (3.08)** is large-text-only. Fine for a 22px heading, not for a
   14px button label — which is exactly what `.btn-secondary` does.
4. **Placeholder `#898989` (3.50)** fails normal-text AA. Placeholders are exempt from some readings
   of the spec, but `UI_PATTERNS.md` already forbids placeholder-as-label, so this is low-impact.

Our `UI_PATTERNS.md` § Focus & Accessibility says *"Colour alone must never carry meaning"* — that
rule stands and overrides anything inherited from the theme.

---

## ✍️ Typography

| Concern | Viho value | Selector |
|---------|-----------|----------|
| Body font | **Montserrat**, `sans-serif` | `body` |
| Body size | **14px** | `body` |
| Body colour | `#242934` | `body` |
| Also present | Roboto (×11), Rubik (×10), Montserrat (×6), Open Sans, Nunito | scattered |
| Icon fonts | Themify, IcoFont, FontAwesome, Glyphicons | **do not copy — licensed** |

**Montserrat is the body font; the multiple families are demo pages showing off type options, not a
real hierarchy.** Do not read the Roboto/Rubik counts as "the theme uses four fonts".

### Type Scale

| Element | Size | Weight |
|---------|------|--------|
| `h1` | 34px | — |
| `h2` | 28px | — |
| `h3` | 26px | — |
| `h4` | 22px | — |
| `h5` | 18px | — |
| `h6` | — | 600 |
| Body | 14px | 400 |
| `.btn` | 14px | 600 |
| `.btn-lg` | 18px | — |
| `.btn-sm` | 12px | — |
| `.form-label` | — | 500 |
| `.f-w-600` | — | 600 |

Notable: **the scale is tight at the top** — h2→h3 is only 2px, h3→h4 is 4px. Compressed heading
scales are a deliberate admin-UI choice (dense screens, many small sections) but give you little
hierarchy to work with. Our Tailwind default scale is more spread out.

⚠️ **Our stack loads Inter via `next/font`, not Montserrat.** `UI_PATTERNS.md` forbids adding a
Google Fonts `<link>` — if we adopt Montserrat it must go through `next/font/google` exactly as Inter
does today, to keep the self-hosting and zero layout shift.

---

## 📐 Spacing, Radius & Elevation

| Concern | Viho value | Selector |
|---------|-----------|----------|
| Card padding | **30px** | `.card .card-header`, `.card .card-body` |
| Card bottom margin | **30px** | `.card` |
| **Card radius** | **`0`** | `.card` |
| Card border | `1px solid #e6edef` | `.card` |
| Card transition | `all .3s ease` | `.card` |
| Card letter-spacing | `.5px` | `.card` |
| Button padding | `.375rem 1.75rem` (6px / 28px) | `.btn` |
| Badge padding | `.44em .7em` | `.badge` |
| Form group spacing | **20px** bottom | `.theme-form .form-group`, `.login-form …` |
| Compact form spacing | 14px | `.theme-form.sm-form .form-group` |
| Label → control gap | 5px | `.login-form .form-group label` |
| Divider spacing | `30px 0` | `.theme-form .login-divider` |
| Social tile radius | `5px` | `.login-form ul.login-social li` |
| Sidebar width | **290px** | `.page-sidebar` |
| Sidebar transition | `all .5s ease` | `.page-sidebar` |

### Radius — the theme mixes them deliberately

`border-radius: 0` on `.card` is real, but it is **not** a blanket rule. Measured from the
screenshots by scanning corner pixels for the antialiasing ramp:

| Element | Radius | Evidence |
|---------|-------:|----------|
| `.card` (stat cards, panels) | **0** — perfectly square | Corner scan shows the 1px `#e6edef` border starting instantly, no curve at all |
| Primary button (`LOGIN`) | **≈5–6px** | Curve ramp spans 6 pixels |
| Active sidebar nav item | **≈8–10px** | Curve ramp spans ~9 pixels — the roundest thing in the UI |
| Social icon tile | `5px` | `.login-form ul.login-social li` |
| `.card-absolute` header | `.25rem` (4px) | `.card-absolute .card-header` |

So the system is **squared surfaces + rounded controls**. That is a coherent choice — hard-edged
panels give the dense grid its structure, while rounded interactive elements stay obviously clickable.

This **narrows** the conflict with our standards. `UI_PATTERNS.md` § Layout Conventions mandates
`rounded-lg` everywhere and says *"don't mix radii"*. Against Viho:

- **Our controls already match** — `rounded-lg` is 8px, which is between Viho's 5px button and ~9px
  nav item. Nothing to change.
- **Only our card/surface radius conflicts** — we round them, Viho squares them.

So this is a one-decision change (square the surfaces or don't), not the sweeping re-do the earlier
draft of this doc implied. § Adoption Decision is updated accordingly.

### Elevation

Distinct `box-shadow` values, by frequency:

| Count | Value | Use |
|------:|-------|-----|
| 69 | `none` / `none!important` | The theme **removes** shadows more than it adds them |
| 8 | `0 5px 10px 2px rgba(36,105,92,.19)` | Primary button — **brand-tinted, not black** |
| 8 | `0 3px 5px 1px rgba(88,103,221,.15)` | Leftover indigo from a sibling theme |
| 5 | `0 2px 6px 0 rgba(0,0,0,.1)` | Generic raised |
| 3 | `0 0 20px rgba(89,102,122,.1)` | Soft ambient |
| 3 | `0 0 11px 5px hsla(0,0%,44%,.08)` | Diffuse glow |
| 2 | `0 0 20px rgba(25,124,207,.08)` | Fixed header (`.page-main-header`) — **blue-tinted** |

Two takeaways: shadows are **coloured, not neutral** (tinted with the brand or a hue), and the theme
is mostly **flat** — it separates with borders and background washes rather than elevation. The
`rgba(88,103,221,…)` indigo and `rgba(25,124,207,…)` blue are Pixelstrap boilerplate shared across
their theme family and are **not** part of Viho's palette — don't carry them over.

### ⚠️ Correction 2026-08-06 — the button shadow does not render. Do not apply it.

The `0 5px 10px 2px rgba(36,105,92,.19)` row above is real in `app.css` and it is also **misleading**.
It was taken at face value and applied to our `Button` and to the active sidebar item; the owner spotted
immediately that the theme has no such shadow. Checking the pixels settles it — sampled directly below
and beside real Viho buttons:

| Screenshot | Element | 6 px below | 6 px right |
|---|---|---|---|
| `auth-login-light.png` | `LOGIN` button | `#ffffff` ×6 | `#ffffff` ×6 |
| `file-manager-light.png` | `Add New` button | `#fbfcfc`, then `#ffffff` ×5 | `#ffffff` ×6 |
| `tables-datatable-light-pagination.png` | active `Tables` nav item | clean, no falloff | — |

Not a trace of a shadow. **The 69 `box-shadow: none` / `none!important` rules win** — which is what
"the theme removes shadows more than it adds them" means in practice, and the row count in the table
above should be read that way rather than as eight shadows in use.

**The general lesson, which § Neutrals & Surfaces — Dark already states: where the CSS and the pixels
disagree, the pixels win.** A declaration in a 1.3 MB minified stylesheet is not evidence that it
reaches the screen. There is no `boxShadow.brand` token in `tailwind.config.ts` as a result, and the
config carries a comment saying why so nobody re-adds it from the CSS.

---

## 🔐 Login Screen Anatomy — the URL the owner shared

> ⚠️ **There are two login variants, and the one below is not the one we build.**
>
> This section describes the **centred** variant (`auth-login-light.png`): one card on a full-viewport
> brand wash. On **2026-08-05** the owner supplied `login.png` and `register.png`, which show Viho's
> **split-screen** variant — artwork panel left, wash panel with the card right. **The split-screen
> version is what the app implements.** See § Split-Screen Auth Anatomy below for the measured
> geometry; the card internals in this section are identical between the two and still apply.

`https://vue.pixelstrap.net/viho/auth/login`. Reconstructed from the `.login-*` rule set.

```
.login-card                      full-viewport flex centre
│  background: rgba(36,105,92,.1)      ← 10% brand wash, not white
│  height: 100vh; min-height: 100vh
│  padding: 30px 12px
│
└── .login-form                  the card
    │  width: 450px  (fixed, not max-width)
    │  padding: 30px
    │  background: #fff
    │  margin-inline: auto
    │
    ├── h4      "Login"                 22px / 600 / capitalize / mb 5px
    ├── h6      "Welcome back! Log in to your account."   14px / #999 / mb 25px
    │
    ├── .form-group  "Email Address"  (mb 20px, position:relative)
    │   ├── label            600 / capitalize / mb 5px
    │   └── .input-group
    │       ├── .input-group-text    bg #eaf0ef, border:none, icon in primary  ← ✉ glyph
    │       └── input               bg #fff; placeholder "test@admin.com"
    │                               transition all .3s ease; :focus box-shadow:none
    │
    ├── .form-group  "Password"
    │   └── .input-group
    │       ├── .input-group-text    same tinted fill            ← 🔒 glyph
    │       ├── input               masked
    │       └── "Show"              primary-coloured text toggle, INSIDE the field on the right
    │
    ├── .form-group
    │   ├── .checkbox      "Remember Password" — inline-block; label #999
    │   └── .link          float:right; weight 500; primary   ← "Forgot password?"
    │
    ├── .btn               "LOGIN" — uppercase / 700 / radius ~5px / margin-left:auto (right-aligned)
    │
    ├── .login-social-title              renders as "Sign in with"
    │   └── :before        1px #999 rule behind the text, z-index -1
    │       h5             16px / 600 / #999 / bg #fff, fit-content, centred
    │
    ├── ul.login-social                  flex, centred — LinkedIn, Twitter, Facebook, Instagram
    │   └── li             35×35px, bg #eff3f2, radius 5px, ml 10px
    │       └── a svg      16px wide, icon in primary
    │
    └── p                  600 / centred            ← "Don't have account? Create Account"
                                                       ("Create Account" is a primary-coloured link)
```

Measured from `auth-login-light.png`: page wash `#eaf0ef` (68.9% of the image), card `#ffffff`
(11.7%), input field fill `#ffffff`, addon fill `#eaf0ef`, button fill `#24695c`, social tile
`#eff3f2`. Every one matches the CSS-derived alpha values exactly — the extraction and the render
agree.

Details worth stealing:

- **The page background is a 10% brand wash, not white or grey.** Cheap, and it makes the white card
  read as elevated with no shadow at all. Our sign-in page is plain `bg-white dark:bg-gray-950`.
- **Icon-prefixed inputs via a tinted addon** — `rgba(36,105,92,.1)` fill, `border:none`, icon in full
  brand colour. Our `Input` has no addon slot; adding one is the main component gap.
- **`:focus { box-shadow: none }` on the login input** — the theme *removes* the focus ring here.
  ⚠️ **Do not copy.** `UI_PATTERNS.md`: *"Never `outline-none` without a replacement ring."* Keep our
  `focus:border-brand focus:ring-2 focus:ring-brand/20`.
- **Uppercase 700 submit button, right-aligned** via `margin-left:auto` — not full-width. Our
  `Button` has `fullWidth`, and our sign-in uses it; this is a deliberate difference to decide on.
- **The "Or Login With" divider** is a `:before` 1px rule with the heading sitting on an opaque `#fff`
  background to punch a hole through it. Works, but the hardcoded `#fff` is exactly why it breaks in
  dark mode — needs a `dark:` surface value if we port it.
- **A text "Show" toggle inside the password field**, in brand colour, rather than an eye icon. Cheap
  to build, unambiguous, and no icon licensing question. **Our sign-in has no reveal toggle at all** —
  this is a small, self-contained win worth taking regardless of the rebrand decision.
- **Fixed `width: 450px`** rather than `max-width` — technically not responsive below 474px; the
  `padding: 30px 12px` on the parent is what saves it. **Use `max-width: 450px` in ours.**

---

## 🪟 Split-Screen Auth Anatomy — what we actually build

Added **2026-08-05** from the owner's `login.png` and `register.png` (both 1917×933). **Measured, not
inferred** — pixel-sampled the same way as § Neutrals & Surfaces — Dark.

```
┌──────────────────────────────┬───────────────────────────┐
│  artwork panel               │  form panel               │
│  #ffffff                     │  #eaf0ef  (brand @ 10%)   │
│  faint decoration, centred   │   ┌───────────────────┐   │
│  illustration                │   │  card #ffffff     │   │
│                              │   │  450px, NO border │   │
│                              │   │  30px padding     │   │
│                              │   └───────────────────┘   │
└──────────────────────────────┴───────────────────────────┘
```

| Measurement | `login.png` | `register.png` |
|---|---|---|
| Artwork panel | `#ffffff`, 0 → 1120 (**58.4%**) | `#ffffff`, 0 → 800 (**41.7%**) |
| Form panel | `#eaf0ef`, 1120 → 1917 (**41.6%**) | `#eaf0ef`, 800 → 1917 (**58.3%**) |
| Card x-range | 1295 → 1744 → **450px wide** | 1135 → 1584 → **450px wide** |
| Card height | 515px | 599px |
| Card centred in form panel? | yes (175 / 173 gutters) | yes (335 / 333 gutters) |

Three findings that changed the build:

1. **The card has no border.** The pixel immediately outside it is the `#eaf0ef` wash and its own edge
   is pure `#ffffff` — there is no 1px rule and no shadow. The wash alone makes it read as raised. An
   earlier implementation added `border-surface-border` on the strength of `.card { border: 1px solid
   #e6edef }`; that rule is for *content* cards, not this one.
2. **The two screenshots disagree on the split** — 58/42 on login, 42/58 on register. Two different
   demo templates. We standardise on the **login** proportions (form panel 42%) for both.
3. **The card is exactly 450px**, confirming `.login-form { width: 450px }` renders literally.

Card-content histogram (login.png, inside the card) — every value is one already in this document,
which is a useful cross-check that nothing new is going on visually:

| Share | Hex | Role |
|------:|-----|------|
| 90.0% | `#ffffff` | card |
| 1.8% | `#eff3f2` | social tiles — brand @ 8% |
| 1.6% | `#24695c` | button, icons, links |
| 1.0% | `#eaf0ef` | input addon tiles — brand @ 10% |
| 0.7% | `#e6edef` | input borders |
| 0.2% | `#999999` | muted text + the divider rule |
| 0.1% | `#242934` | headings and labels |

### Register screen — differences from login

| Aspect | Register |
|---|---|
| Heading / subtitle | "Create Your Account" / "Enter your personal details to create account" |
| Name | **One "Your Name" label over a two-up First Name / Last Name pair**, each with a person-icon addon |
| Fields | Your Name (×2) → Email Address → Password. **No confirm-password field** — the `Show` toggle is the safeguard |
| Consent | **"Agree With Privacy Policy"** checkbox, "Privacy Policy" in brand colour |
| Submit | `CREATE ACCOUNT`, uppercase, right-aligned |
| Footer | "Already have an account? **Login**" |

### Button label asymmetry — easy to miss

The login card's heading reads **"Login"** but its button reads **"SIGN IN"**. Not a transcription
slip; both are visible in `login.png`.

### ⚠️ The illustrations are licensed and must not be copied

Viho's artwork is a paid theme asset. `assets/screenshots/README.md` forbids committing the theme's own
images — screenshots of rendered pages only. **Tracing the illustrations out of `login.png` /
`register.png` would produce a derivative of a paid asset in a public repo**, so that is off the table
too, not just copying the files.

What fills the slot instead is `components/auth/AuthArt.tsx` — **original inline SVG**, hand-authored in
the same *style* (flat vector, brand palette, floating "sticker" composition) and swapped per route.
Style is not the licensed part; the specific artwork is.

| Viho's art | Ours |
|---|---|
| Character illustration (person with phone / person thinking) | **No figures** — hand-coded humans read as amateurish, and the figure is the most distinctive part of Viho's art |
| Login: phone, padlock, plants, picture frames | Login: phone mockup with a login screen, padlock, plant, picture frames, leaf line-art, wave arcs |
| Register: floating notes, images, lightbulb, phone, mannequin | Register: browser-window card, lightbulb in a thought circle, phone checklist, sticky note, grid-paper note, image cards |

Every surface carries a `dark:` counterpart, so the panel works in both themes. Inline SVG means no
image requests — `/sign-in` First Load JS was unchanged at 174 kB after adding it. A commissioned or
licensed illustration can replace `<AuthArt />` without touching the layout.

---

## 🖥️ Dashboard Shell & Widget Patterns

From `dashboard-default-light-top.png`, `dashboard-default-light-bottom.png` and
`dashbaord1_darkmode.png`.

### Shell

| Region | Light | Dark | Notes |
|--------|-------|------|-------|
| Sidebar | `#ffffff` | `#111727` | 290px fixed, own scroll, hamburger collapse in the header |
| Header | `#ffffff` | `#111727` | Fixed, full width right of the sidebar |
| Page canvas | `#f5f7fb` | `#202938` | The only surface that scrolls |
| Card | `#ffffff` | `#111727` | 1px border `#e6edef` / `#142831` |

**Sidebar composition, top to bottom:** brand logo + wordmark → a **user profile block** (circular
avatar with a tinted ring, a "New" pill badge, name, department, and a three-up stat row
`19.8k Follow │ 2 year Experience │ 95.2k Follower` separated by thin vertical rules, with a gear icon
top-right) → then grouped nav under small **section labels** each followed by a horizontal rule.

The full group list, assembled from `bookmark-app-light.png` and `support-ticket-light-1-*.png` (the
dashboard shots only show the first two):

`General` · `Applications` · `Forms & Table` · `Components` · `Pages` *(Error Page, Authentication,
Coming Soon)* · `Miscellaneous` *(Gallery, Cards, Timeline, Maps, editor, Blog, Job Search, Learning,
FAQ, Knowledgebase, Support Ticket, Pricing, Maintenance)`*

That is a **six-group, ~40-item** sidebar. Ours has far fewer sections, so don't read Viho's density as
a target — read it as proof the pattern scales, and note that at this length the section labels and
rules are what make it navigable at all.

**Nav item states:**

| State | Treatment |
|-------|-----------|
| Default | Outline icon + label, muted text, chevron-right if expandable |
| Active (parent) | **Filled brand `#24695c`, white text, radius ≈9px**, chevron rotates down |
| Active child | Indented, no icon, brand-coloured text |
| Section label | Brand-coloured in light mode, muted grey in dark mode + rule beneath |

**Header, right to left:** a `Log out` button (pale tinted fill + icon — i.e. the `btn-primary-light`
pattern), chat, **dark-mode moon toggle**, notification bell with a red unread dot, bookmark star,
language globe, fullscreen expand. Search sits at the far left with a magnifier icon and a bare
`Search..` placeholder — no bordered input, just an icon and text on the header surface.

> A floating **theme-customiser panel** is pinned to the right edge in all three screenshots (3 stacked
> icons in a white rounded card). That is the demo's own settings widget — **not part of the product
> UI.** Ignore it.

### Widget patterns

| Widget | Anatomy |
|--------|---------|
| **Welcome banner** | Full-bleed brand `#24695c` fill with a faint confetti/geometric texture, white heading + body, white button with brand text, gear icon in a translucent circle top-right |
| **Stat card** | Centred: icon in a tinted circle (teal or tan, alternating) → large bold figure → muted label → arrow glyph + percentage in brand/tan. A very faint oversized watermark icon sits behind |
| **Area chart** ("Sales Overview") | Title left; headline value + arrow + comparison copy right. Brand stroke with a vertical gradient fill fading to transparent. Crosshair with a brand-filled value pill |
| **Radial/donut** ("Growth Overview") | Concentric arcs in teal + tan over a pale grey track ring, with a plain text key beside it |
| **Bar chart** ("User Activations") | Brand bars with tan used for emphasis months, each sitting on a **pale "ghost" track bar** showing the remaining capacity. In dark mode the ghost track goes near-white — high contrast |
| **Activity list** | Icon → title (600) + muted subtitle, `Edit` / `Delete` as plain text actions on the right. A `Today / Month` text toggle in the header. Dark mode adds row separators that light mode omits |
| **Data table** ("Recent Orders") | **Borderless** — no header fill, no row rules. Thumbnail in a tinted circle → name as a **brand-coloured link** → muted date → figure → an inline **sparkline** in its own column → bold value → status as **plain text** (`Done`), not a badge. Rows ~65px |
| **Footer** | `Copyright 2022-23 © viho All rights reserved.` left, `Hand crafted & made with ♥` right |

Three things here are worth calling out against our own patterns:

1. **Ghost/track bars behind real bars** communicate "of a maximum" without a second axis. Cheap and
   effective; we have nothing like it.
2. **The dashboard widget renders status as plain text, not a badge** — but this turns out to be a
   *widget* shortcut, not the theme's table convention. The real index pages use badges. See
   § Index Pages & Data Tables. **Keep our `Badge`.**
3. **Sparklines inside table cells.** Our `DataTable` has no cell-renderer story for this. It would be
   a real feature addition, not a style tweak — worth noting before anyone promises it from a mockup.

> ⚠️ **Correction.** An earlier draft claimed "charts use exactly two categorical colours — brand teal
> and tan." **That is wrong.** The chart and widget pages show a **six-tone** categorical set, and the
> radar/bubble charts add gold as a third series. The full set is documented in
> § Semantic Tones as a Categorical Palette below, measured from real fills.

---

## 🎯 Semantic Tones as a Categorical Palette

The Support Ticket page settles what the semantic colours actually *do*. Six stat cards each carry a
progress bar, and the six fills — sampled directly, 3000 pixels each, no antialiasing ambiguity — are
exactly the six `.btn-*` tones:

| Card | Sampled fill | Token |
|------|--------------|-------|
| Order | `#24695c` | `primary` |
| Pending | `#ba895d` | `secondary` |
| Running | `#e2c636` | `warning` |
| Smooth | `#707070` | `info` (`#717171` in CSS; 1-value render difference) |
| Done | `#1b4c43` | `success` |
| Cancle *(sic)* | `#d22d3d` | `danger` |

So the six tones are **the categorical palette** — used for progress bars, calendar event pills, kanban
column headers, badges and chart series alike. Charts add gold (`#e2c636`) as a third series alongside
teal and tan, visible in the radar and bubble charts.

**What this changes for us:** our `Badge` has 6 tones, so the *count* matches. But the theme's
`success` and `primary` are near-indistinguishable (`#1b4c43` vs `#24695c` — both dark teal), and its
`info` is grey. As a **categorical** palette that is poor: two of six series look alike and one reads
as disabled. As a **semantic** palette it is worse still. Our substitution (emerald `success`, sky
`info`) fixes both — keep it, and treat Viho's six as evidence of *structure*, not of hue choice.

### Soft (tinted) badge variant — a derivable rule

The Todo page uses a second badge style: **tinted fill with the solid tone as text.** Measured:

| Label | Fill | Text | Formula |
|-------|------|------|---------|
| `In progress` | `#d5e2df` | `#24695c` | primary at **20%** over white |
| `Pending` | `#f6d7da` | `#d22d3d` | danger at **20%** over white |
| `Done` | `#d4dcdb` | `#1b4c43` | success at **20%** over white |

Every one composites to within 1–3 values of `tone @ 20%` on `#ffffff`. So the rule is simply:

```
soft badge  =  background: tone/20   +   color: tone
solid badge =  background: tone      +   color: #fff
```

In Tailwind that is `bg-brand/20 text-brand` versus `bg-brand text-white` — no new tokens needed. Our
`Badge` currently has one style per tone; **this is a cheap, genuinely useful addition** (soft for
passive states, solid for emphasis) and it is the single most reusable thing in this batch.

Kanban uses the solid variant (`Argent` → `#d22d3d`, `Low` → `#1b4c43`), confirming both styles
coexist in the same design language.

---

## 📋 Index Pages & Data Tables — the open question, answered

`tables-basic-light.png` and `tables-datatable-light-pagination.png` settle what the dashboard's
borderless "Recent Orders" widget left ambiguous. **Viho's real index pages are conventional tables,
and they are much closer to our mandatory spec than the widget suggested.**

| Aspect | Viho's index tables | Our spec (`UI_PATTERNS.md`) | Verdict |
|--------|--------------------|-----------------------------|---------|
| Header row | Bold dark labels, **no fill**, bottom border | Sticky, opaque background | Ours differs (we need opacity for sticky) |
| Row separators | **1px `#e6edef`** under each row — measured | — | Adopt: same colour as our card border |
| Row fill | `#ffffff`, no zebra striping | — | Adopt |
| First column | `#` index | `#` first | ✅ **Match** |
| Actions column | Three-dot vertical menu (`⋮`) | `RowActions` three-dot menu | ✅ **Match** — though Viho puts it **last**, we put it **second** |
| Status | **Badge** (see soft/solid above) | `Badge`, click-to-toggle | ✅ **Match** — the widget's plain text was the exception |
| Page-size control | `Show [10 ▾] entries` — native select, top-left | `useAutoPerPage()`, viewport-derived | **Conflict** — ours is automatic, theirs manual |
| Search | Plain input + a **tan `Clear` button** | Debounced 500ms + always-visible Reset | Compatible; ours is better specified |
| Pagination | `Previous 1 2 3 … Next`, **active page = solid `#24695c` squared tile**, inactive on white | Dual pagination, top and bottom | Adopt the tile styling; keep our dual placement |

**Measured details worth copying:**
- Row divider: `#ffffff` → `#e6edef` (exactly 1px) → `#ffffff`. Same value as the card border, so the
  whole surface system uses **one** border colour.
- Active pagination tile: solid `#24695c`, white label, square corners — consistent with cards being
  squared while buttons are rounded.
- The Support Ticket table pairs an avatar, a name, a **semantic-coloured skill bar** and an email in
  one row — a good reference for mixing a visual cell type into an otherwise textual table.

**The one real conflict is page size.** Viho asks the user (`Show 10 entries`); we derive it from
viewport height via `useAutoPerPage()`'s `floor((h − 433) / 38)`. Ours is better for dense admin work
and is already mandatory, so **keep it** — but note that if we adopt Viho's 30px card padding, the 433
constant needs re-measuring (§ Adoption Decision, item 4).

---

## 📝 Form Patterns

From `project-create-new-light-form.png`, `users-edit-light-form.png` and `form-validation-light.png`.

| Aspect | Viho |
|--------|------|
| Label position | **Above** the control, always. No floating or inline labels anywhere |
| Label style | ~14px, weight 500–600, colour `#59667a` |
| Label → control gap | ~5px |
| Field → field gap | 20px (`.theme-form .form-group`) |
| Control fill | `#ffffff` with a `#e6edef` border, radius ~5px |
| Grid | Full-width for long fields (title, address, textarea); **2-up or 3-up** for short ones (rate/type/priority, city/postal/country) |
| Select | Native `<select>` with the OS chevron — same choice we made |
| Date | Native `<input type="date">` with the browser's calendar glyph |
| Textarea | Same border treatment, ~4 rows, resize handle visible |
| Required marker | An asterisk in the **placeholder** (`Project name *`), not on the label |
| Upload | **Dashed `#24695c` border, tinted `#eaf0ef` fill, centred "Drop here"** — a distinctive drop zone |
| Submit row | Right-aligned, **outside** the field area, sometimes in its own card footer |
| Button pairing | `Add` in **secondary tan** + `Cancel` in **danger red**; elsewhere a single `Update Profile` / `Save` in primary |

Three notes:

1. **`Add` as tan and `Cancel` as red is a poor pairing** — red for a non-destructive cancel trains
   users to fear it, and the primary action being secondary-coloured buries it. Our `Button` has
   `primary`/`outline`; the right mapping is **primary for the affirmative, outline for cancel**. Don't
   copy this one.
2. **The asterisk-in-placeholder trick fails accessibility** — placeholders vanish on input, so the
   "required" signal disappears exactly when the user is filling the field. Our `Input` requires a real
   `label`; put the marker there.
3. **The dashed tinted drop zone is worth taking** as-is. We have no upload component; this is a clear,
   cheap pattern (`border-2 border-dashed border-brand bg-brand/10`).

`form-validation-light.png` shows the resting state of Bootstrap's validation page but **no field is in
an error state** — the form has not been submitted. So **error styling is still undocumented**; see
§ Still Needed.

---

## 🧩 Component Anatomy Notes

| Component | Viho specifics |
|-----------|----------------|
| `.card` | 30px padding, `radius 0`, `1px solid #e6edef`, `mb 30px`, `letter-spacing .5px`, header `background:#fff` and `border-bottom:none` |
| `.card-header` | Also 30px padding — header and body use the **same** padding, so content aligns in a single column |
| `.card-absolute` | Header floated `top:-20px` outside the card with its own radius — a distinctive "tab" treatment |
| `.btn` | 14px / 600 / `.375rem 1.75rem`. Wide horizontal padding relative to height |
| `.btn-primary-light` | Tinted-fill variant: `bg rgba(36,105,92,.1)`, `border:none`, brand text; hover → `rgba(36,105,92,.5)` + white text, `.5s`. **We have no equivalent — worth adding** |
| `.badge` | `.44em .7em`, `line-height 1.3` |
| `.form-label` | weight 500, colour `#59667a` |
| `.input-group-text` | `border-color #e6edef`, weight 500 |
| `.page-main-header` | `position:fixed`, `z-index 9`, `bg #fff`, `box-shadow 0 0 20px rgba(25,124,207,.08)`, `transition .5s` |
| `.page-sidebar` | `position:fixed`, **290px**, `bg #fff`, `overflow-y:auto`, `z-index 9`, `transition all .5s ease`; collapses to `left:-290px` |

**Underlying framework: Bootstrap 5** — `vendors.css` is full of `--bs-*` custom properties and
`.form-control` resolves to `var(--bs-body-bg)` / `var(--bs-border-color)`. So Viho's spacing comes
from Bootstrap's scale, **not** Tailwind's. Values like `.375rem 1.75rem` and `.44em .7em` have no
exact Tailwind utility — expect to use arbitrary values (`px-[1.75rem]`) or round to the nearest step.
Rounding is usually right; don't chase pixel parity at the cost of leaving our scale.

---

## 🗺️ Screen Inventory

**153 distinct routes** in the demo's `app.725fa130.js`. Categories, so we know what reference
material exists before designing a screen from nothing:

| Group | Screens |
|-------|---------|
| Dashboards | default, ecommerce, general, chart |
| Project | list, create |
| Apps | file manager, kanban, email, chat, video chat, bookmark, todo, calendar, social |
| Ecommerce | product grid, details, cart, checkout, wishlist, invoice, payment details, order history, add product |
| Users | profile, edit, cards |
| Forms | validation, inputs, checkbox/radio, input groups, mega options, select2, switch, touchspin, typeahead, clipboard, **wizard**, datepicker |
| Tables | basic, sizing, border, styling, datatable |
| UI kits | typography, avatars, helper classes, grid, tag/pills, progress, modal, alert, popover, tooltip, loader, accordion, box-shadow, lists, dropdown |
| Pages | sample, FAQ, support, pricing, search, knowledgebase, maintenance, coming-soon ×3, error ×4 |

Most relevant to our roadmap: **Users profile/edit/cards**, **form wizard** (partner onboarding),
**datatable/table styling** (our index pages), **pricing** (partner tiers), **invoice** (quotes).

---

## 🔄 Mapping to Our Stack

Our stack per `UI_PATTERNS.md`: **Tailwind 3.4.19**, `darkMode: "class"` on `<html>`, Inter via
`next/font`, hand-rolled primitives in `components/common/`, no component library. Viho is
**Vue 3 + Bootstrap 5 + SCSS**. Nothing transfers as code — only values.

If the owner approves the direction, this is the `tailwind.config.ts` shape (**proposal, not applied**):

```ts
// theme.extend.colors
brand: {
  DEFAULT: "#24695c",   // Viho --theme-deafult (typo is theirs; ours spelled correctly)
  dark:    "#17433b",   // Viho's own darker shade — hover
  darker:  "#10302a",
  light:   "#236559",
},
accent: {
  DEFAULT: "#ba895d",   // Viho --theme-secondary
  dark:    "#a07044",
  light:   "#d1b093",
},
surface: {
  page:    "#f5f7fb",   // light body
  card:    "#ffffff",
  border:  "#e6edef",
  divider: "#efefef",
},
ink: {
  DEFAULT: "#242934",   // body text
  label:   "#59667a",
  muted:   "#6b7280",   // OURS (gray-500) — Viho's #999 fails contrast at 2.85
},
night: {
  body:    "#202938",   // dark body
  card:    "#111727",   // dark surface
  muted:   "#98a6ad",
},
```

Deliberate deviations baked into that proposal:

| Viho | Our proposal | Why |
|------|--------------|-----|
| `success #1b4c43` (a primary shade) | keep Tailwind `emerald` | Success must not look like a normal action |
| `info #717171` (grey) | keep Tailwind `sky`/`blue` | Grey info reads as disabled |
| muted `#999999` | `#6b7280` | 2.85 fails AA; ours is 4.83 |
| warning text `#fff` | `#242934` on warning | 1.70 → 8.58 |
| `--theme-deafult` | `brand` | Don't propagate a typo into our config |

### ⚠️ Correction 2026-08-05 — the rebrand cost was understated by an order of magnitude

An earlier version of this section said `UI_PATTERNS.md` § Known Issues records that **`Button.tsx` and
`Input.tsx`** hardcode `#F97316`, and that a rebrand needs "those two files" migrated first. **Both
this document and `UI_PATTERNS.md` were wrong.** Measured against commit `b144c24`:

```bash
grep -ro 'F97316\|EA6C0A'       app components   # 151 occurrences, 37 files
grep -ro 'orange-[0-9]\{2,3\}'  app components   #  91 occurrences, 18 files
                                         union   # 242 occurrences, 37 files
```

**37 of the frontend's 85 `.tsx` files — 44% — paint the brand colour by hand. Only 6 files use the
`brand` token at all.**

Two things the original claim missed:

1. **The `orange-*` Tailwind utilities are brand colour too**, and a hex grep never sees them —
   `bg-orange-50`, `dark:bg-orange-950/40`, `hover:text-orange-400`. They are 91 of the 242.
2. **Nine distinct orange shades are in use** (`orange-50` ×27, `950` ×26, `400` ×23, `600` ×6,
   `500` ×4, `700` ×2, and one each of `100/200/900`) where the token defines two. So the token layer
   needs a real tint ladder, not a `DEFAULT`/`dark` pair.

The single heaviest file is `components/dashboard/Sidebar.tsx` at **46** occurrences — more than
`Button.tsx` and `Input.tsx` combined ×5.

**A rebrand is therefore not a one-line config change and not a two-file migration.** The mitigation
is sequencing, not effort: migrate every call site to tokens *while still orange*, then flip the
values in one commit. Full phase order in [`VIHO_ADOPTION_PLAN.md`](./VIHO_ADOPTION_PLAN.md) — which
also notes that **85 of the 242 occurrences sit in inherited screens already scheduled for deletion**,
so a third of this debt can be retired rather than migrated.

---

## ✅ Adoption Decision — DECIDED 2026-08-05

**The project owner chose full Viho fidelity: all four conflicts adopted, plus the card spacing.** The
product should look like Viho, not like a compromise between Viho and what we have.

| # | Conflict | Viho | Our previous standard | **Decision** |
|---|----------|------|-----------------------|--------------|
| 1 | **Brand hue** | Teal `#24695c` + tan `#ba895d` | Orange `#F97316` | ✅ **Adopt** |
| 2 | **Surface radius** | `0` on cards (controls stay rounded) | `rounded-lg` everywhere | ✅ **Adopt** |
| 3 | **Body font** | Montserrat 14px | Inter, `text-sm` | ✅ **Adopt** |
| 4 | **Dark elevation** | Cards **darker** than page (`#111727` on `#202938`) | Cards **lighter** than page (`gray-800` on `gray-950`) | ✅ **Adopt** — the inversion is the point |
| 4b | **Card spacing** | 30px padding + 30px bottom margin | Denser | ✅ **Adopt** |

The structural ideas that were never in conflict — brand-wash page background, tinted input addon, the
`btn-primary-light` variant, soft badges, coloured shadows — are in scope too.

This also settles the earlier recommendation against a *partial* adoption. The worry was two visual
languages in one app; full adoption removes it.

**Consequences that are easy to miss:**

- **Item 4b has a functional consequence.** Our mandatory full-height index layout
  (`UI_PATTERNS.md` § Full-Page Index Layout) is tuned around `useAutoPerPage()`'s
  `floor((h − 433) / 38)`. Changing card padding changes how many rows fit, so **that 433 constant
  must be re-measured** — by rendering, not by arithmetic.
- **Item 1 is not a config change.** See the corrected cost in § Mapping to Our Stack below: **242
  brand-colour occurrences across 37 files**, not the two files this document previously claimed.
- **Four accessibility carve-outs are proposed** against literal 100% fidelity — white-on-warning at
  1.70, `#999` muted at 2.85, white-on-tan at 3.08, and the removed focus ring. They are listed as
  E1–E4 in the adoption plan and are **still open for the owner to veto**.

➡️ **The sequenced implementation plan is [`VIHO_ADOPTION_PLAN.md`](./VIHO_ADOPTION_PLAN.md).** It
carries the measured costs, the phase order and the remaining open decisions. This document stays what
it has always been: the record of *what Viho looks like*, not of what we have built.

---

## 📎 Screenshot Catalogue — 36 references

All screenshots live in **[`assets/screenshots/`](./assets/screenshots/)**. Paths below are relative to
**this file**, so they work when read from `documentation/design/`.

**How to use this section:** find the component or screen you are about to build in the
*"When you're building…"* table, open the screenshot it names, and study the real thing before writing
Tailwind. The measured values are already in the sections above — the screenshot is for the
*composition* the numbers can't convey.

### When you're building… → open this

| You're building | Open | Also useful |
|-----------------|------|-------------|
| **Sign-in / auth page** | [`login.png`](./assets/screenshots/login.png) — **the split-screen variant we build** | § Split-Screen Auth Anatomy; [`auth-login-light.png`](./assets/screenshots/auth-login-light.png) for the centred variant |
| **Register / sign-up page** | [`register.png`](./assets/screenshots/register.png) | § Split-Screen Auth Anatomy → Register screen |
| **An index / list page with a table** | [`tables-datatable-light-pagination.png`](./assets/screenshots/tables-datatable-light-pagination.png) | [`tables-basic-light.png`](./assets/screenshots/tables-basic-light.png), [`support-ticket-light-2-table-pagination.png`](./assets/screenshots/support-ticket-light-2-table-pagination.png) |
| **A table row with an actions menu** | [`tables-basic-light.png`](./assets/screenshots/tables-basic-light.png) — "Inverse Table" has the `⋮` column | § Index Pages & Data Tables |
| **A create / edit form** | [`project-create-new-light-form.png`](./assets/screenshots/project-create-new-light-form.png) | [`users-edit-light-form.png`](./assets/screenshots/users-edit-light-form.png), [`form-validation-light.png`](./assets/screenshots/form-validation-light.png) |
| **A file upload / drop zone** | [`project-create-new-light-form.png`](./assets/screenshots/project-create-new-light-form.png) — dashed tinted zone | § Form Patterns |
| **Badges / status pills** | [`todo-light-soft-badges.png`](./assets/screenshots/todo-light-soft-badges.png) — soft variant | [`kanban-board-light-1-default.png`](./assets/screenshots/kanban-board-light-1-default.png) — solid variant |
| **Progress bars / meters** | [`support-ticket-light-1-progress-tones.png`](./assets/screenshots/support-ticket-light-1-progress-tones.png) — all 6 tones | [`widgets-general-dark-3-tables-employee-status.png`](./assets/screenshots/widgets-general-dark-3-tables-employee-status.png) — in-table skill bars |
| **Stat / KPI cards** | [`widgets-general-dark-1-kpi-calendar-weather.png`](./assets/screenshots/widgets-general-dark-1-kpi-calendar-weather.png) | [`dashboard-default-light-top.png`](./assets/screenshots/dashboard-default-light-top.png) |
| **Charts (area, bar, radial)** | [`widgets-chart-dark-1-area-bar-radial.png`](./assets/screenshots/widgets-chart-dark-1-area-bar-radial.png) | [`widgets-chart-dark-2-radar-bubble.png`](./assets/screenshots/widgets-chart-dark-2-radar-bubble.png), [`widgets-chart-dark-3-candlestick.png`](./assets/screenshots/widgets-chart-dark-3-candlestick.png) |
| **Sidebar / app shell** | [`dashboard-default-light-top.png`](./assets/screenshots/dashboard-default-light-top.png) | [`bookmark-app-light.png`](./assets/screenshots/bookmark-app-light.png) — shows all nav groups |
| **Dark mode anything** | [`dashboard-default-dark.png`](./assets/screenshots/dashboard-default-dark.png) | the four `widgets-*-dark-*` shots |
| **A user profile page** | [`users-profile-light-1-cover.png`](./assets/screenshots/users-profile-light-1-cover.png) | [`users-profile-light-2-social-buttons.png`](./assets/screenshots/users-profile-light-2-social-buttons.png), [`users-profile-light-3-photos-friends.png`](./assets/screenshots/users-profile-light-3-photos-friends.png) |
| **A card grid / directory** | [`users-cards-light.png`](./assets/screenshots/users-cards-light.png) | [`file-manager-light.png`](./assets/screenshots/file-manager-light.png) |
| **Pricing / tier selection** | [`pricing-light-1-simple-cards.png`](./assets/screenshots/pricing-light-1-simple-cards.png) | [`pricing-light-2-feature-cards.png`](./assets/screenshots/pricing-light-2-feature-cards.png) |
| **A two-pane app (list + detail)** | [`email-app-light-1.png`](./assets/screenshots/email-app-light-1.png) | [`file-manager-light.png`](./assets/screenshots/file-manager-light.png), [`todo-light-soft-badges.png`](./assets/screenshots/todo-light-soft-badges.png) |
| **A board / drag-drop UI** | [`kanban-board-light-1-default.png`](./assets/screenshots/kanban-board-light-1-default.png) | [`kanban-board-light-2-custom-boards.png`](./assets/screenshots/kanban-board-light-2-custom-boards.png) |
| **Calendar / scheduling** | [`calendar-light-event-tones.png`](./assets/screenshots/calendar-light-event-tones.png) | — |
| **Search results** | [`search-website-light.png`](./assets/screenshots/search-website-light.png) | — |
| **Button colour pairings** | [`kanban-board-light-3-api-buttons.png`](./assets/screenshots/kanban-board-light-3-api-buttons.png) | § Form Patterns note 1 |

### Full index

**Auth & dashboard (6)**

| File | Screen | What to notice |
|------|--------|----------------|
| [`login.png`](./assets/screenshots/login.png) | `/auth/login`, **split-screen** | **The variant the app implements.** Artwork panel `#ffffff` left, `#eaf0ef` wash right, card exactly **450px with no border**, centred in the wash panel. Heading "Login" but button **"SIGN IN"**. Tinted icon addons, `Show` toggle, 4 social tiles |
| [`register.png`](./assets/screenshots/register.png) | `/auth/register`, **split-screen** | "Create Your Account"; **one "Your Name" label over a two-up First/Last pair** with person addons; **no confirm-password field**; **"Agree With Privacy Policy"** checkbox; `CREATE ACCOUNT` right-aligned |
| [`auth-login-light.png`](./assets/screenshots/auth-login-light.png) | `/auth/login`, **centred** | The *other* variant — one card on a full-viewport wash. Page wash `#eaf0ef`, **square card, no shadow**, tinted icon addons, right-aligned uppercase button, `Show` password toggle, 4 social tiles |
| [`dashboard-default-light-top.png`](./assets/screenshots/dashboard-default-light-top.png) | `/dashboard/default` upper | Sidebar profile block, filled+rounded active nav, brand welcome banner, stat cards, gradient area chart |
| [`dashboard-default-light-bottom.png`](./assets/screenshots/dashboard-default-light-bottom.png) | `/dashboard/default` lower | Borderless widget table with in-cell sparklines, radial chart, tan area chart, footer |
| [`dashboard-default-dark.png`](./assets/screenshots/dashboard-default-dark.png) | `/dashboard/default` dark | **Inverted elevation** — cards `#111727` darker than the `#202938` page; `#142831` brand-tinted borders; near-white ghost bars |

**Widgets — General, dark, top→bottom (4)**

| File | What to notice |
|------|----------------|
| [`widgets-general-dark-1-kpi-calendar-weather.png`](./assets/screenshots/widgets-general-dark-1-kpi-calendar-weather.png) | **4 colour-filled KPI tiles** (teal/tan/teal/teal) with oversized watermark icons; date picker; clock-over-photo; weather widget; 4-up sale stat grid |
| [`widgets-general-dark-2-profile-activity-social.png`](./assets/screenshots/widgets-general-dark-2-profile-activity-social.png) | Testimonial card; **letter-avatar activity list**; profile cover card with 3-up stats; **circular-progress social cards**; browser-usage cards |
| [`widgets-general-dark-3-tables-employee-status.png`](./assets/screenshots/widgets-general-dark-3-tables-employee-status.png) | **Bordered table with badge cells** (`PRODUCTS CART`); `EMPLOYEE STATUS` with avatar + **semantic skill bars** + experience |
| [`widgets-general-dark-4-contact-form.png`](./assets/screenshots/widgets-general-dark-4-contact-form.png) | **A form in dark mode** — labelled inputs, textarea, `SEND IT` button; image card with a floating date badge; footer |

**Widgets — Chart, dark, top→bottom (3)**

| File | What to notice |
|------|----------------|
| [`widgets-chart-dark-1-area-bar-radial.png`](./assets/screenshots/widgets-chart-dark-1-area-bar-radial.png) | 3 headline area-spark cards (teal/tan/teal); **grouped bar chart with a 2-series legend**; radial gauge with a centred check + 3-up footer stats |
| [`widgets-chart-dark-2-radar-bubble.png`](./assets/screenshots/widgets-chart-dark-2-radar-bubble.png) | Dual-axis area chart with zoom toolbar; **radar chart — 3 series incl. gold**; **bubble chart — 4 series** |
| [`widgets-chart-dark-3-candlestick.png`](./assets/screenshots/widgets-chart-dark-3-candlestick.png) | **Candlestick chart** using teal/tan for up/down instead of the usual green/red |

**Forms & tables (5)**

| File | What to notice |
|------|----------------|
| [`project-create-new-light-form.png`](./assets/screenshots/project-create-new-light-form.png) | The reference form: labels above, full-width + 3-up grid mix, native select/date, **dashed tinted upload zone**, `Add`(tan)/`Cancel`(red) footer |
| [`users-edit-light-form.png`](./assets/screenshots/users-edit-light-form.png) | **Two-card layout** — narrow "My Profile" + wide "Edit Profile"; 3-up and 2-up field grids; `Update Profile` in a card footer |
| [`form-validation-light.png`](./assets/screenshots/form-validation-light.png) | Validation page **at rest** — `@` input-group prefix, checkbox, `Submit form`. ⚠️ **No error state shown** |
| [`tables-basic-light.png`](./assets/screenshots/tables-basic-light.png) | Two tables: plain, and one with an **`⋮` Action column**. `#` first column, **1px `#e6edef` row dividers**, no zebra |
| [`tables-datatable-light-pagination.png`](./assets/screenshots/tables-datatable-light-pagination.png) | Full DataTable — `Show [10] entries`, **`Previous 1 2 3 … Next` with the active page a solid squared `#24695c` tile** |

**Badges, tones & components (4)**

| File | What to notice |
|------|----------------|
| [`todo-light-soft-badges.png`](./assets/screenshots/todo-light-soft-badges.png) | **Soft badge variant** — `tone/20` fill + solid tone text; strikethrough on completed rows; counter badges in the side nav |
| [`kanban-board-light-1-default.png`](./assets/screenshots/kanban-board-light-1-default.png) | **Solid badges** (`Argent` `#d22d3d`, `Low` `#1b4c43`); card meta row with icon counts + avatar stack |
| [`kanban-board-light-2-custom-boards.png`](./assets/screenshots/kanban-board-light-2-custom-boards.png) | **Colour-filled column headers** (teal / gold / tan) with matching tinted column bodies |
| [`kanban-board-light-3-api-buttons.png`](./assets/screenshots/kanban-board-light-3-api-buttons.png) | Three solid buttons side by side — teal, tan, red. Good reference for button colour pairing (and its problems) |

**Support, calendar & apps (5)**

| File | What to notice |
|------|----------------|
| [`support-ticket-light-1-progress-tones.png`](./assets/screenshots/support-ticket-light-1-progress-tones.png) | **All 6 semantic tones as progress fills** — the source of § Semantic Tones. Profit/Loss delta rows |
| [`support-ticket-light-2-table-pagination.png`](./assets/screenshots/support-ticket-light-2-table-pagination.png) | Search + **tan `Clear` button**, `Show N entries`, avatar + **semantic skill bar** + email in one row, `Previous 1 2 3 Next` |
| [`calendar-light-event-tones.png`](./assets/screenshots/calendar-light-event-tones.png) | **Draggable event pills in 5 tones**; month/week/day segmented toggle; today-cell highlight in pale gold |
| [`todo-light-soft-badges.png`](./assets/screenshots/todo-light-soft-badges.png) | *(see above)* also the `Add Task` inline composer |
| [`email-app-light-1.png`](./assets/screenshots/email-app-light-1.png) · [`email-app-light-2.png`](./assets/screenshots/email-app-light-2.png) | Three-pane mail layout; full-width primary `NEW MAIL`; counted nav list; attachment thumbnails; `Reply / Reply All / Forward` text actions. The two shots are near-identical |

**Profile, cards & content (7)**

| File | What to notice |
|------|----------------|
| [`users-profile-light-1-cover.png`](./assets/screenshots/users-profile-light-1-cover.png) | Cover photo + **overlapping white profile card**, avatar with edit pencil, 3-up stat row, `About Me` icon list |
| [`users-profile-light-2-social-buttons.png`](./assets/screenshots/users-profile-light-2-social-buttons.png) | **Real brand-colour social buttons** (Facebook navy, Twitter blue, Dribbble red) — an explicit exception to teal/tan; follower lists; post cards |
| [`users-profile-light-3-photos-friends.png`](./assets/screenshots/users-profile-light-3-photos-friends.png) | Photo grid, avatar grid, collapsible card headers with chevrons |
| [`users-cards-light.png`](./assets/screenshots/users-cards-light.png) | **Card grid**: tinted cover image, overlapping circular avatar, social icon row, 3-up divided stat footer |
| [`file-manager-light.png`](./assets/screenshots/file-manager-light.png) | **Pill nav list** (active = filled teal, rest = `#e6edef`), storage meter, plan card with `Selected` badge, `Add New`(solid)/`Upload`(outline) pair, **multi-colour file-type icons**, folder cards with `⋮` |
| [`bookmark-app-light.png`](./assets/screenshots/bookmark-app-light.png) | Grid/list view toggle, thumbnail cards with links, tag list. **Also the fullest sidebar** — shows the `Forms & Table` and `Components` nav groups |
| [`search-website-light.png`](./assets/screenshots/search-website-light.png) | Search bar with attached primary button, **segmented tab row**, result list with star ratings, featured media card |

**Pricing (2)**

| File | What to notice |
|------|----------------|
| [`pricing-light-1-simple-cards.png`](./assets/screenshots/pricing-light-1-simple-cards.png) | 4-up plan cards: big price, underline accent, **full-bleed edge-to-edge `Purchase` button** as the card footer |
| [`pricing-light-2-feature-cards.png`](./assets/screenshots/pricing-light-2-feature-cards.png) | Tinted header with a **diamond price medallion**, feature list with bold values + muted labels, `Subscribe` button |

**All colour values in this document have been cross-checked against these renders.** Where the CSS and
the pixels disagreed, the pixels won and the discrepancy is noted inline — see § Neutrals & Surfaces —
Dark, § Radius, and the correction note in § Dashboard Shell.

### Still needed

The catalogue now covers the shell, auth, dashboards, widgets, charts, forms, index tables, badges,
calendar and pricing. Four gaps remain, and they are small:

| Priority | Missing | Why it still matters |
|:--------:|---------|----------------------|
| **1** | **Input error / invalid states** — submit `/form/validation` so `:invalid` styling renders | Still completely undocumented. Our `Input` has a defined error style; we cannot compare. Error styling is not optional work |
| **2** | **`/form/wizard`** (multi-step) | Partner onboarding is multi-step and we have **no** stepper. Nothing here shows step indicators |
| **3** | **A modal open** (`/uikits/modal`) | No reference for overlay colour, header/footer treatment or width. Modals are where a wrong radius shows most |
| **4** | **A dropdown / `⋮` menu open** | We see the closed `⋮` trigger in the tables but never the open menu |
| — | `/uikits/alert` | Now **low value** — the 6 tones are fully documented from the progress bars and badges |
| — | Login in dark mode | Still low value; its divider hardcodes `background:#fff`, so it likely breaks there anyway |

Everything else previously on this list has been answered. **Not needed:** more dashboard variants, or
mobile widths unless a specific responsive question comes up.

---

## Related Documentation

- [`../system-design/UI_PATTERNS.md`](../system-design/UI_PATTERNS.md) — **our** design system; authoritative where the two disagree
- [`../system-design/NEXTJS_STANDARDS.md`](../system-design/NEXTJS_STANDARDS.md) — page composition
- [`../planning/MARKETPLACE_DOMAIN_PLAN.md`](../planning/MARKETPLACE_DOMAIN_PLAN.md) — which screens we actually need
- [`../planning/TECH_DEBT.md`](../planning/TECH_DEBT.md) — the hardcoded-hex debt a rebrand must clear first

---

**Extracted:** 2026-08-03 · **Source:** `app.44f0a026.css`, `chunk-vendors.792549f7.css`,
`app.725fa130.js` · **Re-verify when those content hashes change.**
