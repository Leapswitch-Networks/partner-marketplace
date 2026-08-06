"""Schemas for installation-wide settings."""

from pydantic import BaseModel, Field, field_validator


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
