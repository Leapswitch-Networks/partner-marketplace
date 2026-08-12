"""Webhook signing, retry policy and the destination guard.

Database-free. Delivery against a real receiver is probed separately; see
`DAILY_CHANGES.md` for 2026-08-12.

**The URL guard is the part with no equivalent in the reference**, and it is the
one most worth testing: an endpoint is a URL a user supplies that our server then
makes a POST to, which is textbook SSRF. Every case below is a real target —
cloud metadata, our own API, the private network.
"""

import hashlib
import hmac

import pytest
from fastapi import HTTPException

from app.services import webhook_service as svc


class TestSigning:
    def test_the_timestamp_is_inside_the_signed_string(self):
        """**This is what stops a replay.** A signature over the body alone would
        let a captured payload be re-sent at any later time and still verify; a
        receiver checking the timestamp's age must know the signature covers it.
        """
        body = '{"event":"partner.approved"}'
        one = svc.sign("whsec_x", 1_000_000, body)
        two = svc.sign("whsec_x", 1_000_001, body)
        assert one != two

    def test_it_is_hmac_sha256_of_timestamp_dot_body(self):
        """Pinned to the exact construction a receiver has to reimplement. If this
        changes, every receiver in the world silently starts rejecting us."""
        secret, timestamp, body = "whsec_x", 1_700_000_000, '{"a":1}'
        expected = hmac.new(
            secret.encode(), f"{timestamp}.{body}".encode(), hashlib.sha256
        ).hexdigest()
        assert svc.sign(secret, timestamp, body) == f"sha256={expected}"

    def test_a_different_secret_produces_a_different_signature(self):
        assert svc.sign("whsec_a", 1, "{}") != svc.sign("whsec_b", 1, "{}")

    def test_a_changed_body_produces_a_different_signature(self):
        assert svc.sign("s", 1, '{"a":1}') != svc.sign("s", 1, '{"a":2}')

    def test_it_is_prefixed_so_the_algorithm_is_declared(self):
        """`sha256=…`, so a receiver is not guessing, and so a future algorithm
        can be added without breaking the ones already deployed."""
        assert svc.sign("s", 1, "{}").startswith("sha256=")


class TestRetryPolicy:
    def test_the_backoff_matches_the_reference(self):
        """A receiver that is down is usually down for minutes, not milliseconds."""
        assert svc.BACKOFF_SECONDS == (30, 120, 600)

    def test_three_attempts(self):
        assert svc.MAX_ATTEMPTS == 3

    def test_the_schedule_only_grows(self):
        assert list(svc.BACKOFF_SECONDS) == sorted(svc.BACKOFF_SECONDS)

    def test_a_circuit_breaker_threshold_exists(self):
        """Without it a dead endpoint is retried on every event forever, and its
        log fills with one failure repeated until nobody reads it."""
        assert svc.FAILURE_THRESHOLD > 0

    def test_a_receiver_gets_a_bounded_amount_of_time(self):
        assert 0 < svc.TIMEOUT_SECONDS <= 30


class TestDestinationGuard:
    @pytest.mark.parametrize(
        "url,why",
        [
            ("http://169.254.169.254/latest/meta-data/", "cloud instance metadata"),
            ("http://localhost:8002/api/v1/users", "our own API, from inside the perimeter"),
            ("http://127.0.0.1/", "loopback"),
            ("http://[::1]/", "loopback, v6"),
            ("http://10.0.0.5/hook", "private network"),
            ("http://192.168.1.10/hook", "private network"),
            ("http://172.16.0.9/hook", "private network"),
            ("http://0.0.0.0/", "unspecified"),
        ],
    )
    def test_internal_addresses_are_refused(self, url, why):
        with pytest.raises(HTTPException) as exc:
            svc.assert_safe_url(url)
        assert exc.value.status_code == 422, why

    @pytest.mark.parametrize(
        "url", ["ftp://example.com/hook", "file:///etc/passwd", "gopher://x/", "//example.com"]
    )
    def test_only_http_and_https_are_accepted(self, url):
        with pytest.raises(HTTPException):
            svc.assert_safe_url(url)

    def test_a_hostname_that_cannot_be_resolved_is_refused(self):
        """Unresolvable means unverifiable, and "allow what we could not check" is
        how a guard like this gets bypassed."""
        with pytest.raises(HTTPException) as exc:
            svc.assert_safe_url("https://this-host-does-not-exist.invalid/hook")
        assert "could not be resolved" in exc.value.detail

    def test_a_url_with_no_host_is_refused(self):
        with pytest.raises(HTTPException):
            svc.assert_safe_url("https:///hook")


class TestEventCatalogue:
    def test_every_offered_event_is_named_and_explained(self):
        for name, description in svc.EVENTS:
            assert "." in name, f"{name} should read as resource.action"
            assert len(description) > 15

    def test_subscribing_to_an_unknown_event_is_refused(self):
        """A typo would subscribe an endpoint to something that never fires — it
        reads as configured and delivers nothing."""
        with pytest.raises(HTTPException) as exc:
            svc._validate_events(["partner.approved", "partner.exploded"])
        assert "partner.exploded" in exc.value.detail

    def test_subscribing_to_nothing_is_refused(self):
        with pytest.raises(HTTPException) as exc:
            svc._validate_events([])
        assert "never be called" in exc.value.detail

    def test_events_are_deduplicated_and_ordered(self):
        assert svc._validate_events(["user.created", "user.created"]) == ["user.created"]

    def test_dispatching_an_unknown_event_is_a_programming_error(self):
        """A `ValueError`, not a 422: this is a call site passing a name it made
        up, which no user input can cause."""
        with pytest.raises(ValueError):
            svc.dispatch(None, "nope.invented", {})


class TestSecrets:
    def test_the_secret_is_prefixed_so_a_leak_is_greppable(self):
        assert svc.SECRET_PREFIX == "whsec_"

    def test_a_generated_secret_is_long_enough_to_be_worthless_to_a_guesser(self):
        secret = svc._new_secret()
        assert secret.startswith(svc.SECRET_PREFIX)
        assert len(secret) > 30

    def test_two_secrets_are_never_the_same(self):
        assert svc._new_secret() != svc._new_secret()

    def test_a_response_body_cannot_fill_the_table(self):
        assert 0 < svc.MAX_RESPONSE_CHARS <= 10_000


# --- Every offered event must actually be emitted ---------------------------
#
# Added after `partner.approved` shipped in the catalogue and could never fire:
# the domain has no APPROVED status — a partner is PENDING, ACTIVE or SUSPENDED.
# The endpoint form offered it, an integrator could have subscribed to it, and it
# would have delivered nothing forever.
#
# `_validate_events` stops a *subscriber* naming an event that does not exist.
# Nothing stopped *us* offering one nothing emits, which is the same failure from
# the other side. This is that check.


class TestEveryEventHasACallSite:
    def test_each_offered_event_is_emitted_somewhere(self):
        from pathlib import Path

        services = Path("app/services")
        if not services.exists():  # pragma: no cover - path differs under some runners
            pytest.skip("service sources not reachable from this working directory")

        sources = "\n".join(
            path.read_text()
            for path in services.glob("*.py")
            if path.name != "webhook_service.py"
        )

        missing = [name for name, _ in svc.EVENTS if f'"{name}"' not in sources]
        assert missing == [], (
            "These events are offered to subscribers but no call site emits them, "
            f"so subscribing to one delivers nothing: {missing}"
        )

    def test_the_emitted_names_are_all_in_the_catalogue(self):
        """The other direction: a call site emitting an unlisted name raises at
        runtime, inside whatever operation triggered it."""
        from pathlib import Path

        services = Path("app/services")
        if not services.exists():  # pragma: no cover
            pytest.skip("service sources not reachable from this working directory")

        import re

        emitted = set()
        for path in services.glob("*.py"):
            if path.name == "webhook_service.py":
                continue
            for match in re.finditer(r'emit\(\s*db,\s*"([a-z_.]+)"', path.read_text()):
                emitted.add(match.group(1))

        assert emitted, "no call site emits anything — the wiring has been lost"
        assert emitted <= svc.EVENT_NAMES, f"emitted but not offered: {emitted - svc.EVENT_NAMES}"
