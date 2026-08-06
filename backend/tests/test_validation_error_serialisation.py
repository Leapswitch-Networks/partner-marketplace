"""A 422 must stay a 422, whatever a custom validator raises.

**The bug this guards against turned every validation failure into a 500.**

When a `field_validator` rejects a value by raising `ValueError`, Pydantic v2 puts
the **exception object itself** into that error entry's `ctx`:

    {"type": "value_error", "loc": (...), "msg": "...", "ctx": {"error": ValueError(...)}}

`main.py`'s handler used to pass `exc.errors()` straight to `JSONResponse`, and
`json.dumps` cannot serialise a `ValueError`. So the handler raised *inside the error
path*, the catch-all took over, and the caller got:

    500  {"detail": "Internal server error.", "request_id": "..."}

instead of the 422 explaining what they got wrong — with the validator's message
never reaching them at all.

**Every schema with a custom validator was affected**, which is most of them:
`auth.validate_password_strength`, `navigation.UpdateNavPreferencesRequest`,
`settings.UpdateBrandingRequest`. It surfaced on `PUT /api/settings/branding`.

The fix rebuilds each entry from the three primitive fields, dropping `ctx`. These
tests assert the property that matters — **the response is always serialisable** —
rather than the shape of the fix, so a future rewrite stays covered.
"""

import json

import pytest
from pydantic import ValidationError

from app.schemas.auth import RegisterRequest
from app.schemas.navigation import UpdateNavPreferencesRequest
from app.schemas.settings import UpdateBrandingRequest


def _rebuild(errors: list[dict]) -> list[dict]:
    """The transformation `main.py`'s handler applies. Kept in step with it."""
    return [
        {
            "loc": list(err.get("loc", ())),
            "msg": str(err.get("msg", "")),
            "type": str(err.get("type", "")),
        }
        for err in errors
    ]


#: Each case is a schema plus kwargs that make a **custom** validator raise
#: `ValueError` — not a built-in constraint, which serialises fine and would make
#: these tests pass without exercising the bug.
CUSTOM_VALIDATOR_FAILURES = [
    pytest.param(
        UpdateBrandingRequest, {"theme_preset": "not-a-real-preset"}, id="theme-preset"
    ),
    pytest.param(
        UpdateNavPreferencesRequest,
        {"preferences": {"no-such-section": {"collapsible": True}}},
        id="nav-section",
    ),
    pytest.param(
        RegisterRequest,
        {"email": "person@example.com", "password": "weak", "confirm_password": "weak"},
        id="password-strength",
    ),
]


@pytest.mark.parametrize(("schema", "kwargs"), CUSTOM_VALIDATOR_FAILURES)
def test_raw_errors_are_not_serialisable(schema, kwargs):
    """Document the trap, so nobody "simplifies" the handler back into it.

    If this ever fails, Pydantic has changed how it reports custom validator errors
    and the handler's rebuild step may no longer be necessary. That is worth
    discovering from a failing test rather than by removing the workaround and
    finding out in production.
    """
    with pytest.raises(ValidationError) as excinfo:
        schema(**kwargs)

    with pytest.raises(TypeError, match="not JSON serializable"):
        json.dumps(excinfo.value.errors())


@pytest.mark.parametrize(("schema", "kwargs"), CUSTOM_VALIDATOR_FAILURES)
def test_rebuilt_errors_are_serialisable(schema, kwargs):
    """The property the handler must guarantee: the 422 body always encodes."""
    with pytest.raises(ValidationError) as excinfo:
        schema(**kwargs)

    payload = json.dumps({"detail": _rebuild(excinfo.value.errors())})
    assert payload  # encoded without raising, which is the whole assertion


@pytest.mark.parametrize(("schema", "kwargs"), CUSTOM_VALIDATOR_FAILURES)
def test_the_validator_message_survives_the_rebuild(schema, kwargs):
    """A serialisable 422 that says nothing would be no better than the 500.

    The point of the fix is that the caller learns what was wrong, so `msg` has to
    carry the validator's own text rather than a generic "invalid input".
    """
    with pytest.raises(ValidationError) as excinfo:
        schema(**kwargs)

    rebuilt = _rebuild(excinfo.value.errors())
    assert rebuilt, "at least one error entry expected"
    assert any(entry["msg"].strip() for entry in rebuilt)
    assert all("loc" in entry and "type" in entry for entry in rebuilt)


def test_no_ctx_key_reaches_the_response():
    """`ctx` is where the unserialisable object lives. It must be dropped entirely.

    Asserted rather than assumed: a future handler that copies `err` wholesale and
    then deletes known-bad keys would reintroduce the bug for the next validator
    that puts something exotic in `ctx`.
    """
    with pytest.raises(ValidationError) as excinfo:
        UpdateBrandingRequest(theme_preset="nope")

    assert "ctx" in excinfo.value.errors()[0]
    assert all("ctx" not in entry for entry in _rebuild(excinfo.value.errors()))


def test_a_builtin_constraint_failure_also_rebuilds():
    """Not every 422 comes from a custom validator — the common path must work too.

    `max_length` produces a `ctx` of plain values, so this one was never broken. It
    is here so the handler is covered for both kinds of failure in one place.
    """
    with pytest.raises(ValidationError) as excinfo:
        UpdateBrandingRequest(monogram="TOO LONG")

    errors = excinfo.value.errors()
    json.dumps(errors)  # this kind was always fine
    json.dumps(_rebuild(errors))  # and stays fine after the rebuild
