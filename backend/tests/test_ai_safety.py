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
