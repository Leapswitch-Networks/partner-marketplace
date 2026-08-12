"""The Platform API's token rules and the `Principal` union.

Database-free. The gate itself — active outranking a valid token, expiry,
revocation, `last_used_at` — is probed against real rows; see `DAILY_CHANGES.md`
for 2026-08-12.

**Two things here would be silent if they broke**, which is why they are tested
rather than reasoned about: that a machine principal can never satisfy a
permission check, and that abilities are validated against the catalogue before a
token is minted.
"""

import pytest
from fastapi import HTTPException

from app.core import principal as principal_module
from app.core.principal import (
    ANONYMOUS,
    AnonymousPrincipal,
    MachinePrincipal,
    UserPrincipal,
)
from app.models.user import User
from app.services import api_consumer_service as svc


def machine(*abilities: str) -> MachinePrincipal:
    return MachinePrincipal(
        consumer_id="c1",
        consumer_slug="riaas",
        token_id="t1",
        token_prefix="pmp_abc123",
        abilities=frozenset(abilities),
    )


class TestPrincipalSeparation:
    def test_a_machine_holds_no_permission_whatsoever(self):
        """**The single most important assertion in this file.** `require_permission`
        guards every administrative route; a machine answering True to any
        permission would be a token that can administer the application."""
        m = machine("platform.ping")
        for permission in [
            "user-view", "user-delete", "api-token-manage", "settings-update",
            "platform.ping", "", "*",
        ]:
            assert m.has_permission(permission) is False

    def test_a_machine_holds_only_the_abilities_it_was_granted(self):
        m = machine("platform.ping")
        assert m.has_ability("platform.ping") is True
        assert m.has_ability("platform.read") is False

    def test_a_person_holds_no_abilities(self):
        """An ability names what a *token* may do. Satisfying one with a human's
        permission would let a browser session reach a machine-facing endpoint."""
        user = User(id="u1", email="a@b.test", first_name="A", last_name="B")
        p = UserPrincipal(user=user)
        assert p.has_ability("platform.ping") is False
        assert p.has_ability("anything") is False

    def test_anonymous_refuses_everything_by_construction(self):
        """Not by every caller remembering to special-case it — the branch itself
        answers False, which is what `PARTNER_DIRECTORY_PLAN.md` warned about
        when it flagged `if actor is None: return stmt`."""
        assert ANONYMOUS.has_permission("user-view") is False
        assert ANONYMOUS.has_ability("platform.ping") is False
        assert ANONYMOUS.id is None

    def test_for_user_maps_none_to_anonymous_not_to_an_empty_user(self):
        assert isinstance(principal_module.for_user(None), AnonymousPrincipal)
        user = User(id="u1", email="a@b.test", first_name="A", last_name="B")
        assert isinstance(principal_module.for_user(user), UserPrincipal)

    def test_the_kinds_are_distinguishable(self):
        assert principal_module.is_machine(machine()) is True
        assert principal_module.is_machine(ANONYMOUS) is False
        assert principal_module.is_human(ANONYMOUS) is False


class TestTokenHashing:
    def test_it_is_sha256_not_bcrypt(self):
        """Bcrypt salts, so an arriving token could not be looked up at all —
        every request would load and check every row."""
        digest = svc._hash("pmp_example")
        assert len(digest) == 64
        assert all(c in "0123456789abcdef" for c in digest)

    def test_the_same_token_always_hashes_the_same_way(self):
        """The property a salted hash would destroy, and the reason the column
        can carry a unique index."""
        assert svc._hash("pmp_example") == svc._hash("pmp_example")

    def test_different_tokens_hash_differently(self):
        assert svc._hash("pmp_a") != svc._hash("pmp_b")

    def test_a_long_token_is_not_truncated(self):
        """Bcrypt cuts at 72 bytes; the tokens minted here are longer than that."""
        long_a = "pmp_" + "a" * 200
        long_b = "pmp_" + "a" * 199 + "b"
        assert svc._hash(long_a) != svc._hash(long_b)


class TestAbilityValidation:
    def test_a_known_ability_passes(self):
        assert svc._validate_abilities(["platform.ping"]) == ["platform.ping"]

    def test_an_unknown_ability_is_refused_at_write_time(self):
        """A typo would otherwise mint a token carrying an ability nothing
        honours — 'granted' on the screen, 403 at the consumer."""
        with pytest.raises(HTTPException) as exc:
            svc._validate_abilities(["platform.ping", "platform.everything"])
        assert exc.value.status_code == 422
        assert "platform.everything" in exc.value.detail

    def test_an_empty_grant_is_refused(self):
        with pytest.raises(HTTPException) as exc:
            svc._validate_abilities([])
        assert "can do nothing" in exc.value.detail

    def test_duplicates_collapse_and_the_result_is_ordered(self):
        assert svc._validate_abilities(["platform.ping", " platform.ping "]) == [
            "platform.ping"
        ]

    def test_the_catalogue_is_deliberately_small(self):
        """Not an omission. There is no domain data to expose and no consumer
        asking, so inventing a taxonomy now would mean minting tokens whose
        abilities nothing honours."""
        assert len(svc.ABILITIES) >= 1
        assert {a.name for a in svc.ABILITIES} == svc.ABILITY_NAMES

    def test_every_ability_explains_itself_to_the_person_granting_it(self):
        for ability in svc.ABILITIES:
            assert ability.sensitivity in {"low", "medium", "high"}
            assert len(ability.description) > 40, ability.name


class TestSlugRules:
    @pytest.mark.parametrize("slug", ["riaas", "riaas-reporting", "a1", "x-y-z"])
    def test_valid(self, slug):
        assert svc.SLUG_PATTERN.match(slug)

    @pytest.mark.parametrize(
        "slug", ["RIAAS", "riaas_reporting", "-riaas", "riaas-", "riaas--x", "ri aas", ""]
    )
    def test_invalid(self, slug):
        assert not svc.SLUG_PATTERN.match(slug)


class TestTokenShape:
    def test_the_prefix_is_fixed_and_greppable(self):
        """A fixed prefix is what lets a secret scanner recognise a leaked token,
        and this repository is public."""
        assert svc.TOKEN_PREFIX == "pmp_"

    def test_the_stored_prefix_is_short_enough_to_be_useless(self):
        assert svc.PREFIX_LENGTH <= 16


class TestRejectionOutcomes:
    def test_every_outcome_is_distinct(self):
        outcomes = {
            svc.OUTCOME_NO_TOKEN, svc.OUTCOME_UNKNOWN, svc.OUTCOME_EXPIRED,
            svc.OUTCOME_REVOKED, svc.OUTCOME_INACTIVE, svc.OUTCOME_MISSING_ABILITY,
        }
        assert len(outcomes) == 6

    def test_a_rejection_carries_its_reason_for_our_log_only(self):
        """The router turns all of them into one 401. Telling a caller that a
        token is 'expired' rather than 'unknown' confirms it once existed."""
        error = svc.TokenRejected(svc.OUTCOME_EXPIRED)
        assert error.outcome == svc.OUTCOME_EXPIRED

    def test_require_ability_refuses_what_was_not_granted(self):
        with pytest.raises(svc.TokenRejected) as exc:
            svc.require_ability(machine("platform.ping"), "platform.read")
        assert exc.value.outcome == svc.OUTCOME_MISSING_ABILITY

    def test_require_ability_allows_what_was(self):
        svc.require_ability(machine("platform.ping"), "platform.ping")


class TestRetention:
    def test_a_policy_exists_on_day_one(self):
        """The reference has none, and this table grows fastest exactly when
        something is wrong."""
        assert svc.REQUEST_LOG_RETENTION_DAYS > 0
