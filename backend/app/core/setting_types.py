"""How a setting's stored value is interpreted, validated and edited.

Port of LeapDesk's `App\\Enums\\SettingType` (Module 11, read 2026-08-11). Five
types, the same five names, the same labels, the same coercion rules — the only
difference is the language.

**Values are always stored as JSON** so the column keeps one shape whatever the
type is. This module decides how that JSON is cast on read, what the UI renders
to edit it, and what the API will accept on write.
"""

from typing import Any, Literal, get_args

#: The wire and storage vocabulary. Matches LeapDesk's backing values exactly —
#: `bool`, `int`, `string`, `text`, `json` — so a settings export from either
#: system is readable by the other.
SettingType = Literal["bool", "int", "string", "text", "json"]

SETTING_TYPES: tuple[SettingType, ...] = get_args(SettingType)

#: What the type is called on screen. LeapDesk's labels, verbatim: they are
#: written for an administrator, not a developer — "Yes / No" rather than
#: "Boolean", because the person editing a setting does not think in types.
SETTING_TYPE_LABELS: dict[SettingType, str] = {
    "bool": "Yes / No",
    "int": "Number",
    "string": "Text",
    "text": "Long text",
    "json": "JSON",
}

#: Upper bounds, matching LeapDesk's `validationRule()` — `string|max:1000`,
#: `text|max:20000`. A `string` setting is a label or a domain; a `text` setting
#: is a template or an allowlist. Neither is a place to store a document.
STRING_MAX = 1000
TEXT_MAX = 20_000


def type_options() -> list[dict[str, str]]:
    """`[{value, label}]`, for the type filter on the Configuration screen."""
    return [{"value": t, "label": SETTING_TYPE_LABELS[t]} for t in SETTING_TYPES]


class SettingValueError(ValueError):
    """A value that is not acceptable for its setting's declared type.

    Raised by `coerce`, translated to a 422 by the router. Separate from a bare
    `ValueError` so a genuine bug inside coercion is not reported to the user as
    "that value is not valid".
    """


def coerce(setting_type: SettingType, value: Any) -> Any:
    """Cast an incoming value into the shape this type stores, or raise.

    **This is stricter than LeapDesk's `cast()`, deliberately.** PHP's `(int)`
    turns `"abc"` into `0` and `(bool)` turns `"false"` into `True`, so their
    controller has to run a separate `validationRule()` first and relies on
    Laravel's validator catching the bad input before the cast ever sees it.
    Merging the two here means there is no order to get wrong: a value either
    survives coercion or it is rejected, and the same function is the answer to
    "is this valid" and "what do we store".

    The one place that matters most is `bool`. A checkbox that silently accepted
    the string `"false"` as `True` is the kind of setting bug nobody finds until
    a security control is quietly off.
    """
    if setting_type == "bool":
        if isinstance(value, bool):
            return value
        # Accept the wire forms a JSON client or an HTML form can produce, and
        # nothing else. `"maybe"` is an error, not `False`.
        if value in (0, 1):
            return bool(value)
        if isinstance(value, str) and value.lower() in ("true", "false", "1", "0"):
            return value.lower() in ("true", "1")
        raise SettingValueError("Expected yes or no.")

    if setting_type == "int":
        # `bool` is a subclass of `int` in Python, so `True` would pass an
        # `isinstance(value, int)` check and be stored as 1. Rejected explicitly.
        if isinstance(value, bool):
            raise SettingValueError("Expected a number.")
        if isinstance(value, int):
            return value
        if isinstance(value, str) and value.strip().lstrip("-").isdigit():
            return int(value.strip())
        raise SettingValueError("Expected a whole number.")

    if setting_type in ("string", "text"):
        if value is None:
            return None
        if not isinstance(value, (str, int, float)):
            raise SettingValueError("Expected text.")
        text = str(value)
        limit = STRING_MAX if setting_type == "string" else TEXT_MAX
        if len(text) > limit:
            raise SettingValueError(f"Too long — the maximum is {limit:,} characters.")
        return text

    if setting_type == "json":
        # LeapDesk validates `array`, which in PHP covers both a list and a map.
        # Both are allowed here for the same reason: an allowlist is a list, a
        # per-environment override is a map, and both are real settings.
        if isinstance(value, (list, dict)):
            return value
        raise SettingValueError("Expected a JSON object or array.")

    raise SettingValueError(f"Unknown setting type {setting_type!r}.")


__all__ = [
    "SettingType",
    "SETTING_TYPES",
    "SETTING_TYPE_LABELS",
    "SettingValueError",
    "coerce",
    "type_options",
]
