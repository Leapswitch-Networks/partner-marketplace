"""The credential seeder's safety rules.

`seed_api_credentials.py` exists so a go-live does not mean pasting secrets into
the Integrations screen by hand. The reason it needs a test file of its own is
that every interesting property is a *refusal*, and a refusal that quietly stops
working is indistinguishable from one that never existed.

Four of them, and the first is the reason the module was written the way it was:

1. **It reads no credential from the repository**, and this asserts it against the
   source — the file must stay free of anything credential-shaped. The reference's
   `ApiCredentialsSeeder.php` holds eleven live secrets inline; that is fine in a
   private repo and would be a publication here (PM-4).
2. **A credentials file that git tracks is refused, not warned about.** A warning
   is useless: the mistake is made at `git add`, not at seed time.
3. **Placeholders are refused under `APP_ENV=production`** — a fake value that
   seeds cleanly looks configured and is not.
4. **Nothing it reports contains a value.** Every message is slugs, field keys and
   outcomes, because an operator pastes seeder output into a ticket.

Mostly pure: the collection and refusal logic needs no database. The two tests
that write are marked `db`.
"""

from __future__ import annotations

import json
import pathlib
import re

import pytest

from app.core.config import settings
from app.db import seed_api_credentials as seeder

BACKEND = pathlib.Path(__file__).resolve().parents[1]
SEEDER_SOURCE = BACKEND / "app" / "db" / "seed_api_credentials.py"
EXAMPLE_FILE = BACKEND / "seed_api_credentials.example.json"


class _Schema:
    def __init__(self, field_key: str, *, is_encrypted: bool = True) -> None:
        self.field_key = field_key
        self.is_encrypted = is_encrypted
        self.is_required = True


class _Provider:
    def __init__(self, slug: str, keys: list[str]) -> None:
        self.slug = slug
        self.name = slug.title()
        self.id = 1
        self.display_order = 1
        self.schemas = [_Schema(k) for k in keys]


@pytest.fixture
def provider():
    return _Provider("anthropic", ["api_key", "default_model"])


class TestTheSourceCarriesNoCredential:
    """**The property PM-4 was closed to establish.**

    Asserted against the file's own text, because this is the one thing about this
    module that cannot be checked behaviourally: a seeder with a secret baked in
    works perfectly.
    """

    def test_no_credential_shaped_literal_appears_in_the_seeder(self):
        source = SEEDER_SOURCE.read_text(encoding="utf-8")
        # Provider token formats, and long opaque strings. `SEED_CRED_` names and
        # dunder/identifier text are excluded — they are the API, not secrets.
        patterns = {
            "slack bot token": r"xox[baprs]-[A-Za-z0-9-]{10,}",
            "anthropic key": r"sk-ant-[A-Za-z0-9\-_]{10,}",
            "google api key": r"AIza[0-9A-Za-z\-_]{20,}",
            "google client secret": r"GOCSPX-[A-Za-z0-9\-_]{10,}",
            "private key block": r"-----BEGIN [A-Z ]*PRIVATE KEY-----",
            "opaque quoted blob": r"[\"'][A-Za-z0-9+/]{40,}={0,2}[\"']",
        }
        found = {name: p for name, p in patterns.items() if re.search(p, source)}
        assert not found, (
            f"credential-shaped literals in {SEEDER_SOURCE.name}: {sorted(found)}. "
            "This repository is public — values belong in the deployment's environment."
        )

    def test_the_seeder_defines_no_default_file_path_inside_the_repo(self):
        """A default like `backend/seed_api_credentials.json` would invite exactly
        the file that must never exist here. There is deliberately no default."""
        assert not hasattr(seeder, "DEFAULT_CREDENTIALS_FILE")
        assert seeder.FILE_ENV == "SEED_API_CREDENTIALS_FILE"

    def test_the_example_file_is_all_placeholders(self):
        """It is committed, so every value in it must be one the seeder itself
        would refuse in production."""
        parsed = json.loads(EXAMPLE_FILE.read_text(encoding="utf-8"))
        real = []
        for slug, fields in parsed.items():
            if slug.startswith("_") or not isinstance(fields, dict):
                continue
            for key, value in fields.items():
                # Non-secret settings are legitimately real-looking.
                if key in {"mailer", "port", "encryption", "from_name", "enabled", "default_model"}:
                    continue
                if not seeder._looks_like_placeholder(str(value)) and ".invalid" not in str(value):
                    real.append(f"{slug}.{key}")
        assert not real, (
            f"the committed example file has values that do not read as fake: {real}. "
            "Every entry must be a placeholder or use a .invalid host."
        )


class TestValueCollection:
    def test_an_environment_variable_supplies_a_field(self, provider, monkeypatch):
        monkeypatch.setenv("SEED_CRED_ANTHROPIC_API_KEY", "from-env")
        assert seeder.collect_values(provider, {}) == {"api_key": "from-env"}

    def test_the_environment_wins_over_the_file(self, provider, monkeypatch):
        """A deployment overrides a baked-in default, never the reverse."""
        monkeypatch.setenv("SEED_CRED_ANTHROPIC_API_KEY", "from-env")
        collected = seeder.collect_values(provider, {"anthropic": {"api_key": "from-file"}})
        assert collected == {"api_key": "from-env"}

    def test_an_undeclared_field_is_ignored_but_reported(self, provider, monkeypatch):
        """Ignored so a leftover variable cannot block a deployment; reported so a
        typo in a real field name is visible instead of silently doing nothing."""
        monkeypatch.setenv("SEED_CRED_ANTHROPIC_API_KEYY", "typo")
        assert "api_keyy" not in seeder.collect_values(provider, {})
        assert seeder.unknown_field_names(provider, {}) == ["api_keyy"]

    def test_a_field_that_is_not_supplied_is_absent_rather_than_blank(self, provider):
        """Absent means "leave the stored value alone" once it reaches
        `_apply_field_values`. Sending `""` for every unsupplied field would wipe
        the non-encrypted ones on every run."""
        assert seeder.collect_values(provider, {"anthropic": {"api_key": "x"}}) == {"api_key": "x"}

    def test_env_var_names_are_derived_predictably(self):
        assert seeder._env_name("mail", "from_address") == "SEED_CRED_MAIL_FROM_ADDRESS"
        assert seeder._env_name("google", "client_secret") == "SEED_CRED_GOOGLE_CLIENT_SECRET"


class TestItRefusesATrackedFile:
    """The mistake happens at `git add`, so the guard has to be a refusal.

    A file outside the repository is the operator's business. One *inside* it that
    git already tracks means the next commit publishes its contents, and by then a
    printed warning has not helped anybody.
    """

    def test_a_tracked_file_inside_the_repo_is_refused(self, monkeypatch):
        """The git answer is faked rather than relied on.

        **The backend container has no git binary and no `.git` directory** — so
        the guard short-circuits there by design, and a test that shelled out for
        real would pass on a developer machine and silently assert nothing in CI.
        Stubbing the subprocess tests the refusal branch itself, everywhere.
        """
        class _Tracked:
            returncode = 0

        monkeypatch.setattr(seeder.subprocess, "run", lambda *a, **k: _Tracked())
        monkeypatch.setenv(seeder.FILE_ENV, str(BACKEND / "requirements.txt"))

        with pytest.raises(SystemExit) as excinfo:
            seeder._load_file_values()
        message = str(excinfo.value)
        assert "REFUSING" in message
        assert "rotated" in message, (
            "the refusal must say that an already-committed secret needs rotating — "
            "deleting the file does not unpublish it"
        )

    def test_an_untracked_file_inside_the_repo_is_allowed_through(
        self, monkeypatch, tmp_path
    ):
        """Inside the repo but untracked is the operator's business — the guard is
        about what the next commit would publish, not about location."""
        class _Untracked:
            returncode = 1

        monkeypatch.setattr(seeder.subprocess, "run", lambda *a, **k: _Untracked())
        seeder._reject_tracked_file(BACKEND / "not-committed.json")  # must not raise

    def test_the_guard_is_inert_where_git_is_unavailable(self, monkeypatch):
        """Documented behaviour, pinned so nobody 'fixes' it into a crash.

        The production container has no git at all. Raising there would make the
        seeder unusable in the exact place it is meant to run; the guard exists for
        the developer machine, where the mistake is actually made.
        """
        def _no_git(*_args, **_kwargs):
            raise FileNotFoundError("git")

        monkeypatch.setattr(seeder.subprocess, "run", _no_git)
        seeder._reject_tracked_file(BACKEND / "requirements.txt")  # must not raise

    def test_a_path_outside_the_repo_is_not_rejected_by_the_git_check(self, tmp_path):
        """`tmp_path` is outside the repository, so the guard must pass it through
        and let the normal file handling take over."""
        seeder._reject_tracked_file(tmp_path / "creds.json")  # must not raise

    def test_a_missing_file_is_a_clear_error(self, tmp_path, monkeypatch):
        monkeypatch.setenv(seeder.FILE_ENV, str(tmp_path / "nope.json"))
        with pytest.raises(SystemExit, match="not a file"):
            seeder._load_file_values()

    def test_malformed_json_reports_position_and_never_content(self, tmp_path, monkeypatch):
        """A parse error that echoed the offending line would print a secret."""
        bad = tmp_path / "creds.json"
        bad.write_text('{"anthropic": {"api_key": "s3cret-do-not-print"', encoding="utf-8")
        monkeypatch.setenv(seeder.FILE_ENV, str(bad))
        with pytest.raises(SystemExit) as excinfo:
            seeder._load_file_values()
        assert "s3cret-do-not-print" not in str(excinfo.value)
        assert "line" in str(excinfo.value)

    def test_an_unset_variable_yields_no_file_values(self, monkeypatch):
        monkeypatch.delenv(seeder.FILE_ENV, raising=False)
        assert seeder._load_file_values() == {}


class TestPlaceholderRules:
    @pytest.mark.parametrize(
        "value",
        [
            "changeme",
            "CHANGEME",
            "change-me",
            "placeholder",
            "insecure",
            "your-secret",
            "todo",
            # Matched whole rather than as substrings — too generic otherwise.
            "secret",
            "password",
        ],
    )
    def test_obvious_placeholders_are_recognised(self, value):
        assert seeder._looks_like_placeholder(value) is True

    @pytest.mark.parametrize("value", ["xxxxxxxx", "your-api-key-here", "aaaaaaaaaaaa"])
    def test_some_fake_looking_values_are_NOT_caught_and_that_is_known(self, value):
        """**Pinned as a limitation, not asserted as correct behaviour.**

        `config._PLACEHOLDER_SUBSTRINGS` is a fixed list, so a fake value nobody
        thought of sails through — `xxxxxxxx` and `your-api-key-here` both do. The
        production guard is therefore a catch for the *common* mistakes, not proof
        that a seeded value is real.

        Recorded here rather than fixed by widening the list: this seeder shares
        that list with the startup environment audit, and loosening it would start
        rejecting real `.env` values in a different code path. If it should be
        stricter, that belongs in `config.py` with `test_config_environment.py`
        updated alongside.
        """
        assert seeder._looks_like_placeholder(value) is False

    @pytest.mark.parametrize("value", ["smtp", "587", "tls", "true", "claude-sonnet-5"])
    def test_ordinary_settings_are_not_placeholders(self, value):
        """These are real values for non-secret fields and must seed cleanly."""
        assert seeder._looks_like_placeholder(value) is False

    def test_an_empty_value_is_not_treated_as_a_placeholder(self):
        """Empty means "not supplied" elsewhere in this module; conflating the two
        would turn an omitted optional field into a production failure."""
        assert seeder._looks_like_placeholder("") is False

    def test_the_rules_come_from_config_not_a_second_list(self):
        """Re-listing them here would let the seeder and the startup environment
        audit drift into disagreeing about what a placeholder is."""
        source = SEEDER_SOURCE.read_text(encoding="utf-8")
        assert "_PLACEHOLDER_EXACT" in source
        assert "from app.core.config import" in source


@pytest.mark.db
class TestSeedingReportsKeysAndNeverValues:
    def test_a_dry_run_names_fields_but_no_values(self, monkeypatch):
        monkeypatch.setenv("SEED_CRED_ANTHROPIC_API_KEY", "sk-ant-do-not-print-me")
        from app.db.session import SessionLocal

        db = SessionLocal()
        try:
            providers, fields, notes = seeder.seed_credentials(
                db, environment="seedtest", dry_run=True
            )
        finally:
            db.close()

        joined = " ".join(notes)
        assert "sk-ant-do-not-print-me" not in joined, (
            "the seeder printed a credential — operators paste this output into tickets"
        )
        assert "api_key" in joined, "the field key should be reported"
        assert providers >= 1 and fields >= 1

    def test_a_dry_run_writes_nothing(self, monkeypatch):
        monkeypatch.setenv("SEED_CRED_ANTHROPIC_API_KEY", "sk-ant-do-not-print-me")
        from sqlalchemy import select

        from app.db.session import SessionLocal
        from app.models.api_credential import ApiCredential

        db = SessionLocal()
        try:
            before = db.scalars(
                select(ApiCredential).where(ApiCredential.environment == "seedtest")
            ).all()
            seeder.seed_credentials(db, environment="seedtest", dry_run=True)
            after = db.scalars(
                select(ApiCredential).where(ApiCredential.environment == "seedtest")
            ).all()
            assert len(before) == len(after) == 0
        finally:
            db.close()

    def test_production_refuses_a_placeholder(self, monkeypatch):
        monkeypatch.setenv("SEED_CRED_ANTHROPIC_API_KEY", "changeme")
        monkeypatch.setattr(settings, "APP_ENV", "production")
        from app.db.session import SessionLocal

        db = SessionLocal()
        try:
            with pytest.raises(SystemExit, match="placeholder"):
                seeder.seed_credentials(db, environment="seedtest", dry_run=True)
        finally:
            db.close()
