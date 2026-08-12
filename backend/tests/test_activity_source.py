"""The audit trail's source discriminator and presentation maps.

Everything here is database-free — it covers the parts of `activity_service`
that are pure functions over `sys.argv`, a dict and a string. The scoped queries
(the causer sandbox, the JSONB `source` predicate, the filter options) need real
rows and are probed against the running database instead; see `DAILY_CHANGES.md`
for 2026-08-12.

**Why the source discriminator is worth a test at all.** It is the only thing
that distinguishes "an admin did this in the UI" from "the seeder wrote it on a
fresh database", and the second kind has no causer at all. Get it wrong and the
trail is confidently misleading, which is worse than a trail that says nothing.
"""

import sys

import pytest

from app.services import activity_service as svc


class TestSourceDetection:
    """`_detect_source` reads argv, because we have no `runningInConsole()`."""

    @pytest.mark.parametrize(
        "argv,expected",
        [
            (["/usr/local/bin/uvicorn", "app.main:app", "--reload"], svc.SOURCE_WEB),
            (["/usr/local/bin/gunicorn", "app.main:app"], svc.SOURCE_WEB),
            # `python -m uvicorn` — argv[0] is the module's own file.
            (["/site-packages/uvicorn/__main__.py", "app.main:app"], svc.SOURCE_WEB),
            (["python", "-m", "app.main"], svc.SOURCE_WEB),
            (["python", "-m", "app.db.seed_settings"], svc.SOURCE_SEEDER),
            (["python", "app/db/seed_api_providers.py"], svc.SOURCE_SEEDER),
            (["python", "-m", "app.cli.purge_activity"], svc.SOURCE_COMMAND),
            # An unrecognised entry point is a command, not a web request. The
            # failure mode has to be "mislabelled as CLI", never "claimed to be a
            # user action" — the trail must not invent a person.
            (["/some/new/thing"], svc.SOURCE_COMMAND),
            ([], svc.SOURCE_COMMAND),
        ],
    )
    def test_detects(self, argv, expected, monkeypatch):
        monkeypatch.setattr(sys, "argv", argv)
        assert svc._detect_source() == expected

    def test_override_wins_over_detection(self, monkeypatch):
        monkeypatch.setattr(sys, "argv", ["/usr/local/bin/uvicorn", "app.main:app"])
        with svc.use_source(svc.SOURCE_SEEDER):
            assert svc._source_context()["source"] == svc.SOURCE_SEEDER
        # And is released — a leaked override would relabel every later row.
        assert svc._source_context()["source"] == svc.SOURCE_WEB

    def test_override_is_released_on_error(self, monkeypatch):
        monkeypatch.setattr(sys, "argv", ["/usr/local/bin/uvicorn", "app.main:app"])
        with pytest.raises(RuntimeError), svc.use_source(svc.SOURCE_SEEDER):
            raise RuntimeError("boom")
        assert svc._source_context()["source"] == svc.SOURCE_WEB


class TestSourceContext:
    def test_web_rows_carry_only_the_source(self, monkeypatch):
        monkeypatch.setattr(sys, "argv", ["/usr/local/bin/uvicorn", "app.main:app"])
        assert svc._source_context() == {"source": svc.SOURCE_WEB}

    def test_cli_rows_carry_who_and_where(self, monkeypatch):
        monkeypatch.setattr(sys, "argv", ["python", "-m", "app.db.seed_settings"])
        context = svc._source_context()
        assert context["source"] == svc.SOURCE_SEEDER
        # A CLI row has no causer, so this is the only attribution it will ever
        # have. Empty values are dropped rather than stored as "".
        assert "app.db.seed_settings" in context["actor_label"]
        assert context["host"]
        assert all(value for value in context.values())

    def test_context_overrides_a_caller_supplied_source(self, monkeypatch):
        """Nothing gets to choose its own label — that is the entire value of it."""
        monkeypatch.setattr(sys, "argv", ["python", "-m", "app.db.seed_settings"])
        merged = svc._with_context({"source": "web", "ip": "10.0.0.1"})
        assert merged["source"] == svc.SOURCE_SEEDER
        assert merged["ip"] == "10.0.0.1"

    def test_redaction_still_applies(self, monkeypatch):
        monkeypatch.setattr(sys, "argv", ["/usr/local/bin/uvicorn", "app.main:app"])
        merged = svc._with_context({"password": "hunter2", "email": "a@b.test"})
        assert "password" not in merged
        assert merged["email"] == "a@b.test"
        assert merged["source"] == svc.SOURCE_WEB

    def test_no_properties_still_yields_a_source(self, monkeypatch):
        """Every row is labelled. A row with no detail is still a row from
        somewhere, and an unlabelled one can never be filtered."""
        monkeypatch.setattr(sys, "argv", ["/usr/local/bin/uvicorn", "app.main:app"])
        assert svc._with_context(None) == {"source": svc.SOURCE_WEB}


class TestDeclaredSources:
    def test_only_portable_sources_are_offered(self):
        """`tinker` and `job` are the reference's; neither exists here.

        There is no REPL wired to this app and no queue at all. A filter option
        that can never match is a claim that nothing has happened in a place that
        does not exist.
        """
        assert set(svc.SOURCES) == {"web", "seeder", "command"}
        assert set(svc.SOURCE_LABELS) == set(svc.SOURCES)


class TestPresentationMaps:
    def test_known_modules_read_as_english(self):
        assert svc.module_label("auth") == "Authentication"
        assert svc.module_label("settings") == "Configuration"
        assert svc.module_label("default") == "General"

    def test_unknown_module_falls_back_rather_than_showing_a_slug(self):
        assert svc.module_label("partner_directory") == "Partner directory"
        assert svc.module_label(None) == "General"

    def test_subject_url_substitutes_the_id(self):
        assert svc.subject_url("User", "abc-123") == "/dashboard/users/abc-123"
        assert svc.subject_url("Role", "4") == "/dashboard/roles/4"

    def test_index_only_subjects_need_no_id(self):
        """Records with no detail page link to the index they live on."""
        assert svc.subject_url("FeatureFlag", "9") == "/dashboard/feature-flags"
        assert svc.subject_url("FeatureFlag", None) == "/dashboard/feature-flags"

    def test_unmapped_subject_gets_no_link(self):
        """`Partner` has no page yet. No link is the honest answer; a link to a
        route that does not exist is a 404 the reader blames on the record."""
        assert svc.subject_url("Partner", "7") is None
        assert svc.subject_url(None, None) is None
        assert svc.subject_url("User", None) is None

    def test_every_mapped_route_is_absolute(self):
        for template in svc.SUBJECT_URLS.values():
            assert template.startswith("/dashboard/")
