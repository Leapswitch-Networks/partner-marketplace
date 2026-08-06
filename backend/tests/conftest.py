"""Shared test setup.

**The environment is set before any `app.*` import, and that ordering is
load-bearing.** `app.core.config` constructs `Settings()` at module scope and
`app.db.session` builds an engine at module scope, so both read the environment
the moment they are first imported. `conftest.py` is imported before any test
module, which makes this the only place the variables can be set from.

Without it, a machine with no `backend/.env` — which is every CI runner — fails
at collection with a Pydantic validation error for `DATABASE_URL`, and that error
looks like a broken test suite rather than a missing file.

The URL is never connected to by the default suite. `create_engine` does not open
a socket, so the pure-logic tests here need no database at all; tests that do need
one carry the `db` marker and are deselected in CI (see `.github/workflows/ci.yml`).
"""

import os

# Set before the imports below, deliberately — see the module docstring.
os.environ.setdefault(
    "DATABASE_URL", "postgresql+psycopg2://test:test@localhost:5432/test_does_not_connect"
)
# 48 url-safe bytes, so it clears the production length floor and the suite can
# exercise the *valid* production path as well as the rejections.
os.environ.setdefault("SECRET_KEY", "test-only-key-BTFRtQ3nQ7pXcVzKmJ8sLdW2yH4gNbA6eR9uT1oI5vC")
# Never inherit a developer's APP_ENV. A local `.env` with APP_ENV=production would
# otherwise make the whole suite boot through the production validator.
os.environ["APP_ENV"] = "development"
# 4 rounds instead of 12. bcrypt cost is exponential and the hashing tests would
# otherwise spend seconds proving something 4 rounds proves identically.
os.environ.setdefault("BCRYPT_ROUNDS", "4")

import pytest  # noqa: E402

from app.core.config import Settings  # noqa: E402

#: A production configuration with every rule satisfied. Tests copy it and break
#: exactly one field, so a failure names the rule that fired rather than leaving
#: you to work out which of eight problems was reported.
VALID_PRODUCTION: dict[str, object] = {
    "APP_ENV": "production",
    "DATABASE_URL": "postgresql+psycopg2://user:pw@db.internal:5432/marketplace",
    "SECRET_KEY": "P9xK2mQ7vZ4nR8tB6yL3jH5wS1cD0fG-aE_uI+oN=rT9pXmVzQ",
    "COOKIE_SECURE": True,
    "MAIL_BACKEND": "smtp",
    "SMTP_HOST": "smtp.example.com",
    "CORS_ORIGINS": "https://partners.example.com",
    "LOG_FORMAT": "json",
    "RATE_LIMIT_ENABLED": True,
}


def production_settings(**overrides: object) -> Settings:
    """Build a production `Settings`, overriding one field at a time.

    `_env_file=None` is required. Without it pydantic-settings still reads
    `backend/.env`, so a developer's real `LOG_FORMAT=console` would make the
    "valid production config boots" test fail on their machine and pass in CI —
    the worst kind of test.
    """
    return Settings(_env_file=None, **{**VALID_PRODUCTION, **overrides})


@pytest.fixture
def valid_production() -> Settings:
    return production_settings()
