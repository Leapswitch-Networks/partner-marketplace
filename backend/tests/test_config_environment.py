"""PM-37: production must refuse to boot on a development default.

Each test breaks exactly one field of an otherwise-valid production config. That
shape matters: a single test asserting "a bad config raises" would still pass if
seven of the eight rules were deleted.
"""

import pytest

from app.core.config import ConfigurationError, Settings
from tests.conftest import production_settings


def test_valid_production_config_boots():
    """The guard rail must not block a correct deployment.

    First test in the file on purpose. A validator that rejects everything is
    trivially "safe" and completely useless, and that failure mode is invisible if
    only the rejections are tested.
    """
    settings = production_settings()
    problems, _ = settings.audit_environment()
    assert problems == []
    assert settings.is_production is True


def test_development_defaults_are_untouched():
    """Nothing local changes. This is what makes PM-37 a zero-risk addition."""
    settings = Settings(
        _env_file=None,
        DATABASE_URL="postgresql+psycopg2://x:y@localhost/z",
        SECRET_KEY="short-dev-key",
    )
    assert settings.APP_ENV == "development"
    assert settings.is_production is False
    # Every unsafe default is present, and none of them is an error here.
    assert settings.COOKIE_SECURE is False
    assert settings.MAIL_BACKEND == "console"
    assert settings.LOG_FORMAT == "console"
    assert settings.audit_environment() == ([], [])


@pytest.mark.parametrize(
    ("field", "value", "expected_in_message"),
    [
        # A guessable signing key forges an access token for ANY account, which
        # makes this the highest-consequence entry in the list.
        ("SECRET_KEY", "tooshort", "SECRET_KEY"),
        ("SECRET_KEY", "changeme" * 4, "placeholder"),
        ("SECRET_KEY", "ab" * 20, "distinct"),
        ("ALGORITHM", "none", "signing"),
        ("COOKIE_SECURE", False, "cleartext"),
        # The one that fails silently AND successfully: `console` works perfectly
        # and writes a live credential to a file with a different audience than the
        # database has.
        ("MAIL_BACKEND", "console", "reset links"),
        ("MAIL_BACKEND", "carrier-pigeon", "not a known backend"),
        ("CORS_ORIGINS", "https://partners.example.com,http://localhost:3001", "localhost"),
        ("CORS_ORIGINS", "", "empty"),
        ("LOG_FORMAT", "console", "LOG_FORMAT"),
        ("RATE_LIMIT_ENABLED", False, "per-IP"),
    ],
)
def test_production_refuses_unsafe_setting(field, value, expected_in_message):
    with pytest.raises(ConfigurationError) as excinfo:
        production_settings(**{field: value})
    assert expected_in_message in str(excinfo.value)


def test_repeated_placeholder_that_clears_the_length_floor_is_refused():
    """The length floor is defeated by repetition, and this test proved it.

    `"changeme" * 4` is 32 characters, so it clears the floor. The first version of
    the validator matched placeholders by equality, so it passed both rules and
    would have signed production tokens. That is why placeholders are now matched as
    a substring, and why there is an entropy floor behind it.
    """
    with pytest.raises(ConfigurationError) as excinfo:
        production_settings(SECRET_KEY="changeme" * 4)
    assert "placeholder" in str(excinfo.value)


def test_long_low_entropy_key_is_refused_even_without_a_known_placeholder():
    """The backstop for a repeated string nobody thought to blocklist.

    40 characters, 2 distinct — clears the length floor, matches no placeholder, and
    carries essentially no entropy.
    """
    with pytest.raises(ConfigurationError) as excinfo:
        production_settings(SECRET_KEY="ab" * 20)
    message = str(excinfo.value)
    assert "distinct" in message
    assert "repeated pattern" in message


def test_a_real_generated_key_passes_the_entropy_floor():
    """The floor must not reject the thing the error message tells you to run.

    Asserted with the actual generator rather than a handwritten literal, so the
    threshold is checked against real `token_urlsafe` output.
    """
    import secrets

    for _ in range(20):
        problems, _ = production_settings(
            SECRET_KEY=secrets.token_urlsafe(48)
        ).audit_environment()
        assert problems == []


def test_samesite_none_without_secure_is_refused():
    """PM-2's failure mode, asserted rather than remembered.

    A `SameSite=None` cookie sent without `Secure` is rejected outright by
    browsers, so the expiring `Set-Cookie` is dropped and **logout leaves the
    session cookie in place**. That is silent, and it only appears in the
    cross-site deployment shape nobody tests locally.
    """
    with pytest.raises(ConfigurationError) as excinfo:
        production_settings(COOKIE_SAMESITE="none", COOKIE_SECURE=False)
    assert "SameSite=None" in str(excinfo.value)


def test_smtp_backend_without_host_is_refused():
    with pytest.raises(ConfigurationError) as excinfo:
        production_settings(MAIL_BACKEND="smtp", SMTP_HOST="")
    assert "SMTP_HOST" in str(excinfo.value)


def test_all_problems_are_reported_at_once():
    """One boot, one complete list.

    Reporting the first problem only would mean a deployer fixes one setting,
    redeploys, and discovers the next — turning an eight-item checklist into eight
    failed deploys.
    """
    with pytest.raises(ConfigurationError) as excinfo:
        production_settings(
            COOKIE_SECURE=False,
            MAIL_BACKEND="console",
            LOG_FORMAT="console",
            RATE_LIMIT_ENABLED=False,
        )
    message = str(excinfo.value)
    assert "4 setting(s) are unsafe" in message
    for expected in ("cleartext", "reset links", "LOG_FORMAT", "per-IP"):
        assert expected in message


def test_empty_staff_domains_warns_but_does_not_refuse():
    """An external-only installation is legitimate, so this cannot be a problem.

    Added 2026-08-20 with the rule itself. `CORE_EXTRACTION_PLAN.md` § 5.3
    proposed making empty the *shipped default*; checking the call sites showed
    that would refuse every Google sign-in, make internal invitations impossible
    and stop the self-registration guard firing — so the default stayed, and this
    warning covers the deployment that genuinely wants none of those.

    Asserted as a warning and an empty `problems` deliberately: promoting it to a
    problem would refuse to boot a marketplace-only installation, which is the
    configuration this rule exists to *permit* while making it deliberate.
    """
    settings = production_settings(STAFF_EMAIL_DOMAINS="")
    problems, warnings = settings.audit_environment()
    assert problems == []
    assert any("STAFF_EMAIL_DOMAINS is empty" in w for w in warnings)


def test_empty_and_shipped_default_warnings_are_mutually_exclusive():
    """One `STAFF_EMAIL_DOMAINS` warning at a time, never two.

    They are an `if`/`elif` for a reason: a value cannot be both "still the value
    this project ships" and "empty", and reporting two rules for one field would
    read as two separate misconfigurations.
    """
    shipped = production_settings()
    _, shipped_warnings = shipped.audit_environment()
    staff_warnings = [w for w in shipped_warnings if "STAFF_EMAIL_DOMAINS" in w]
    assert len(staff_warnings) == 1
    assert "still the shipped default" in staff_warnings[0]

    empty = production_settings(STAFF_EMAIL_DOMAINS="")
    _, empty_warnings = empty.audit_environment()
    staff_warnings = [w for w in empty_warnings if "STAFF_EMAIL_DOMAINS" in w]
    assert len(staff_warnings) == 1
    assert "is empty" in staff_warnings[0]


def test_empty_staff_domains_makes_every_address_external():
    """The precondition the two service error messages branch on.

    `google_service` and `invitation_service` each render a different sentence
    when `staff_domains` is empty, because the joined-domain version reads as a
    truncated error — "Google sign-in is limited to ." — and told the reader
    nothing. Both branches key on exactly this, so it is pinned here.
    """
    settings = production_settings(STAFF_EMAIL_DOMAINS="")
    assert settings.staff_domains == []
    assert settings.is_staff_email("anyone@anywhere.com") is False
    # Whitespace-only is the same case: the property filters empty segments, so
    # a value of ", ," cannot produce a domain list of [""] that matches nothing
    # while looking configured.
    assert production_settings(STAFF_EMAIL_DOMAINS=" , ,").staff_domains == []


def test_proxy_and_hsts_warn_but_do_not_refuse():
    """Both are legitimate production choices, so refusing would be wrong.

    `TRUST_PROXY_HEADERS` especially must never be auto-corrected: enabling it
    without a proxy that overwrites `X-Forwarded-For` restores the measured PM-26
    bypass exactly — 14 requests through a limit of 10.
    """
    settings = production_settings(HSTS_ENABLED=False, TRUST_PROXY_HEADERS=False)
    problems, warnings = settings.audit_environment()
    assert problems == []
    # Three, not two, since 2026-08-17: `STAFF_EMAIL_DOMAINS` now warns when it
    # is still the value this project ships (CORE_EXTRACTION_PLAN.md phase 5).
    # `VALID_PRODUCTION` does not set it, so a production config that never
    # changed the domain reports it — which is the whole point of the rule.
    #
    # The count is pinned deliberately rather than loosened to `>= 2`: a warning
    # nobody meant to add is exactly as much of a drift as one that went missing.
    assert len(warnings) == 3
    assert any("HSTS" in w for w in warnings)
    assert any("TRUST_PROXY_HEADERS" in w for w in warnings)
    assert any("STAFF_EMAIL_DOMAINS" in w for w in warnings)
