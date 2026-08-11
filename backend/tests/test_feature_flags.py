"""The feature-flag resolution rule, pinned.

This is the test that makes flags safe to adopt. The rule is four branches long
and every one of them fails *silently* when it is wrong — a feature appears for
someone it should not, or vanishes for someone it should reach, and nothing in
any log says a flag was consulted. There is no symptom to notice, so the
behaviour has to be asserted rather than reviewed.

**No database.** `is_enabled_for` is pure — a flag row and a user — and the
unknown-key rule needs only a session that finds nothing. That keeps this in the
default suite, which CI runs; a test carrying the `db` marker would be deselected
there and would prove nothing on the machine that matters.

The user is a stub rather than `app.models.User` on purpose: the real model
resolves `role_names` through a relationship, so using it would drag in a
database to test a function that does not need one.
"""

from __future__ import annotations

import pytest

from app.models.feature_flag import FeatureFlag
from app.services.feature_flag_service import feature_enabled, is_enabled_for


class StubUser:
    """The two things `is_enabled_for` actually reads off a user."""

    def __init__(self, user_id: str, roles: tuple[str, ...] = ()) -> None:
        self.id = user_id
        self._roles = set(roles)

    def has_role(self, *names: str) -> bool:
        # Matches `User.has_role`: any-of, not all-of.
        return bool(self._roles & set(names))


class EmptySession:
    """A session that finds no row. Enough to pin the unknown-key rule."""

    def scalar(self, *_args, **_kwargs):
        return None


ALICE = StubUser("user-alice")
BOB = StubUser("user-bob")
ADMIN = StubUser("user-admin", roles=("Admin",))
STAFF = StubUser("user-staff", roles=("Staff",))


def flag(**kw) -> FeatureFlag:
    """A flag row, unsaved. Defaults to the ordinary 'live for everyone' state."""
    return FeatureFlag(
        key=kw.get("key", "test.flag"),
        name="Test flag",
        enabled=kw.get("enabled", True),
        target_roles=kw.get("target_roles"),
        target_user_ids=kw.get("target_user_ids"),
    )


# --- 1. The master switch ----------------------------------------------------


@pytest.mark.parametrize("user", [ALICE, ADMIN, None])
def test_disabled_flag_is_off_for_everyone_including_its_targets(user):
    """`enabled=False` beats every target.

    The direction that matters: if targeting could override the master switch,
    "turn it off" would mean "turn it off except for the people I listed", and
    the one control an operator reaches for in an incident would not work.
    """
    off = flag(enabled=False, target_roles=["Admin"], target_user_ids=["user-alice"])
    assert is_enabled_for(off, user) is False


# --- 2. No targeting means everyone ------------------------------------------


@pytest.mark.parametrize("roles,users", [(None, None), ([], []), (None, []), ([], None)])
def test_untargeted_flag_is_on_for_everyone(roles, users):
    """NULL and `[]` are interchangeable on both axes, in all four combinations."""
    live = flag(target_roles=roles, target_user_ids=users)
    assert is_enabled_for(live, ALICE) is True
    assert is_enabled_for(live, None) is True


# --- 3. Targeting present: anonymous is not a target -------------------------


def test_anonymous_is_off_once_any_targeting_exists():
    """`None` cannot match an id or a role, so it must be off — not on.

    Returning True here would leak a targeted feature to every logged-out
    visitor, which is the worst available failure for a staged rollout.
    """
    assert is_enabled_for(flag(target_user_ids=["user-alice"]), None) is False
    assert is_enabled_for(flag(target_roles=["Admin"]), None) is False


# --- 4. User and role targeting ----------------------------------------------


def test_user_targeting_matches_only_the_named_ids():
    targeted = flag(target_user_ids=["user-alice"])
    assert is_enabled_for(targeted, ALICE) is True
    assert is_enabled_for(targeted, BOB) is False


def test_role_targeting_matches_only_holders():
    targeted = flag(target_roles=["Admin"])
    assert is_enabled_for(targeted, ADMIN) is True
    assert is_enabled_for(targeted, STAFF) is False


def test_an_explicit_user_id_wins_over_an_unlisted_role():
    """The narrower statement wins.

    Naming an account turns the flag on for them even though their role is not
    targeted — checked before the role test, and the order is the contract.
    """
    both = flag(target_roles=["Admin"], target_user_ids=["user-staff"])
    assert is_enabled_for(both, STAFF) is True   # named, role not listed
    assert is_enabled_for(both, ADMIN) is True   # role listed, not named
    assert is_enabled_for(both, BOB) is False    # neither


# --- 5. The one that must never regress --------------------------------------


@pytest.mark.parametrize("key", ["no.such.flag", "", "typo.in.the.key", "test.flag "])
def test_an_unknown_key_is_false(key):
    """**A missing flag is OFF.**

    The single most important line in the module. If an unknown key read as
    enabled, a typo in a `feature_enabled(...)` call would silently ship an
    unfinished feature to everyone — and because the key is never found, nothing
    would report that a flag had been consulted and missed.

    Note `"test.flag "` with a trailing space: a key is matched exactly, so a
    near-miss is a miss. That is the typo case stated as a test.
    """
    assert feature_enabled(EmptySession(), key, ALICE) is False
    assert feature_enabled(EmptySession(), key, None) is False


def test_a_deleted_flag_reads_as_off():
    """Deleting a flag turns its feature off, never on.

    Same mechanism as the unknown key — the row is simply not found — but worth
    its own name, because "what happens to live code when I delete this?" is the
    question the delete dialog has to answer.
    """
    assert feature_enabled(EmptySession(), "was.deleted", ADMIN) is False
