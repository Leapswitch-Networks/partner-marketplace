"""The three security layers of Global Search, pinned.

Module 8 is unusual: `searchable_entities` rows name a **model** and a **set of
columns**, and an administrator edits them from a web form. Every string in that
table is therefore untrusted input that reaches a resolution step — which is the
shape of an RCE if the resolution is `importlib`, and of an injection if the
column name is interpolated into SQL.

None of that is visible in a passing feature test: a search box that returns
users looks identical whether `model_class` is resolved against a dict or against
`__import__`. So the *absence* of those mechanisms is what gets asserted here.

**No database.** `resolve_model`, `allowed_fields` and `render_template` are
pure, which keeps this in the default suite that CI actually runs — a `db`-marked
test would be deselected there and prove nothing on the machine that matters.
"""

from __future__ import annotations

import sys

import pytest

from app.models.role import Role
from app.models.searchable_entity import SearchableEntity
from app.models.user import User
from app.services.search_service import (
    MIN_QUERY_LENGTH,
    _build_url,
    allowed_fields,
    is_sensitive_column,
    mapped_column_names,
    registered_model_names,
    render_template,
    resolve_model,
    searchable_column_names,
)

# --- L2: the model allowlist -------------------------------------------------

#: Strings an admin could type into `model_class`. Every one of them is a real
#: importable module or a plausible dotted path — which is the point: if
#: resolution were `importlib.import_module`, these would all succeed.
HOSTILE_MODEL_CLASSES = [
    "os",
    "app.core.config",
    "app.models.user",
    "builtins",
    "subprocess",
    "app.core.security",
    "sys",
    "",
    "   ",
    # Near-misses on a real key: resolution is exact, never fuzzy.
    "user",
    "USER",
    "User ",
    " User",
    "app.models.user.User",
    "User; DROP TABLE users",
]


@pytest.mark.parametrize("model_class", HOSTILE_MODEL_CLASSES)
def test_only_allowlisted_names_resolve(model_class):
    """Anything not literally a key in the registry resolves to None."""
    assert resolve_model(model_class) is None


def test_resolution_imports_nothing():
    """**Resolving a hostile name must not import the module it names.**

    The assertion that would fail loudest if someone replaced the dict lookup
    with `importlib`. `colorsys` is stdlib, harmless, and not imported by this
    application — so if it appears in `sys.modules` after this call, resolution
    imported it.
    """
    canary = "colorsys"
    sys.modules.pop(canary, None)

    assert resolve_model(canary) is None
    assert canary not in sys.modules, "resolve_model imported the module it was given"


def test_the_allowlist_is_exactly_what_is_expected():
    """A model joining the registry should be a deliberate, reviewed change.

    This fails when someone adds one — which is the intent. Update it in the same
    commit, having checked the new entry declares a row-scoping rule.
    """
    assert registered_model_names() == ["Role", "User"]


def test_registered_models_resolve_to_the_right_class():
    assert resolve_model("User").model is User
    assert resolve_model("Role").model is Role


# --- Row scoping -------------------------------------------------------------
#
# The layer most easily forgotten, because omitting it produces *more* results
# rather than an error. Asserted here with stubs rather than against the
# database, because every active account in the development database happens to
# be an admin — so a live probe silently skips the branch that matters.


class StubActor:
    def __init__(self, user_id: str, admin: bool) -> None:
        self.id = user_id
        self.has_admin_access = admin


def test_a_non_admin_search_is_narrowed_to_their_own_record():
    """Search must apply the same rule `user_service.list_users` does.

    Without this, holding `user-view` — which L1 checks — would let anyone
    enumerate every account through the search box, while the users *list*
    correctly showed them only themselves. A gate on the type is not a gate on
    the rows.
    """
    from sqlalchemy import select as sa_select

    base = sa_select(User)
    scoped = resolve_model("User").scope(base, None, StubActor("u-1", admin=False))

    assert scoped is not base, "a non-admin statement was returned unchanged"
    assert scoped.whereclause is not None
    assert "users.id" in str(scoped.whereclause)


def test_an_admin_search_is_not_narrowed():
    base = __import__("sqlalchemy").select(User)
    scoped = resolve_model("User").scope(base, None, StubActor("u-1", admin=True))
    assert scoped is base


def test_every_registered_model_declares_a_scope():
    """`scope` is not optional, so "unscoped" is always something someone wrote.

    Row scoping is the layer most easily forgotten, because omitting it produces
    *more* results rather than an error.
    """
    for name in registered_model_names():
        assert callable(resolve_model(name).scope), f"{name} has no scope function"


# --- L3: the field allowlist -------------------------------------------------


HOSTILE_FIELDS = [
    "'; DROP TABLE users; --",
    "1=1",
    "id) OR (1=1",
    "../../etc/passwd",
    "",
    "email; SELECT",
    "nonexistent_column",
]


@pytest.mark.parametrize("field", HOSTILE_FIELDS)
def test_unknown_fields_are_dropped(field):
    """A configured column the model does not have never reaches SQL."""
    assert allowed_fields(User, [field]) == []


#: Every one of these is a **real mapped column on `User`** — so the
#: mapped-column check alone accepts all of them. That is what makes this the
#: important case rather than a redundant one.
SENSITIVE_USER_COLUMNS = [
    "password",
    "password_otp",
    "password_reset_token",
    "two_factor_secret",
    "two_factor_recovery_codes",
]


@pytest.mark.parametrize("field", SENSITIVE_USER_COLUMNS)
def test_sensitive_columns_are_refused_even_though_they_exist(field):
    """**A real column is not automatically a searchable one.**

    Found by this test failing during development, which is the argument for
    writing it: `allowed_fields` originally checked only "is it mapped", and
    every name below is mapped. With that check alone an administrator could set
    `fields: ["password_reset_token"]` from the settings form and turn the
    search box into an **oracle** — paste a token, learn whose account it is.

    No code change would be needed and nothing on the screen would look wrong.
    """
    assert field in mapped_column_names(User), (
        f"{field} is no longer a column — update this test, do not delete it"
    )
    assert allowed_fields(User, [field]) == []
    assert is_sensitive_column(field)


@pytest.mark.parametrize("field", SENSITIVE_USER_COLUMNS)
def test_sensitive_columns_are_unreachable_from_a_template(field):
    """The second hole, separate from the first.

    `fields` decides what is *matched*; `display_template` decides what is
    *printed*. A template naming `{two_factor_secret}` would disclose the value
    without the column ever appearing in a search term, so the attribute dict a
    template renders from excludes them too.
    """
    assert field not in searchable_column_names(User)


def test_ordinary_columns_are_still_searchable():
    """The denylist must not be so broad that it eats the module.

    `email` and `first_name` are exactly what this search is for.
    """
    assert allowed_fields(User, ["email", "first_name", "last_name"]) == [
        "email",
        "first_name",
        "last_name",
    ]
    assert not is_sensitive_column("email")
    assert not is_sensitive_column("first_name")


def test_known_fields_survive_and_unknown_ones_are_dropped_together():
    """A row mixing good and bad fields keeps the good ones.

    Dropped rather than rejected: a renamed column should narrow the search, not
    take the search box down for everyone. The settings screen reports the
    dropped names as a health warning instead.
    """
    result = allowed_fields(User, ["email", "'; DROP TABLE users; --", "first_name"])
    assert result == ["email", "first_name"]


def test_empty_or_missing_fields_yields_nothing():
    assert allowed_fields(User, []) == []
    assert allowed_fields(User, None) == []


def test_allowed_fields_are_real_mapped_columns():
    """The allowlist is derived from the mapping, so it cannot drift from it."""
    assert set(allowed_fields(User, ["email", "first_name"])) <= mapped_column_names(User)


def test_no_sensitive_column_of_any_registered_model_is_reachable():
    """Swept across the whole registry rather than asserted per model.

    A model joining `_REGISTRY` later brings its own columns with it, and this
    is what makes that addition safe by default instead of safe if someone
    remembered to check.
    """
    for name in registered_model_names():
        model = resolve_model(name).model
        for column in searchable_column_names(model):
            assert not is_sensitive_column(column), f"{name}.{column} is reachable"


# --- Template rendering ------------------------------------------------------


def test_a_missing_field_renders_empty_not_the_placeholder():
    """"Jane {last_name}" looks like a broken product. "" looks like no surname."""
    assert render_template("{first_name} {last_name}", {"first_name": "Jane"}) == "Jane"
    assert render_template("{nope}", {}) == ""


def test_a_template_cannot_reach_anything_not_in_the_attrs_dict():
    """`attrs` is built from mapped columns, so this is the whole reachable set.

    A template naming a method, a relationship or a private attribute gets an
    empty string, not the value.
    """
    attrs = {"email": "a@b.c"}
    assert render_template("{password_hash}", attrs) == ""
    assert render_template("{__class__}", attrs) == ""
    assert render_template("{roles}", attrs) == ""


def test_none_renders_empty_rather_than_the_string_none():
    assert render_template("{email}", {"email": None}) == ""


def test_non_placeholder_braces_are_left_alone():
    """Only `[a-zA-Z0-9_.]` tokens are substituted, matching the reference."""
    assert render_template("{ not a token }", {}) == "{ not a token }"


# --- Route building ----------------------------------------------------------


def entity(**kw) -> SearchableEntity:
    base = {
        "model_class": "User",
        "label": "Users",
        "group": "Core",
        "fields": ["email"],
        "display_template": "{email}",
        "route_name": "/dashboard/users/{id}",
        "route_param_field": "id",
    }
    return SearchableEntity(**{**base, **kw})


def test_a_hit_with_no_route_value_is_dropped():
    """The reference's `safeRoute` returns null and the hit is skipped."""
    assert _build_url(entity(), {"id": None}) is None


def test_an_unsubstituted_placeholder_drops_the_hit():
    """A link to a literal `/dashboard/users/{id}` is worse than no link."""
    assert _build_url(entity(route_param_field="slug"), {"id": 1}) is None


def test_a_good_route_builds():
    assert _build_url(entity(), {"id": "abc-123"}) == "/dashboard/users/abc-123"


# --- Query floor -------------------------------------------------------------


def test_the_minimum_query_length_is_two():
    """Pinned because it is a real cost control, not a nicety.

    One character matches most of a table, and the search runs one ILIKE per
    configured entity.
    """
    assert MIN_QUERY_LENGTH == 2
