"""Schemas for installation-wide settings."""

from pydantic import BaseModel, Field, field_validator

from app.core.theme import THEME_PRESETS


class BrandingResponse(BaseModel):
    """The project's identity, fully resolved.

    **Every field is non-optional here even though every column is nullable**, because
    the service has already applied the environment fallback. A client should never
    have to know that a value came from the database rather than from `.env`, and it
    must never have to render a placeholder for a missing name.
    """

    app_name: str
    app_short_name: str
    monogram: str
    chrome_subtitle: str
    tagline: str
    theme_preset: str
    #: The stored custom hex, or None when a preset is in effect. Nullable is
    #: honest here where it is not for the text fields: "no custom colour" is a
    #: real state the picker must render, not a gap to paper over.
    brand_color: str | None = None
    #: Which of the two actually painted the page — `"custom"` wins while set.
    theme_source: str = "preset"
    #: Emitted so the client can inline them without knowing the palette.
    theme_css_variables: dict[str, str]
    #: Cache-busted path to the uploaded logo, or None to fall back to the monogram.
    logo_url: str | None = None
    #: Cache-busted path to the uploaded favicon, or None for the bundled default.
    favicon_url: str | None = None


class UpdateBrandingRequest(BaseModel):
    """Partial update. Only supplied fields change (PM-15's rule).

    `None` and an omitted field mean different things:

      * **omitted** — leave whatever is stored alone
      * **`null`** — clear the override and fall back to the environment again

    That distinction is the reason the columns are nullable, and it is why this
    cannot use `exclude_none`. `model_dump(exclude_unset=True)` is the correct call.
    """

    app_name: str | None = Field(default=None, max_length=120)
    app_short_name: str | None = Field(default=None, max_length=40)
    monogram: str | None = Field(default=None, max_length=2)
    chrome_subtitle: str | None = Field(default=None, max_length=60)
    tagline: str | None = Field(default=None, max_length=200)
    theme_preset: str | None = Field(default=None, max_length=40)
    #: A custom `#rrggbb`. Format and blank-reset are handled here; the CONTRAST
    #: rule is enforced in the service via `theme.validate_brand_colour`, because
    #: its refusal carries structured evidence (the measured ratio and a passing
    #: suggestion) that a pydantic message string cannot.
    brand_color: str | None = Field(default=None, max_length=7)

    @field_validator("brand_color")
    @classmethod
    def _blank_colour_means_reset(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        return trimmed or None

    @field_validator("theme_preset")
    @classmethod
    def _known_preset_only(cls, value: str | None) -> str | None:
        """Reject an unknown preset key loudly, with the valid options listed.

        Note this is stricter than `theme.resolve`, which falls back silently — and
        the asymmetry is deliberate. **Reading** must never fail: a preset retired
        from the catalog while a row still names it has to degrade to the default
        rather than take every page down. **Writing** should fail: silently storing
        a key that resolves to the default would tell an administrator their choice
        was applied when it was discarded.
        """
        if value is None:
            return None
        trimmed = value.strip()
        if not trimmed:
            return None
        if trimmed not in THEME_PRESETS:
            raise ValueError(
                f"Unknown theme preset {trimmed!r}. "
                f"Available: {', '.join(sorted(THEME_PRESETS))}"
            )
        return trimmed

    @field_validator("app_name", "app_short_name", "monogram", "chrome_subtitle", "tagline")
    @classmethod
    def _blank_means_reset(cls, value: str | None) -> str | None:
        """Trim, and treat a whitespace-only string as a reset rather than a value.

        A form submits `""` for a field the user cleared. Storing that would render
        an application with no name anywhere — a blank sidebar and a blank browser
        tab — with no obvious way for the user to understand what they did. Mapping
        it to NULL means "clear the override", which is what clearing a field in a
        settings form actually means.
        """
        if value is None:
            return None
        trimmed = value.strip()
        return trimmed or None


class ThemePresetOption(BaseModel):
    """One row of the theme catalog, for the picker.

    Carries the hexes so the UI can paint a swatch, and the measured ratios so the
    numbers are visible where the choice is made rather than buried in a test.
    """

    key: str
    label: str
    brand: str
    brand_on_dark: str
    contrast_white_on_brand: float
    contrast_on_dark_on_card: float


class ThemePresetsResponse(BaseModel):
    presets: list[ThemePresetOption]
    #: Which key applies when none is stored, so the picker can mark it.
    default_key: str


class ThemePreviewRequest(BaseModel):
    """Try a colour or a preset without saving anything.

    Exactly one of the two should be set; a custom colour wins when both are,
    matching the read path's precedence so the preview can never disagree with
    what saving would do.
    """

    brand_color: str | None = Field(default=None, max_length=7)
    theme_preset: str | None = Field(default=None, max_length=40)


class ThemePreviewResponse(BaseModel):
    #: Ready to set on `:root` — same shape the branding read emits.
    css_variables: dict[str, str]
    #: The two AA ratios, measured for the derived shades.
    contrast: dict[str, float]
    #: The normalised hex actually used (e.g. `#abc` expanded), or None for a preset.
    brand_color: str | None = None
