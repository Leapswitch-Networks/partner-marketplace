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

from app.core import theme
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


@pytest.mark.parametrize("key", PRESET_KEYS)
def test_sequential_ramp_light_end_clears_the_card(key):
    """Every theme's palest chart step must still be visible on a white card.

    This exists because a fixed set of mix levels, tuned on pine, put **seven of
    eleven** presets' palest step at 1.91–1.96:1 against a 2:1 floor. Pine's brand is
    9.50:1 on white and the rest sit near 6.4:1, so a level that works for one is
    wrong for the others — and nothing catches it unless every preset is checked.
    """
    from app.core.theme import LIGHT_SURFACE, sequential_ramp

    ramp = sequential_ramp(THEME_PRESETS[key].brand)
    lightest = contrast_ratio(ramp[0], LIGHT_SURFACE)
    assert lightest >= 2.0, f"{key}: palest step {ramp[0]} is {lightest:.2f}:1 on white"


@pytest.mark.parametrize("key", PRESET_KEYS)
def test_sequential_ramp_steps_stay_apart(key):
    """Adjacent steps need a visible lightness gap or the ramp reads as one block."""
    from app.core.theme import _relative_luminance, sequential_ramp

    ramp = sequential_ramp(THEME_PRESETS[key].brand)
    lums = [_relative_luminance(step) for step in ramp]
    assert lums == sorted(lums, reverse=True), f"{key}: ramp is not monotone"
    assert len(set(ramp)) == len(ramp), f"{key}: ramp has duplicate steps"


@pytest.mark.parametrize("key", PRESET_KEYS)
def test_accent_is_not_a_near_neighbour_of_its_own_brand(key):
    """An accent exists to punctuate the brand, so it must not nearly be the brand.

    The rule that produced this: a warm brand gets the teal accent rather than the
    house amber, because amber beside crimson is two warm mid-tones doing the same
    job. Monochrome brands get zinc, so a theme whose whole point is neutrality does
    not sprout a yellow accent.
    """
    from app.core.theme import accent_family

    preset = THEME_PRESETS[key]
    accent, _dark, _light = accent_family(preset.brand)
    assert contrast_ratio(accent, preset.brand) >= 1.6, (
        f"{key}: accent {accent} is too close to brand {preset.brand}"
    )


@pytest.mark.parametrize("key", PRESET_KEYS)
def test_only_pine_declares_a_ground(key):
    """Every other theme derives its chrome from its own hue.

    A declared ground is an identity override and pine has the only one — the
    marketing site is cream and matching it is that preset's whole purpose. When the
    cream was applied to *all* of them, every theme came out warm: a blue-violet
    brand on a cream ground, and the monochrome presets tinted yellow.
    """
    preset = THEME_PRESETS[key]
    if key == "pine":
        assert preset.ground is not None
    else:
        assert preset.ground is None, f"{key} declares a ground; it should derive one"


@pytest.mark.parametrize("key", PRESET_KEYS)
def test_dark_sequential_ramp_is_anchored_for_the_dark_card(key):
    """The dark ramp must be visible at BOTH ends on `night.card`.

    Reusing the light ramp in dark mode is the bug this guards. A light ramp runs
    pale-to-brand, and the brand measures **1.88:1 on night.card** for pine — so the
    high-magnitude end of every heatmap disappears exactly where the value is
    highest. The dark ramp anchors on `brand_on_dark`, the shade already checked
    against that surface.
    """
    from app.core.theme import NIGHT_CARD, sequential_ramp_dark

    ramp = sequential_ramp_dark(THEME_PRESETS[key].brand_on_dark)
    palest = contrast_ratio(ramp[0], NIGHT_CARD)
    boldest = contrast_ratio(ramp[-1], NIGHT_CARD)
    assert palest >= 2.0, f"{key}: palest dark step {ramp[0]} is {palest:.2f}:1 on the card"
    assert boldest >= 4.5, f"{key}: boldest dark step {ramp[-1]} is only {boldest:.2f}:1"
    assert boldest > palest, f"{key}: dark ramp does not increase in contrast"


@pytest.mark.parametrize("key", PRESET_KEYS)
def test_dark_ramp_top_is_never_a_pure_neutral(key):
    """The top step keeps a trace of the surface, so the ramp stays one hue.

    `shadcn-black`'s anchor is `#fafafa` — a pure neutral, whose hue is undefined and
    measures 0 degrees while the rest of its ramp sits near 220. That read as a 178
    degree hue spread and failed the single-hue check on a ramp that is monotone and
    never exceeds 0.107 saturation. `DARK_TOP` pulls 3% of the card into the anchor so
    the ramp is single-hue by construction rather than by exception.
    """
    from app.core.theme import sequential_ramp_dark

    top = sequential_ramp_dark(THEME_PRESETS[key].brand_on_dark)[-1]
    assert top != THEME_PRESETS[key].brand_on_dark or top != "#fafafa"
    red, green, blue = int(top[1:3], 16), int(top[3:5], 16), int(top[5:7], 16)
    assert not (red == green == blue), f"{key}: dark ramp top {top} is a pure grey"


def test_default_preset_is_the_public_surface_pine():
    """The default ships in the marketing site's own colour.

    Changed 2026-08-20: this asserted `#24695c`, Viho's teal, which was the default
    from adoption until the owner asked for the two surfaces to match. The hex is
    `--public-deep` in `app/(public)/public.css`; asserting it here is what stops the
    back office drifting off the marketing site by a later edit to either one.
    """
    assert DEFAULT_PRESET in THEME_PRESETS
    assert THEME_PRESETS[DEFAULT_PRESET].brand == "#034f46"


def test_the_viho_teal_is_still_selectable():
    """Demoting teal from default must not remove it.

    Its values are Viho's own, byte for byte, and anyone who prefers the original
    look keeps it — the demotion was a change of default, not a deletion.
    """
    assert THEME_PRESETS["teal"].brand == "#24695c"


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


#: The full CSS contract: five brand channels plus the derived tint family that
#: used to be frozen hex in `tailwind.config.ts` (the 2026-08-13 leak fix). A
#: token missing here means some call site falls back to the compiled default —
#: green — while its siblings change, which is exactly the bug this pins.
EXPECTED_VARIABLES = {
    # The dark chart ramp, mapped in by `:root.dark` — see the note in globals.css.
    "--chart-seq-dark-1", "--chart-seq-dark-2",
    "--chart-seq-dark-3", "--chart-seq-dark-4",
    "--brand", "--brand-dark", "--brand-darker", "--brand-light", "--brand-on-dark",
    "--surface-wash", "--surface-tile", "--surface-border", "--night-border",
    "--tone-success",
    # Added 2026-08-20 — the accent and the sequential chart ramp now travel with
    # the theme. See `test_accent_travels_with_the_theme` for why that reversed.
    "--accent", "--accent-dark", "--accent-light",
    "--chart-seq-1", "--chart-seq-2", "--chart-seq-3", "--chart-seq-4",
}


@pytest.mark.parametrize("key", PRESET_KEYS)
def test_css_variables_cover_every_brand_token(key):
    variables = css_variables(key)
    assert set(variables) == EXPECTED_VARIABLES
    for value in variables.values():
        parts = value.split()
        assert len(parts) == 3 and all(0 <= int(p) <= 255 for p in parts)


def test_accent_travels_with_the_theme():
    """**Reversed 2026-08-20.** This asserted the opposite — that `accent` was
    deliberately absent from the emitted variables.

    That was right while the accent was Viho's fixed tan: a *companion* colour at 22
    call sites, chosen to sit beside any brand rather than to follow one. It stopped
    being right when the accent became a choice made **from the brand's own
    temperature**. Leaving it fixed meant the two monochrome presets — whose entire
    purpose is neutrality — carried a yellow accent, and a crimson brand carried an
    amber one, two warm mid-tones doing the same job.

    So the accent is themed now, and this test pins the direction rather than
    deleting the old assertion silently.
    """
    for key in ("indigo", "crimson", "shadcn-black"):
        variables = css_variables(key)
        assert "--accent" in variables

    # The three families are genuinely distinct, not one value relabelled.
    cool = css_variables("indigo")["--accent"]
    warm = css_variables("crimson")["--accent"]
    mono = css_variables("shadcn-black")["--accent"]
    assert len({cool, warm, mono}) == 3


def test_a_custom_brand_colour_still_gets_a_full_pack():
    """A custom hex has no preset behind it, so every derived value must self-tune.

    This is the argument against hand-picking a ground and an accent per preset:
    `brand_color` accepts any colour, and there would be nothing to hand-pick for.
    """
    variables = css_variables(None, "#7c3aed")
    assert set(variables) == EXPECTED_VARIABLES
    # A violet brand must not land on pine's cream ground.
    red, green, blue = (int(part) for part in variables["--surface-wash"].split())
    assert blue > red, "a cool brand's chrome should not be warm"


# --- The colour engine (custom brand colours, 2026-08-13) --------------------


def test_derived_teal_matches_the_curated_preset_dark_shades():
    """The derivation ratios were reverse-engineered from the teal preset; if
    someone retunes them, the curated look silently drifts. dark/darker must
    stay byte-close to Viho's own values."""
    shades = theme.derive_shades("#24695c")
    assert shades.brand == "#24695c"
    assert shades.brand_dark == "#17433b"
    # One bit of rounding tolerance on the deepest shade.
    assert abs(int(shades.brand_darker[1:3], 16) - 0x10) <= 1


@pytest.mark.parametrize("colour", ["#8b1e3f", "#4d54b6", "#1a1a1a"])
def test_derived_shades_clear_both_aa_axes(colour):
    shades = theme.derive_shades(colour)
    report = theme.contrast_report(shades)
    assert report["white_on_brand"] >= theme.MIN_CONTRAST
    assert report["on_dark_on_card"] >= theme.MIN_CONTRAST


def test_a_pale_pick_is_refused_with_evidence_and_a_way_out():
    with pytest.raises(theme.BrandColourError) as excinfo:
        theme.validate_brand_colour("#ffd34d")
    assert excinfo.value.measured < theme.MIN_CONTRAST
    # The suggestion is a same-hue shade that itself passes.
    suggestion = excinfo.value.suggestion
    assert suggestion is not None
    assert theme.contrast_ratio("#ffffff", suggestion) >= theme.MIN_CONTRAST


def test_short_hex_normalises_and_garbage_is_refused():
    assert theme.validate_brand_colour(" #136 ") == "#113366"
    with pytest.raises(theme.BrandColourError):
        theme.validate_brand_colour("teal")


def test_custom_colour_wins_over_preset_and_bad_custom_degrades():
    """Same precedence as the read path promises, including the degrade."""
    custom = css_variables("indigo", "#8b1e3f")
    assert custom["--brand"] == "139 30 63"
    # A stored value that no longer validates must fall back to the preset,
    # never take rendering down.
    degraded = css_variables("indigo", "#ffd34d")
    assert degraded["--brand"] == css_variables("indigo")["--brand"]


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


# --- Per-user themes (2026-08-20) -------------------------------------------


def test_unknown_personal_theme_is_refused_with_the_valid_options():
    """A bad key must fail loudly, not fall back to the default.

    Silently resolving an unknown key to the default would tell someone their choice
    was saved when it was not — the same reasoning the installation-level preset
    validator already carries.
    """
    from pydantic import ValidationError

    from app.schemas.auth import UpdateProfileRequest

    with pytest.raises(ValidationError) as caught:
        UpdateProfileRequest(theme_preference="chartreuse")

    message = str(caught.value)
    assert "chartreuse" in message
    # The error names what IS valid, so the caller does not have to guess.
    assert "pine" in message and "inherit" in message


def test_inherit_is_accepted_and_is_distinct_from_absent():
    """`"inherit"` clears the override; an absent field leaves it alone.

    These must differ. If clearing were spelled `null`, it would be
    indistinguishable from "not supplied" on a partial update, and a reset-to-default
    control would silently do nothing.
    """
    from app.schemas.auth import UpdateProfileRequest

    cleared = UpdateProfileRequest(theme_preference="inherit")
    absent = UpdateProfileRequest()

    assert cleared.model_dump(exclude_unset=True) == {"theme_preference": "inherit"}
    assert "theme_preference" not in absent.model_dump(exclude_unset=True)


@pytest.mark.parametrize("key", PRESET_KEYS)
def test_every_preset_is_a_valid_personal_choice(key):
    """Anything selectable at the installation level is selectable personally.

    The two lists must not drift: a preset offered in the admin picker but refused by
    the personal one would be a difference nobody would think to look for.
    """
    from app.schemas.auth import UpdateProfileRequest

    assert UpdateProfileRequest(theme_preference=key).theme_preference == key
