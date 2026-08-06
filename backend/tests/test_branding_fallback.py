"""The environment fallback, which is what makes this core reusable.

Every `app_settings` column is nullable and NULL means *"use the environment"*, not
*"empty"*. Three properties depend on that and each fails in a way that is easy to
ship:

  * a fresh install has **no row at all**, and the sign-in page still has to render
    a name — if this breaks, the first screen of a new deployment is blank
  * clearing a field in the settings form must **restore the deployment default**,
    not blank the application's name
  * an override on one field must not suppress the fallback on the others

No database. `_resolve` takes the row (or None) and reads attributes, so a namespace
is a complete substitute — and testing it directly is what keeps these assertions
about the fallback rule rather than about SQLAlchemy.
"""

from types import SimpleNamespace

import pytest

from app.core.config import settings
from app.schemas.settings import UpdateBrandingRequest
from app.services.settings_service import _FALLBACKS, _resolve


def test_no_row_falls_back_for_every_field():
    """The fresh-install case. A missing row must resolve, not raise."""
    for column, env_attr in _FALLBACKS.items():
        assert _resolve(None, column, env_attr) == getattr(settings, env_attr)


def test_null_column_falls_back():
    """Clearing an override restores the deployment default."""
    row = SimpleNamespace(app_name=None)
    assert _resolve(row, "app_name", "APP_NAME") == settings.APP_NAME


def test_empty_string_falls_back_too():
    """`""` is treated as unset, not as a valid name.

    The schema maps a blank submission to NULL, but a row written before that rule
    existed — or by a direct SQL edit — could hold `""`. Falling back rather than
    rendering it means the worst case is the default name, not a nameless
    application.
    """
    assert _resolve(SimpleNamespace(app_name=""), "app_name", "APP_NAME") == settings.APP_NAME


def test_stored_value_wins():
    row = SimpleNamespace(app_name="Acme Cloud Portal")
    assert _resolve(row, "app_name", "APP_NAME") == "Acme Cloud Portal"


def test_fields_fall_back_independently():
    """An override on one field must not suppress the fallback on another.

    This is the mixed state a real settings form produces — someone renames the
    application and leaves the tagline alone — so it is the common case, not an
    edge one.
    """
    row = SimpleNamespace(
        app_name="Acme Cloud Portal", app_short_name=None, monogram="AC",
        chrome_subtitle=None, tagline=None,
    )
    assert _resolve(row, "app_name", "APP_NAME") == "Acme Cloud Portal"
    assert _resolve(row, "monogram", "APP_MONOGRAM") == "AC"
    assert _resolve(row, "tagline", "APP_TAGLINE") == settings.APP_TAGLINE
    assert _resolve(row, "app_short_name", "APP_SHORT_NAME") == settings.APP_SHORT_NAME


def test_every_branding_field_has_a_configured_default():
    """No field may resolve to empty on a fresh install.

    Guards the specific mistake of adding a column to `_FALLBACKS` pointing at a
    `Settings` field that defaults to `""` — the symptom would be one blank label
    in the chrome of every new deployment, which nobody would trace back to here.
    """
    for env_attr in _FALLBACKS.values():
        assert getattr(settings, env_attr), f"settings.{env_attr} must have a non-empty default"


# --- The blank-means-reset rule ---------------------------------------------


@pytest.mark.parametrize("blank", ["", "   ", "\t", "\n"])
def test_blank_submission_becomes_null(blank):
    """A cleared form field means "reset", so it must reach the column as NULL.

    Storing `""` instead would render an application with no name in the sidebar and
    no obvious way for the user to understand what they did.
    """
    parsed = UpdateBrandingRequest(app_name=blank)
    assert parsed.app_name is None


def test_values_are_trimmed():
    assert UpdateBrandingRequest(app_name="  Acme  ").app_name == "Acme"


def test_omitted_and_null_are_distinguishable():
    """The whole reason the update is `exclude_unset` rather than `exclude_none`.

    Omitted means "leave it alone"; explicit null means "clear the override". If
    these collapsed, a field could never be reset once set — the service would have
    no way to tell "don't touch" from "clear".
    """
    omitted = UpdateBrandingRequest(app_name="Acme")
    assert "tagline" not in omitted.model_dump(exclude_unset=True)

    explicit = UpdateBrandingRequest(app_name="Acme", tagline=None)
    dumped = explicit.model_dump(exclude_unset=True)
    assert "tagline" in dumped and dumped["tagline"] is None


def test_monogram_length_is_enforced():
    """Two characters is the badge's capacity; more clips silently in the UI."""
    with pytest.raises(ValueError):
        UpdateBrandingRequest(monogram="ABC")
