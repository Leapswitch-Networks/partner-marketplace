"""Brand theme presets and the colour engine that derives everything else.

**History.** This module began presets-only, with a long argument here against a
colour picker: a picker that sets `--brand` and leaves `--brand-on-dark` alone
reproduces a real shipped bug (teal links at 2.8:1 on the dark card), and a picker
that sets both "needs a contrast solver in the request path". That argument ended
with *"a wheel can come later with a contrast validator in front of it."*

**2026-08-13, owner's instruction: later is now.** The solver exists below.
`derive_shades` builds all five brand channels from one picked colour, adjusting
until both AA axes pass — white on brand, and on-dark on the dark card — and
`validate_brand_colour` refuses a pick that cannot be made to pass, carrying the
measured numbers and a passing suggestion in the error. Presets remain the curated,
one-click path; a custom colour goes through strictly more checking, not less.

**The same instruction un-froze the tints.** `surface.wash`, `surface.tile`,
`night.border`, `tone.success` and friends were brand-derived percentages flattened
to hex when the design system was adopted — which is exactly why changing the brand
left green washes and borders everywhere (the § "leak table" in DAILY_CHANGES
2026-08-13). `css_variables` now emits those relationships as computed channels, so
the whole tint family follows whichever brand is in effect.

**How to add a preset:** presets stay fully explicit — generate the five shades,
verify `white on brand >= 4.5` and `on_dark on #111727 >= 4.5`, add the row, and
`tests/test_theme_presets.py` will enforce both. Do not hand-pick shades by eye —
that is how the original bug happened. (For a one-off colour, the picker now does
this for you; a preset is for a colour worth naming.)
"""

import colorsys
from dataclasses import dataclass

#: The dark card that `brand-on-dark` has to be legible against — `night.card` in
#: `tailwind.config.ts`. NOT `night.body`: Viho's dark elevation is inverted, so the
#: card (#111727) is *darker* than the page (#202938), and the card is the harder
#: test of the two.
NIGHT_CARD = "#111727"

#: White, for the two directions the base brand is used in: `text-brand` on a light
#: surface, and white label text on a `bg-brand` button.
LIGHT_SURFACE = "#ffffff"

#: The warm base the **pine** theme's chrome ground is mixed over. Added 2026-08-20
#: so the signed-in area sits on a warm ground like the public marketing site.
#:
#: 🔴 **This is pine's identity, not a universal.** It was briefly applied to every
#: preset, and that was wrong: at 3% the base dominates, so *every* theme came out
#: at warmth +12 to +17 — indigo, a blue-violet brand, sat on a cream `#faf8ee`, and
#: the deliberately monochrome shadcn themes got a yellow ground. A preset now
#: declares its own base via `ThemePreset.ground`, and anything that declares none
#: derives one from its own brand hue (see `chrome_ground`).
PINE_GROUND = "#fffdf0"

#: Mix for a preset that DECLARES a ground: let the declared base show through.
WASH_MIX = 0.03

#: Mix for a DERIVED ground (brand over white). Higher, because white has no
#: character of its own — at 3% over white the chrome would be indistinguishable
#: from the card. At 6% each theme gets a whisper of its own hue and `ink-label`
#: still clears AA on every preset (5.16 worst, shadcn-black).
NEUTRAL_WASH_MIX = 0.06

#: Accent families, chosen by the brand's own temperature rather than hand-picked
#: per preset — which is the only approach that also covers a CUSTOM `brand_color`,
#: where there is no preset to hand-pick for.
#:
#: Each triple is `(accent, accent_dark, accent_light)`. `accent` is a fill and an
#: icon colour only — never text on a light ground. `accent_dark` is measured on the
#: `bg-accent/20` composite it actually sits on, and `accent_light` on
#: `bg-accent/25` over `night.card`; both clear AA in every family.
ACCENT_AMBER = ("#ffa946", "#805423", "#ffc37e")  # 5.76 / 6.70 — for COOL brands
ACCENT_TEAL = ("#37a08c", "#1f5e51", "#7fd3c3")  # 6.14 / 7.05 — for WARM brands
ACCENT_ZINC = ("#a1a1aa", "#52525b", "#d4d4d8")  # 6.55 / 7.68 — for MONOCHROME

#: WCAG AA for normal text. Every preset must clear this on both axes.
MIN_CONTRAST = 4.5


@dataclass(frozen=True)
class ThemePreset:
    """One theme. All five shades, plus the two ratios that justify them."""

    label: str
    brand: str
    brand_dark: str
    brand_darker: str
    brand_light: str
    #: The light counterpart for dark surfaces. Never optional — a preset without one
    #: is a preset that fails AA in dark mode.
    brand_on_dark: str
    #: Recorded so the numbers live next to the values they describe rather than in a
    #: commit message. Asserted by the test suite, not trusted.
    contrast_white_on_brand: float
    contrast_on_dark_on_card: float
    #: The base this theme's light tints mix over. **None means derive one from the
    #: brand's own hue** — which is the right default, and the only thing that can
    #: also serve a custom `brand_color`. Declare it only where a deliberate
    #: identity choice overrides the derivation, as pine's cream does.
    ground: str | None = None


#: The default. Changed 2026-08-20 from `"teal"` to `"pine"` at the owner's
#: request, so the signed-in application ships in the same colour as the public
#: marketing site — see `documentation/design/BACKOFFICE_DESIGN.md`.
#:
#: `teal` stays in the catalog and its values stay byte-for-byte Viho's. It is no
#: longer the default, but it is still selectable and must not be "improved".
#:
#: ⚠️ Changing this key changes what every installation with a NULL
#: `app_settings.theme_preset` renders. `frontend/app/globals.css` `:root` carries
#: the same values as the CSS-level fallback for an unreachable API, and the two
#: must be changed together or a themed installation and a default one diverge.
DEFAULT_PRESET = "pine"

THEME_PRESETS: dict[str, ThemePreset] = {
    # ── The house theme — owner's request, 2026-08-20 ─────────────────────────
    # `#034f46` is `--public-deep` from `frontend/app/(public)/public.css`, taken
    # byte for byte from the marketing site so the two surfaces are the same
    # colour rather than merely similar. On that surface it is the "premium slabs
    # + every link hover" role, which is the same structural job `--brand` does
    # here — which is why it ports cleanly and the site's pale button fill does
    # not (white on `#f0d7ff` is 1.32:1; `validate_brand_colour` refuses it).
    #
    # The four remaining shades are this module's own derivation of that hex, not
    # hand-picked, so hover/pressed/dark-mode stay consistent with every other
    # preset. It clears both axes more comfortably than the teal it replaces:
    # 9.50:1 white-on-brand against teal's 6.46:1.
    "pine": ThemePreset(
        "Pine", "#034f46", "#02332d", "#012420", "#08534a", "#07b19d", 9.50, 6.62,
        # The one declared ground: the marketing site is cream, and matching it is
        # the whole point of this preset. Every other theme derives its own.
        ground=PINE_GROUND,
    ),
    "teal": ThemePreset("Teal", "#24695c", "#17433b", "#10302a", "#236559", "#5ec8b4", 6.46, 8.84),
    "indigo": ThemePreset("Indigo", "#4d54b6", "#323679", "#232654", "#545bb9", "#9a9ed8", 6.44, 7.02),
    "azure": ThemePreset("Azure", "#29638e", "#1b415e", "#132e41", "#2b6794", "#6aa9d7", 6.42, 7.03),
    "plum": ThemePreset("Plum", "#89448b", "#5a2d5c", "#3f1f40", "#8e4791", "#c98fca", 6.44, 7.03),
    "crimson": ThemePreset("Crimson", "#a93540", "#70232a", "#4e181d", "#b03743", "#dd8c93", 6.42, 7.01),
    "forest": ThemePreset("Forest", "#296b33", "#1b4722", "#133117", "#2b6f35", "#43b955", 6.47, 7.07),
    "bronze": ThemePreset("Bronze", "#815531", "#553820", "#3b2717", "#865833", "#cb986e", 6.41, 7.02),
    "graphite": ThemePreset("Graphite", "#575f6b", "#393f47", "#282c31", "#5a636f", "#9ba3af", 6.45, 7.02),
    # ── The shadcn monochrome pair — owner's request, 2026-08-13 ──────────────
    # Zinc-scale neutrals, so the whole app reads as shadcn's black-and-white:
    # in light mode a black primary on paper, in dark mode the signature
    # near-white (#fafafa / zinc-50) on the dark card — deliberately NOT the
    # engine's derived mid-grey, because the near-white IS the look.
    #
    # There is no literal "white" brand and cannot be: every button paints
    # white label text on the brand, and white-on-white is 1:1 — the exact
    # pick `validate_brand_colour` exists to refuse. "Shadcn White" is the
    # light half of the aesthetic: zinc-700 primary, paper surfaces (the
    # derived washes of a neutral are pure greys — no tint at all).
    "shadcn-black": ThemePreset(
        "Shadcn Black", "#18181b", "#09090b", "#000000", "#27272a", "#fafafa", 17.72, 17.11
    ),
    "shadcn-white": ThemePreset(
        "Shadcn White", "#3f3f46", "#27272a", "#18181b", "#52525b", "#e4e4e7", 10.44, 14.08
    ),
}


# --- Contrast maths ---------------------------------------------------------
#
# Implemented here rather than pulled in as a dependency: it is fifteen lines of
# WCAG 2.1 and it needs to be callable from a test, which is the whole point.


def _channels(hex_colour: str) -> tuple[int, int, int]:
    value = hex_colour.lstrip("#")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]


def _relative_luminance(hex_colour: str) -> float:
    def linearise(channel: int) -> float:
        srgb = channel / 255
        return srgb / 12.92 if srgb <= 0.03928 else ((srgb + 0.055) / 1.055) ** 2.4

    red, green, blue = (linearise(c) for c in _channels(hex_colour))
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue


def contrast_ratio(first: str, second: str) -> float:
    """WCAG 2.1 contrast ratio between two hex colours. Symmetric, 1.0 … 21.0."""
    a, b = _relative_luminance(first), _relative_luminance(second)
    lighter, darker = max(a, b), min(a, b)
    return (lighter + 0.05) / (darker + 0.05)


def rgb_channels(hex_colour: str) -> str:
    """`"#24695c"` → `"36 105 92"`, the form the CSS variables require.

    Space-separated channels rather than a hex string is what makes Tailwind's
    `<alpha-value>` work. **12 distinct opacity variants are in use** in this
    codebase (`bg-brand/[.04]` through `bg-brand/70`); a hex in the variable makes
    every one of them silently render fully opaque.
    """
    return " ".join(str(c) for c in _channels(hex_colour))


def resolve(preset_key: str | None) -> ThemePreset:
    """The named preset, or the default. Never raises.

    An unknown key falls back rather than erroring, because this is called while
    rendering: a preset removed from the catalog while a database row still names it
    must degrade to the default theme, not take the application down.
    """
    if preset_key and preset_key in THEME_PRESETS:
        return THEME_PRESETS[preset_key]
    return THEME_PRESETS[DEFAULT_PRESET]


def key_for(preset: ThemePreset) -> str:
    """The catalog key a preset is stored under.

    Needed because `resolve` returns the preset object, and the API has to report
    *which* theme is in effect — including when a NULL or unknown stored value fell
    back to the default. Reporting the stored value instead would answer `null` for a
    page that is visibly teal.
    """
    for key, candidate in THEME_PRESETS.items():
        if candidate is preset:
            return key
    return DEFAULT_PRESET


# --- Colour arithmetic -------------------------------------------------------
#
# Everything below works on hex in, hex out, so the derivation reads as a chain of
# named steps rather than tuple bookkeeping.


def _to_hex(channels: tuple[float, float, float]) -> str:
    return "#" + "".join(f"{max(0, min(255, round(c))):02x}" for c in channels)


def mix(colour: str, over: str, amount: float) -> str:
    """`colour` at `amount` opacity flattened over `over` — the tint formula.

    This is the exact relationship the old hardcoded tints encoded: `surface.wash`
    was "brand at 10% over white" flattened to `#eaf0ef` at design time. Computing
    it keeps the relationship and loses the freeze.
    """
    fg, bg = _channels(colour), _channels(over)
    return _to_hex(tuple(f * amount + b * (1 - amount) for f, b in zip(fg, bg)))


def _with_lightness(colour: str, lightness: float) -> str:
    hue, _, saturation = colorsys.rgb_to_hls(*(c / 255 for c in _channels(colour)))
    return _to_hex(
        tuple(c * 255 for c in colorsys.hls_to_rgb(hue, max(0.0, min(1.0, lightness)), saturation))
    )


def _lightness(colour: str) -> float:
    return colorsys.rgb_to_hls(*(c / 255 for c in _channels(colour)))[1]


def _lighten_until(colour: str, against: str, minimum: float) -> str | None:
    """Raise HLS lightness in small steps until the contrast passes, or None.

    Hue and saturation are preserved — mixing toward white would pass sooner but
    desaturates, and the preset `on_dark` values (e.g. teal `#5ec8b4`) show the
    intended look is a *brighter* brand, not a paler one.
    """
    lightness = _lightness(colour)
    while lightness <= 0.96:
        candidate = _with_lightness(colour, lightness)
        if contrast_ratio(candidate, against) >= minimum:
            return candidate
        lightness += 0.02
    return None


def _darken_until(colour: str, against: str, minimum: float) -> str | None:
    lightness = _lightness(colour)
    while lightness >= 0.04:
        candidate = _with_lightness(colour, lightness)
        if contrast_ratio(candidate, against) >= minimum:
            return candidate
        lightness -= 0.02
    return None


class BrandColourError(ValueError):
    """A picked colour that cannot be used, with the evidence and a way out."""

    def __init__(self, message: str, *, measured: float, suggestion: str | None):
        super().__init__(message)
        self.measured = measured
        self.suggestion = suggestion


def validate_brand_colour(brand: str) -> str:
    """Normalise `#rrggbb` and enforce the one rule derivation cannot fix.

    Derivation adjusts every *other* shade until it passes; the base colour itself
    is the only one used exactly as picked (buttons, the active nav row), so white
    label text on it must clear AA. The error carries the nearest passing shade of
    the same hue so the UI can offer it in one click instead of a dead end.
    """
    value = brand.strip().lower()
    if value.startswith("#"):
        value = value[1:]
    if len(value) == 3:
        value = "".join(ch * 2 for ch in value)
    if len(value) != 6 or any(ch not in "0123456789abcdef" for ch in value):
        raise BrandColourError(
            "Brand colour must be a hex colour like #24695c.", measured=0.0, suggestion=None
        )
    value = f"#{value}"

    measured = contrast_ratio(LIGHT_SURFACE, value)
    if measured < MIN_CONTRAST:
        suggestion = _darken_until(value, LIGHT_SURFACE, MIN_CONTRAST)
        raise BrandColourError(
            f"White text on this colour measures {measured:.2f}:1 and WCAG AA needs "
            f"{MIN_CONTRAST}:1 — button labels would be unreadable."
            + (f" The nearest passing shade of the same hue is {suggestion}." if suggestion else ""),
            measured=round(measured, 2),
            suggestion=suggestion,
        )
    return value


@dataclass(frozen=True)
class BrandShades:
    """The five channels, wherever they came from — a preset row or derivation."""

    brand: str
    brand_dark: str
    brand_darker: str
    brand_light: str
    brand_on_dark: str


def derive_shades(brand: str) -> BrandShades:
    """All five channels from one validated base colour.

    The ratios mirror the teal preset's own relationships (dark ≈ 36% toward
    black, darker ≈ 55%, light ≈ the base with a 2% lift), and `on_dark` is not a
    ratio at all — it is *whatever lightness first clears AA on the dark card*,
    which is the solver this module's docstring spent a page saying a picker would
    need. `validate_brand_colour` runs first, so the fallback branch for a
    hopeless `on_dark` is unreachable in practice; it degrades to white rather
    than raising because this can run while rendering a stored value.
    """
    base = validate_brand_colour(brand)
    # Aim for the comfort the curated presets actually have (~7:1) and settle for
    # AA when the hue cannot reach it without washing out. First-pass-at-4.5 was
    # measurably dimmer than every preset's on-dark.
    on_dark = (
        _lighten_until(base, NIGHT_CARD, 6.5)
        or _lighten_until(base, NIGHT_CARD, MIN_CONTRAST)
        or "#ffffff"
    )
    return BrandShades(
        brand=base,
        brand_dark=mix(base, "#000000", 0.64),
        brand_darker=mix(base, "#000000", 0.45),
        brand_light=mix(base, "#ffffff", 0.98),
        brand_on_dark=on_dark,
    )


def _preset_shades(preset: ThemePreset) -> BrandShades:
    return BrandShades(
        brand=preset.brand,
        brand_dark=preset.brand_dark,
        brand_darker=preset.brand_darker,
        brand_light=preset.brand_light,
        brand_on_dark=preset.brand_on_dark,
    )


def contrast_report(shades: BrandShades) -> dict[str, float]:
    """The two ratios the presets record, measured for any shade set."""
    return {
        "white_on_brand": round(contrast_ratio(LIGHT_SURFACE, shades.brand), 2),
        "on_dark_on_card": round(contrast_ratio(shades.brand_on_dark, NIGHT_CARD), 2),
    }


def chrome_ground(brand: str, declared: str | None = None) -> str:
    """The chrome ground for a brand — sidebar, drawer, top nav, page canvas.

    A declared base wins; otherwise the ground is a 6% wash of the brand over white,
    so each theme's chrome is a whisper of **its own** hue. That is what makes the
    monochrome presets read monochrome and keeps a violet brand off a cream ground.

    ⚠️ `text-ink-muted` measures 4.28–4.45 on a derived ground, so it stays an AA
    fail there and `text-ink-label` remains the rule for small text on the chrome —
    exactly as `UI_PATTERNS.md` has required since 2026-08-07. The lift to 4.51 that
    the cream produced was a pine-specific side effect, not a universal gain; do not
    quote it as one.
    """
    if declared:
        return mix(brand, declared, WASH_MIX)
    return mix(brand, LIGHT_SURFACE, NEUTRAL_WASH_MIX)


def accent_family(brand: str) -> tuple[str, str, str]:
    """`(accent, accent_dark, accent_light)` for a brand, by its temperature.

    Derived rather than declared per preset, because a custom `brand_color` may be
    any hex and there is no preset to hand-pick for. The rule:

    * **low saturation** → zinc, so a monochrome theme stays monochrome. An amber
      accent on the shadcn presets defeated the one thing they exist for.
    * **cool hue** (green through violet) → amber, the house accent.
    * **warm hue** (red, orange, brown) → teal, so the accent is not a second
      near-neighbour of the brand it is meant to punctuate.
    """
    red, green, blue = (channel / 255 for channel in _channels(brand))
    hue, _lightness, saturation = colorsys.rgb_to_hls(red, green, blue)
    if saturation < 0.14:
        return ACCENT_ZINC
    return ACCENT_AMBER if 0.22 <= hue <= 0.83 else ACCENT_TEAL


#: Light-end floor for a sequential ramp: its palest step must still be this far
#: from the card, or the first bucket is invisible. 2.0 is the gate; 2.15 is the
#: target, so rounding cannot drop a preset under it.
SEQ_LIGHT_END_MIN = 2.15

#: Where steps 2 and 3 sit between the first step and the full brand. Proportional
#: rather than absolute, so the spacing survives whatever first step a brand needs.
#: For pine these reproduce the hand-tuned (0.42, 0.57, 0.80, 1.0) exactly.
SEQ_SPACING = (0.0, 0.26, 0.655, 1.0)

#: The dark ramp stops just short of the pure anchor, so its top step keeps a trace
#: of the card's own hue.
#:
#: Not cosmetic. `shadcn-black`'s dark anchor is `#fafafa` — a **pure** neutral, whose
#: hue is undefined and measures as 0° while the rest of its ramp sits near 220°. That
#: read as a 178° hue spread and failed the single-hue check, on a ramp that is in
#: fact monotone and never exceeds 0.107 saturation. Rather than claim an exception
#: for neutrals, the anchor carries 3% of the surface, which makes the ramp
#: single-hue by construction. For a chromatic brand the difference is imperceptible.
DARK_TOP = 0.97


def sequential_ramp_dark(brand_on_dark: str) -> list[str]:
    """The magnitude ramp for the DARK card — anchored on the light counterpart.

    A sequential ramp flips its anchor in dark mode. The light ramp runs pale-to-
    brand over white; on `night.card` the brand itself measures **1.88:1** (pine), so
    reusing the light ramp puts the *high-magnitude* end of the scale out of sight —
    the exact opposite of what a magnitude encoding is for.

    So the dark ramp runs from a step just clear of the card up to `brand_on_dark`,
    which is the shade already contrast-checked against that surface for every
    preset. Same contrast search, same proportional spacing.
    """
    first = 1.0
    amount = 0.20
    while amount <= 1.0:
        if contrast_ratio(mix(brand_on_dark, NIGHT_CARD, amount), NIGHT_CARD) >= 2.0:
            first = amount
            break
        amount += 0.01
    span = DARK_TOP - first
    return [mix(brand_on_dark, NIGHT_CARD, first + span * f) for f in SEQ_SPACING]


def sequential_ramp(brand: str) -> list[str]:
    """The magnitude ramp for a brand — one hue, light to dark, four steps.

    Brand-derived rather than fixed, because a sequential scale IS one hue and the
    only honest hue is the theme's own: a pine-green heatmap under a crimson theme
    reads as a foreign object.

    ## The first step is found by contrast, not chosen

    A fixed set of mix levels cannot work across these brands. Pine is very dark
    (9.50:1 against white) and the rest sit near 6.4:1, so mix levels tuned on pine
    put seven presets' palest step at **1.91–1.96:1 — under the 2:1 floor**, which
    the validator caught only because every preset was checked rather than one.

    So the palest step is the lightest mix that still clears `SEQ_LIGHT_END_MIN`,
    found by search, and the rest are spaced proportionally from there. That
    self-tunes for a custom `brand_color` too, where there is no preset to tune.

    Four steps, not five: five failed the adjacent-lightness gate (ΔL >= 0.06).

    ⚠️ The **categorical** chart palette deliberately does NOT follow the theme —
    see `charts/tokens.ts`. A series' colour must mean the same thing regardless of
    which brand skin the reader picked, and re-ordering it per theme would mean
    re-running the six checks eleven times for no gain.
    """
    first = 1.0
    step = 0.01
    amount = 0.20
    while amount <= 1.0:
        if contrast_ratio(mix(brand, LIGHT_SURFACE, amount), LIGHT_SURFACE) >= SEQ_LIGHT_END_MIN:
            first = amount
            break
        amount += step
    span = 1.0 - first
    return [mix(brand, LIGHT_SURFACE, first + span * fraction) for fraction in SEQ_SPACING]


def css_variables(preset_key: str | None, brand_colour: str | None = None) -> dict[str, str]:
    """The active theme as `{"--brand": "36 105 92", …}`, ready for a `<style>`.

    A stored custom colour wins over the preset; a stored custom colour that no
    longer validates (the rules tightened, say) degrades to the preset rather than
    taking rendering down — same posture as `resolve` on an unknown key.

    Beyond the five brand channels, this emits the **derived tint family** that
    used to be frozen hex in `tailwind.config.ts` — each line notes the original
    value it replaces and the relationship that value encoded.

    ~~`accent` remains deliberately absent: Viho's tan secondary at 22 call sites
    reads as a companion colour, not the brand.~~ **Reversed 2026-08-20.** True while
    the accent was a fixed tan; false once the accent became a choice made from the
    brand's own temperature. Leaving it fixed gave the monochrome presets a yellow
    accent and gave crimson an amber one — two warm mid-tones doing one job. The
    accent, and the sequential chart ramp, now travel with the theme; the
    *categorical* chart palette still does not, and `charts/tokens.ts` says why.
    """
    shades: BrandShades | None = None
    if brand_colour:
        try:
            shades = derive_shades(brand_colour)
        except BrandColourError:
            shades = None
    preset = resolve(preset_key)
    if shades is None:
        shades = _preset_shades(preset)
        declared_ground = preset.ground
    else:
        # A custom colour has no preset behind it, so its ground is always derived.
        declared_ground = None

    brand = shades.brand
    accent, accent_dark, accent_light = accent_family(brand)
    return {
        "--brand": rgb_channels(shades.brand),
        "--brand-dark": rgb_channels(shades.brand_dark),
        "--brand-darker": rgb_channels(shades.brand_darker),
        "--brand-light": rgb_channels(shades.brand_light),
        "--brand-on-dark": rgb_channels(shades.brand_on_dark),
        # The chrome ground. Was `brand at 10% over white` (#eaf0ef at adoption,
        # #e6edec under pine); now brand at 3% over the warm CHROME_BASE, which is
        # what makes the signed-in area read warm like the marketing site.
        # ⚠️ `frontend/app/globals.css` carries the same value as the no-API
        # fallback. Change both together.
        "--surface-wash": rgb_channels(chrome_ground(brand, declared_ground)),
        # The accent now travels WITH the theme. It used to be a static amber in
        # `globals.css`, which meant a monochrome preset had a yellow accent and a
        # crimson one had an accent almost its own colour.
        "--accent": rgb_channels(accent),
        "--accent-dark": rgb_channels(accent_dark),
        "--accent-light": rgb_channels(accent_light),
        # The sequential chart ramp follows the theme; the categorical slots do not.
        #
        # ⚠️ BOTH modes are emitted, and `globals.css` maps the dark set in under
        # `:root.dark`. That selector is deliberate: this block is injected as
        # `:root{…}` *after* the stylesheet, and `:root` and `.dark` carry equal
        # specificity — so a plain `.dark` rule loses on source order and dark mode
        # silently renders the LIGHT ramp, whose brand-end is 1.88:1 on the dark
        # card. `:root.dark` outranks it. Do not weaken that selector.
        **{
            f"--chart-seq-{index}": rgb_channels(step)
            for index, step in enumerate(sequential_ramp(brand), start=1)
        },
        **{
            f"--chart-seq-dark-{index}": rgb_channels(step)
            for index, step in enumerate(sequential_ramp_dark(shades.brand_on_dark), start=1)
        },
        # was surface.tile #eff3f2 — brand at 8% over white
        "--surface-tile": rgb_channels(mix(brand, "#ffffff", 0.08)),
        # was surface.border / tone.light #e6edef — brand at 11% over white
        "--surface-border": rgb_channels(mix(brand, "#ffffff", 0.11)),
        # was night.border #142831 — brand at 20% over the dark card
        "--night-border": rgb_channels(mix(brand, NIGHT_CARD, 0.20)),
        # was tone.success #1b4c43 — the brand darkened 27%; success follows the
        # brand by the owner's decision (2026-08-13), the way the original teal
        # success literally *was* the brand
        "--tone-success": rgb_channels(mix(brand, "#000000", 0.73)),
    }
