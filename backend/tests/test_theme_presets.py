"""Every theme preset must be legible — asserted, not trusted.

This is the test that makes a closed colour space worth having. `UI_PATTERNS.md`
records `brand-on-dark` as a 🔴 mandatory rule because the failure already happened
once: the auth screens shipped `text-brand` links that were unreadable in dark mode.

A preset added by eye would reintroduce that for whichever project selects it, and
the symptom — grey-on-grey links in dark mode only — is the kind of thing that
survives a review and reaches a user. So the catalog is checked here rather than
described in a comment.
"""

import pytest

from app.core.theme import (
    DEFAULT_PRESET,
    LIGHT_SURFACE,
    MIN_CONTRAST,
    NIGHT_CARD,
    THEME_PRESETS,
    contrast_ratio,
    css_variables,
    resolve,
    rgb_channels,
)

PRESET_KEYS = sorted(THEME_PRESETS)


def test_contrast_ratio_matches_known_wcag_values():
    """Calibrate the implementation before trusting it on the presets."""
    assert contrast_ratio("#000000", "#ffffff") == pytest.approx(21.0, abs=0.01)
    assert contrast_ratio("#ffffff", "#ffffff") == pytest.approx(1.0, abs=0.01)
    # Symmetric — the order of arguments must not matter.
    assert contrast_ratio("#24695c", "#ffffff") == pytest.approx(
        contrast_ratio("#ffffff", "#24695c")
    )


def test_the_documented_failure_is_reproduced():
    """The base teal on the dark card fails AA. This is *why* two tokens exist.

    Asserted as a property of the maths rather than quoted from the docs: if this
    ever passed, the whole `brand-on-dark` rule would be unnecessary and someone
    should find out from a failing test rather than by guessing.

    `UI_PATTERNS.md` quotes 2.83 and 9.03; this implementation computes 2.76 and
    8.84. The small gap is a rounding or measurement difference — the conclusions
    (fails / passes, by a wide margin either way) agree exactly, which is what the
    rule depends on.
    """
    assert contrast_ratio("#24695c", NIGHT_CARD) < MIN_CONTRAST
    assert contrast_ratio("#5ec8b4", NIGHT_CARD) >= MIN_CONTRAST


@pytest.mark.parametrize("key", PRESET_KEYS)
def test_white_text_is_legible_on_the_brand(key):
    """`bg-brand` carries white label text on every primary button."""
    preset = THEME_PRESETS[key]
    ratio = contrast_ratio(LIGHT_SURFACE, preset.brand)
    assert ratio >= MIN_CONTRAST, f"{key}: white on {preset.brand} is {ratio:.2f}:1"


@pytest.mark.parametrize("key", PRESET_KEYS)
def test_brand_is_legible_as_text_on_a_light_surface(key):
    """`text-brand` on white. Same ratio as above by symmetry, different failure."""
    preset = THEME_PRESETS[key]
    assert contrast_ratio(preset.brand, LIGHT_SURFACE) >= MIN_CONTRAST


@pytest.mark.parametrize("key", PRESET_KEYS)
def test_on_dark_variant_is_legible_on_the_dark_card(key):
    """The rule that exists because it was once broken."""
    preset = THEME_PRESETS[key]
    ratio = contrast_ratio(preset.brand_on_dark, NIGHT_CARD)
    assert ratio >= MIN_CONTRAST, f"{key}: {preset.brand_on_dark} on card is {ratio:.2f}:1"


@pytest.mark.parametrize("key", PRESET_KEYS)
def test_recorded_ratios_are_accurate(key):
    """The numbers stored on the preset must match the maths.

    They are documentation, and documentation that disagrees with the code is worse
    than none — someone would copy a stale figure into a new preset.
    """
    preset = THEME_PRESETS[key]
    assert contrast_ratio(LIGHT_SURFACE, preset.brand) == pytest.approx(
        preset.contrast_white_on_brand, abs=0.05
    )
    assert contrast_ratio(preset.brand_on_dark, NIGHT_CARD) == pytest.approx(
        preset.contrast_on_dark_on_card, abs=0.05
    )


@pytest.mark.parametrize("key", PRESET_KEYS)
def test_hover_and_pressed_shades_are_progressively_darker(key):
    """`dark` is the hover state and `darker` the pressed one.

    A preset whose hover shade is lighter than its base makes a button appear to
    *lift* on hover, which reads as broken rather than as a colour choice.
    """
    from app.core.theme import _relative_luminance

    preset = THEME_PRESETS[key]
    base = _relative_luminance(preset.brand)
    assert _relative_luminance(preset.brand_dark) < base
    assert _relative_luminance(preset.brand_darker) < _relative_luminance(preset.brand_dark)


@pytest.mark.parametrize("key", PRESET_KEYS)
def test_every_shade_is_a_six_digit_hex(key):
    """Guards the paste error that would reach the browser as an invalid colour."""
    preset = THEME_PRESETS[key]
    for shade in (
        preset.brand, preset.brand_dark, preset.brand_darker,
        preset.brand_light, preset.brand_on_dark,
    ):
        assert len(shade) == 7 and shade.startswith("#")
        int(shade[1:], 16)  # raises if not hex


def test_default_preset_exists_and_is_the_viho_teal():
    assert DEFAULT_PRESET in THEME_PRESETS
    assert THEME_PRESETS[DEFAULT_PRESET].brand == "#24695c"


# --- CSS variable emission --------------------------------------------------


def test_channels_are_space_separated_not_hex():
    """The single most breakable detail in phase 3.

    Tailwind reads these as `rgb(var(--brand) / <alpha-value>)`. A hex here would
    make all **12** opacity variants in use — `bg-brand/[.04]` through
    `bg-brand/70` — silently render fully opaque, which is a visual regression no
    type checker or linter would catch.
    """
    assert rgb_channels("#24695c") == "36 105 92"
    assert rgb_channels("#ffffff") == "255 255 255"
    assert rgb_channels("#000000") == "0 0 0"


@pytest.mark.parametrize("key", PRESET_KEYS)
def test_css_variables_cover_every_brand_token(key):
    """All five, or a call site falls back to the default while its siblings change."""
    variables = css_variables(key)
    assert set(variables) == {
        "--brand", "--brand-dark", "--brand-darker", "--brand-light", "--brand-on-dark",
    }
    for value in variables.values():
        parts = value.split()
        assert len(parts) == 3 and all(0 <= int(p) <= 255 for p in parts)


def test_accent_is_deliberately_not_themed():
    assert not any("accent" in name for name in css_variables("indigo"))


# --- Resolution -------------------------------------------------------------


@pytest.mark.parametrize("bad", [None, "", "not-a-preset", "TEAL", "teal "])
def test_unknown_preset_falls_back_rather_than_raising(bad):
    """Called during rendering, so it must never be the reason a page 500s.

    A preset retired from the catalog while a database row still names it has to
    degrade to the default theme. Note the case- and whitespace-sensitivity is
    intentional: keys are exact, and a near-miss falls back visibly rather than
    being silently corrected into something the administrator did not pick.
    """
    assert resolve(bad).brand == THEME_PRESETS[DEFAULT_PRESET].brand


def test_known_preset_resolves_to_itself():
    assert resolve("indigo").label == "Indigo"
