"""Brand theme presets — the only place a theme colour may be defined.

**Why presets rather than a colour picker**, which is the obvious thing to build and
the wrong one:

`UI_PATTERNS.md` records `brand-on-dark` as a 🔴 mandatory rule with measured
numbers — the teal on the dark card is about 2.8:1 and **fails AA**, while its light
counterpart scores about 8.8:1. That is why two tokens exist rather than one, and it
is a bug that actually shipped: the first pass at the auth screens used `text-brand`
links that were unreadable in dark mode.

A picker that sets `--brand` and leaves `--brand-on-dark` alone reproduces that bug
exactly, on every screen, for whichever project picks a light colour. A picker that
sets both needs a contrast solver in the request path, and would still happily accept
a pale yellow that fails white-on-brand for every button label.

So the colour space is closed. Each preset below ships **both** halves, and both were
computed against the real surfaces and checked. Adding a theme is a code change with
a test, which is the correct amount of friction for something that can make an
application unreadable.

**How to add one:** generate the five shades, verify `white on brand >= 4.5` and
`on_dark on #111727 >= 4.5`, add the row, and `tests/test_theme_presets.py` will
enforce both. Do not hand-pick shades by eye — that is how the original bug happened.
"""

from dataclasses import dataclass

#: The dark card that `brand-on-dark` has to be legible against — `night.card` in
#: `tailwind.config.ts`. NOT `night.body`: Viho's dark elevation is inverted, so the
#: card (#111727) is *darker* than the page (#202938), and the card is the harder
#: test of the two.
NIGHT_CARD = "#111727"

#: White, for the two directions the base brand is used in: `text-brand` on a light
#: surface, and white label text on a `bg-brand` button.
LIGHT_SURFACE = "#ffffff"

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


#: The default, and the only one whose values are quoted rather than generated:
#: these are Viho's own, byte for byte, and must not be "improved".
DEFAULT_PRESET = "teal"

THEME_PRESETS: dict[str, ThemePreset] = {
    "teal": ThemePreset("Teal", "#24695c", "#17433b", "#10302a", "#236559", "#5ec8b4", 6.46, 8.84),
    "indigo": ThemePreset("Indigo", "#4d54b6", "#323679", "#232654", "#545bb9", "#9a9ed8", 6.44, 7.02),
    "azure": ThemePreset("Azure", "#29638e", "#1b415e", "#132e41", "#2b6794", "#6aa9d7", 6.42, 7.03),
    "plum": ThemePreset("Plum", "#89448b", "#5a2d5c", "#3f1f40", "#8e4791", "#c98fca", 6.44, 7.03),
    "crimson": ThemePreset("Crimson", "#a93540", "#70232a", "#4e181d", "#b03743", "#dd8c93", 6.42, 7.01),
    "forest": ThemePreset("Forest", "#296b33", "#1b4722", "#133117", "#2b6f35", "#43b955", 6.47, 7.07),
    "bronze": ThemePreset("Bronze", "#815531", "#553820", "#3b2717", "#865833", "#cb986e", 6.41, 7.02),
    "graphite": ThemePreset("Graphite", "#575f6b", "#393f47", "#282c31", "#5a636f", "#9ba3af", 6.45, 7.02),
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


def css_variables(preset_key: str | None) -> dict[str, str]:
    """The preset as `{"--brand": "36 105 92", …}`, ready to inline in a `<style>`.

    `accent` is deliberately absent: it is Viho's tan secondary, used at 22 call
    sites, and it reads as a companion colour rather than as *the* brand. Leaving it
    fixed means a preset changes the primary identity without turning every theme
    into a two-colour design decision. Add it here if that stops being true.
    """
    preset = resolve(preset_key)
    return {
        "--brand": rgb_channels(preset.brand),
        "--brand-dark": rgb_channels(preset.brand_dark),
        "--brand-darker": rgb_channels(preset.brand_darker),
        "--brand-light": rgb_channels(preset.brand_light),
        "--brand-on-dark": rgb_channels(preset.brand_on_dark),
    }
