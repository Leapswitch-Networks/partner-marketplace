"""`APP_ENV` and a credential's `environment` are different vocabularies.

Regression test for a live defect found on 2026-08-12 while probing the AI
assistant. `credential_service.resolve` used `APP_ENV` verbatim — `"development"`
on every developer machine — while the credentials UI offers only `local`,
`staging` and `production`. No row it could create was a row `resolve` would ever
look for, so **every credential consumer silently found nothing in development**,
and the symptom was indistinguishable from having configured nothing at all: the
assistant reported itself off with a key sitting in the database.

The mapping is one function and it is tested here because the failure it prevents
is silent. Nothing raised, nothing logged, and the screen said the honest-looking
thing.
"""

import pytest

from app.services.credential_service import ENVIRONMENTS, environment_for_app_env


class TestEnvironmentMapping:
    @pytest.mark.parametrize(
        "app_env,expected",
        [
            ("development", "local"),
            ("dev", "local"),
            ("local", "local"),
            ("test", "local"),
            ("testing", "local"),
            ("staging", "staging"),
            ("production", "production"),
        ],
    )
    def test_known_environments(self, app_env, expected):
        assert environment_for_app_env(app_env) == expected

    @pytest.mark.parametrize("app_env", ["DEVELOPMENT", "  Production  ", "Staging"])
    def test_case_and_whitespace_are_tolerated(self, app_env):
        """`APP_ENV` is set by hand in a `.env` file, so it arrives however
        someone typed it."""
        assert environment_for_app_env(app_env) in ENVIRONMENTS

    @pytest.mark.parametrize("app_env", ["qa", "sandbox", "", None, "prod-eu-2"])
    def test_an_unknown_environment_reads_production(self, app_env):
        """The conservative reading. An install with a bespoke `APP_ENV` should
        find production credentials rather than none — and a startup crash over a
        naming mismatch would be a worse failure than the one being fixed."""
        assert environment_for_app_env(app_env) == "production"

    def test_every_mapped_value_is_a_real_environment(self):
        """The mapping cannot point at an environment the UI cannot create —
        which is precisely the bug this file exists for."""
        for app_env in ["development", "dev", "local", "test", "testing", "staging", "production"]:
            assert environment_for_app_env(app_env) in ENVIRONMENTS
