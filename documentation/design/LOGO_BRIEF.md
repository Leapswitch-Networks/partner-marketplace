# Logo Brief — Partner Marketplace

> Hand this whole file to whoever is making the logo. Every hex is copied from
> `frontend/app/globals.css` and `backend/app/core/theme.py`, and every contrast
> ratio below was computed, not estimated.

---

## 1. The two surfaces the logo must survive

The app has a light and a dark theme, switched by the user. The logo sits on the
**sidebar/header surface**, which is not the page background:

| | Light theme | Dark theme |
|---|---|---|
| **Surface the logo sits on** | `#ffffff` | `#111727` |
| Page canvas behind it | `#f5f7fb` | `#202938` |
| Hairline borders | `#e6edef` | `#142831` |

Note the dark theme is **inverted** — the card/sidebar (`#111727`) is *darker*
than the page (`#202938`). That is deliberate, not a mistake.

## 2. Where it appears, and how small it gets

| Placement | Rendered size |
|---|---|
| Sidebar header mark | **32×32 px** (40×40 on very large screens) |
| Sign-in artwork panel | 64×64 px |
| Favicon | 16×16 / 32×32 px |

**32px is the real design constraint.** Anything with fine detail, thin strokes or
a wordmark inside the mark will turn to mush. Design at 32px first and scale up.

## 3. File requirements — read before exporting

These are enforced by the upload endpoint (`app/core/images.py`):

| | |
|---|---|
| **Logo formats** | **PNG, JPEG or WebP.** **SVG is rejected** |
| Favicon formats | PNG or ICO |
| Max file size | **512 KB** |
| Max dimensions | **2048 × 2048 px** |
| Background | **PNG with transparency preferred** |

> ⚠️ **There is only ONE logo slot.** The app stores a single `logo` asset — you
> cannot supply a light version and a dark version and have it swap. **The one file
> must work on both `#ffffff` and `#111727`.** This is the single most important
> constraint in this document.

Deliver **1024×1024 PNG with transparency**, plus a 512×512 and a 32×32 ICO/PNG
favicon.

## 4. The palette

### Default brand (the "Teal" preset — what ships today)

| Token | Hex | Use |
|---|---|---|
| **brand** | **`#24695c`** | The primary mark colour in light mode |
| brand-dark | `#17433b` | Hover / deeper shade |
| brand-darker | `#10302a` | Deepest shade |
| brand-light | `#236559` | Subtle variation |
| **brand-on-dark** | **`#5ec8b4`** | The brand colour **for dark surfaces** |
| **accent** | **`#ba895d`** | Secondary — a warm tan |
| accent-dark | `#a07044` | |
| accent-light | `#d1b093` | |

### Neutrals

| Token | Hex |
|---|---|
| ink (primary text) | `#242934` |
| ink-muted | `#6b7280` |
| night-muted | `#98a6ad` |
| white | `#ffffff` |

The identity is **deep teal + warm tan**. Cool primary, warm accent — it reads
calm and finance-adjacent.

## 5. ⚠️ The brand colour is user-swappable — eight presets

An administrator can change the brand hue at runtime from Settings → Branding.
**A logo hardcoded to teal will clash the moment someone picks Crimson.**

| Preset | Brand (light) | Brand (dark surfaces) |
|---|---|---|
| **Teal** *(default)* | `#24695c` | `#5ec8b4` |
| Indigo | `#4d54b6` | `#9a9ed8` |
| Azure | `#29638e` | `#6aa9d7` |
| Plum | `#89448b` | `#c98fca` |
| Crimson | `#a93540` | `#dd8c93` |
| Forest | `#296b33` | `#43b955` |
| Bronze | `#815531` | `#cb986e` |
| Graphite | `#575f6b` | `#9ba3af` |

## 6. The contrast problem, and the two ways to solve it

A logo mark needs **≥ 3:1** against its background (WCAG non-text contrast).
Measured against the two surfaces:

| Colour | on `#ffffff` | on `#111727` | Verdict |
|---|---:|---:|---|
| brand `#24695c` | 6.46 | **2.76** | ❌ disappears on dark |
| brand-on-dark `#5ec8b4` | **2.02** | 8.84 | ❌ disappears on light |
| ink `#242934` | 14.57 | **1.23** | ❌ invisible on dark |
| white `#ffffff` | **1.00** | 17.86 | ❌ invisible on light |
| accent `#ba895d` | 3.08 | 5.80 | ✅ passes both, but only just on light |

**No colour in the core palette works well on both.** That is exactly why the app
carries a separate `brand-on-dark` token. Since you only get one file, pick one of
these two strategies:

### ✅ Strategy A — a self-contained mark *(recommended)*

Give the mark **its own filled background**: a brand-coloured rounded square
(≈`5px` radius at 32px) with the glyph **knocked out in white**.

- Works on any surface, in both themes, **and under all eight presets**, because
  the mark supplies its own contrast.
- It is what the app already does with its `P` monogram tile, so it will look
  native immediately.
- The white knockout on `#24695c` is **6.46:1** — comfortably accessible.

### Strategy B — a transparent mark in one universal colour

If you want a transparent glyph with no container, it must land in a narrow
luminance band (0.126–0.300) to clear 3:1 on both surfaces. Best value:

> ### `#2f8a78`
> **4.18:1** on `#ffffff` · **4.28:1** on `#111727` — near-perfectly balanced.

Other safe options: `#2d8272` (4.62 / 3.87), `#358f7d` (3.91 / 4.57),
`#3a9c89` (3.34 / 5.36).

**Trade-off:** `#2f8a78` is a lighter teal than the brand `#24695c`, so it will
not match brand-coloured UI exactly, and it will still clash under a non-teal
preset. Strategy A avoids both problems.

## 7. Checklist

- [ ] Legible at **32×32 px**
- [ ] Tested on **`#ffffff`** and on **`#111727`** — not on grey, not on a mockup
- [ ] One file that works on both (there is no light/dark swap)
- [ ] PNG with transparency, ≤512 KB, ≤2048px
- [ ] Mark contrast ≥ 3:1 on both surfaces
- [ ] No fine strokes, no wordmark inside the mark
- [ ] Still reads correctly if the brand hue changes (see § 5)
- [ ] Favicon variant at 16×16 and 32×32

---

**Sources:** `frontend/app/globals.css` (`:root` custom properties),
`backend/app/core/theme.py` (preset catalog), `backend/app/core/images.py` (upload
rules), `documentation/design/VIHO_THEME_REFERENCE.md` (surface values).
