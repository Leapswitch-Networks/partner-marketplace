"""The AI assistant's guardrails — the parts that are pure functions.

`database_query` is the most dangerous code in the parity scope, so the rules
that decide *what it may touch* are tested here in isolation, without a database
and without a model. The parts that need real rows — the read-only connection
refusing writes, redaction on a real table, tool gating for a real user — are
probed against the running database; see `DAILY_CHANGES.md` for 2026-08-12.

The question each test answers is the same one: **if the model asks for something
it should not have, what stops it?**
"""

import pytest

from app.ai import guard
from app.ai.tools import DENIED_TABLE_PATTERN, OPERATORS, is_queryable


class TestTableDenylist:
    @pytest.mark.parametrize(
        "table",
        [
            # Ours, by name.
            "api_credentials",
            "api_credential_values",
            "api_credential_schemas",
            "user_sessions",
            "alembic_version",
            # The assistant's own memory. The reference leaves these readable,
            # which lets anyone who can use the assistant ask it what OTHER
            # people asked it. Not ported.
            "agent_conversations",
            "agent_conversation_messages",
            "ai_message_feedback",
            # The reference's, kept so a table arriving under a familiar name is
            # denied before anyone notices it arrived.
            "password_resets",
            "personal_access_tokens",
            "failed_jobs",
            "migrations",
            "oauth_clients",
            "telescope_entries",
        ],
    )
    def test_denied(self, table):
        assert is_queryable(table) is False

    @pytest.mark.parametrize(
        "table",
        ["users", "roles", "permissions", "partners", "user_invitations",
         "activity_log", "settings", "feature_flags", "data_access_grants"],
    )
    def test_business_tables_are_readable(self, table):
        assert is_queryable(table) is True

    def test_matching_is_by_substring_so_new_tables_inherit_the_rule(self):
        """A table nobody has thought to add is denied if its name says what it
        holds. `partner_api_credentials` does not exist; it is denied anyway."""
        assert is_queryable("partner_api_credentials") is False
        assert is_queryable("legacy_password_archive") is False
        assert is_queryable("stripe_tokens") is False

    def test_case_and_whitespace_do_not_evade_it(self):
        assert is_queryable("  API_CREDENTIALS  ") is False
        assert is_queryable("User_Sessions") is False

    def test_empty_is_not_queryable(self):
        assert is_queryable("") is False
        assert is_queryable("   ") is False

    def test_the_pattern_itself_is_case_insensitive(self):
        assert DENIED_TABLE_PATTERN.search("APICredentialValues")


class TestOperatorAllowlist:
    def test_matches_the_reference_exactly(self):
        assert set(OPERATORS) == {"=", "!=", "<>", "<", "<=", ">", ">=", "like", "in"}

    @pytest.mark.parametrize(
        "operator",
        ["or", "union", ";", "--", "exists", "between", "regexp", "is not", ""],
    )
    def test_nothing_else_is_accepted(self, operator):
        assert operator not in OPERATORS


class TestOutputGuard:
    @pytest.mark.parametrize(
        "secret",
        [
            "sk-ant-api03-AbCdEf123456789",
            "xoxb-1234567890-abcdefghij",
            "ghp_abcdefghijklmnopqrstuvwxyz012345",
            "AKIAIOSFODNN7EXAMPLE",
            "-----BEGIN RSA PRIVATE KEY-----",
        ],
    )
    def test_credential_shapes_are_redacted(self, secret):
        reply, flags = guard.sanitize(f"Here you go: {secret} — use it wisely.")
        assert secret not in reply
        assert guard.REDACTION in reply
        assert flags == [guard.FLAG_SECRET]

    def test_our_own_ciphertext_is_redacted(self):
        """Ours, not the reference's. A Fernet token in a reply would mean a
        stored credential value had escaped Module 7's masking."""
        reply, flags = guard.sanitize("value: gAAAAABm1234567890abcdefghijklmnop")
        assert "gAAAAA" not in reply
        assert guard.FLAG_SECRET in flags

    def test_several_secrets_raise_the_flag_once(self):
        reply, flags = guard.sanitize(
            "sk-ant-aaaaaaaaaa and ghp_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
        )
        assert flags == [guard.FLAG_SECRET]
        assert "sk-ant" not in reply and "ghp_" not in reply

    def test_ordinary_text_is_untouched(self):
        text = "Ayush Mishra joined on 3 August and holds the Admin role."
        reply, flags = guard.sanitize(text)
        assert reply == text
        assert flags == []

    def test_pii_is_deliberately_not_blocked(self):
        """An internal staff tool. Staff legitimately need a contact address, and
        a guard that redacted them would make the assistant useless."""
        text = "Contact them on ayush@example.com or +91 98765 43210."
        reply, flags = guard.sanitize(text)
        assert reply == text
        assert flags == []

    def test_non_inr_currency_flags_but_does_not_redact(self):
        """The figure may be right and merely unlabelled. Deleting a number from
        an answer is worse than surfacing it for review."""
        reply, flags = guard.sanitize("The plan is $49 per month.")
        assert "$49" in reply
        assert flags == [guard.FLAG_CURRENCY]

    def test_a_secret_and_a_currency_raise_both(self):
        reply, flags = guard.sanitize("key sk-ant-zzzzzzzzzz costs €10")
        assert set(flags) == {guard.FLAG_SECRET, guard.FLAG_CURRENCY}

    def test_rupees_are_fine(self):
        _, flags = guard.sanitize("The total is ₹1,50,000.")
        assert flags == []

    def test_empty_and_none_do_not_raise(self):
        assert guard.sanitize("") == ("", [])
        assert guard.sanitize(None) == ("", [])


class TestPromptIsRebuiltNotStored:
    def test_the_prompt_names_the_permission_tier(self):
        """The two-tier access statement is the load-bearing half of the prompt,
        so it must reflect the caller rather than a stored copy."""
        from app.ai import prompt

        source = prompt.build.__doc__ or ""
        assert "this user" in source.lower()
        # The module states the rule; a stored prompt would go stale on a role
        # change and would sit in a table the assistant can be asked to read.
        assert "not stored" in (prompt.__doc__ or "").lower()


@pytest.mark.db
class TestTheQueryToolRefusesRatherThanExecutes:
    """The § 8.1 audit's adversarial probe of `database_query`, made permanent.

    `TestTableDenylist` and `TestOperatorAllowlist` above test the *predicates*.
    This runs the tool itself against a real read-only connection, because the
    question a reviewer actually has is not "does `is_queryable` return False"
    but **"what happens when the model is talked into asking for it"** — and the
    two only agree while every call site remembers to consult the predicate.

    Probed by hand during the audit on 2026-08-12; all eight refused. Written
    down so the ninth change to this file has to keep it that way.
    """

    @pytest.fixture
    def db(self):
        from app.db.readonly import readonly_session

        with readonly_session() as session:
            yield session

    def test_the_connection_is_read_only_at_the_database(self, db):
        """**Not a setting we assert — a refusal Postgres issues.**

        An earlier attempt set this with `SET SESSION CHARACTERISTICS`, which is
        transactional: the rollback discarded it and the session was read-write
        while reporting success. It is a libpq startup parameter now, and this
        asks the server rather than the config.
        """
        from sqlalchemy import text
        from sqlalchemy.exc import InternalError

        assert db.execute(text("show default_transaction_read_only")).scalar() == "on"

        # `WHERE 1=0` matches nothing, so a passing test proves the refusal and a
        # failing one still cannot damage a row.
        with pytest.raises(InternalError, match="read-only"):
            db.execute(text("UPDATE users SET first_name = 'x' WHERE 1=0"))

    @pytest.mark.parametrize(
        "label,kwargs",
        [
            ("statement terminator in the table", {"table": "users; DROP TABLE users--"}),
            ("a denied table by name", {"table": "api_credential_values"}),
            ("a denied table by substring", {"table": "user_sessions"}),
            (
                "an injected order_by",
                {"table": "users", "order_by": "id; DELETE FROM users--"},
            ),
            (
                "an injected operator",
                {
                    "table": "users",
                    "where": [{"column": "email", "operator": "= 1 OR 1", "value": "x"}],
                },
            ),
            (
                "an injected where column",
                {"table": "users", "where": [{"column": "1=1--", "operator": "=", "value": "x"}]},
            ),
        ],
    )
    def test_it_returns_an_error_instead_of_running_anything(self, db, label, kwargs):
        import json

        from app.ai import tools

        payload = json.loads(tools.database_query(**kwargs))
        assert "error" in payload, f"{label} was not refused: {payload}"

    def test_a_secret_column_asked_for_by_name_still_comes_back_redacted(self, db):
        """Naming the column is the obvious move, so it is the one to test."""
        import json

        from app.ai import tools

        payload = json.loads(tools.database_query(table="users", columns=["password", "email"]))
        assert payload.get("rows"), "no rows came back, so nothing was proven"
        assert all(row["password"] == tools.REDACTED for row in payload["rows"])
        # The point of the redaction is that the *rest* of the row still works.
        assert any(row["email"] for row in payload["rows"])

    def test_an_absurd_limit_is_capped(self, db):
        import json

        from app.ai import tools

        payload = json.loads(tools.database_query(table="users", limit=100_000))
        assert payload["count"] <= tools.MAX_LIMIT
