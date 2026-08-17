"""The rate limiter's store seam, and the three behaviours a replacement must keep.

`BACKEND_CORE_PUNCHLIST.md` T9. **PM-44 is not closed by this file** and neither is
it closed by the interface it tests: counters still live in one process, so N
workers still multiply every limit by N. What changed is that a shared store is now
a new class and one argument rather than surgery on the middleware.

The reason this file exists at all is that an extracted interface with no
conformance test is a promise rather than a seam. Two things are proven here:

1. **The default store satisfies the protocol**, structurally — so `SlidingWindowCounter`
   cannot drift away from it silently.
2. **The middleware actually consults the store it was given.** That is the whole
   claim of the refactor. Without this, the `store=` argument could be accepted
   and ignored, the tests would pass, and the day someone wired Redis in they
   would find the limiter still counting in memory.

The behavioural assertions double as the specification for a Redis implementation:
whatever backs it must be a sliding log, must not record a rejected request, and
must report `remaining` as the allowance left after the current request.
"""

from __future__ import annotations

import pytest
from starlette.applications import Starlette
from starlette.responses import PlainTextResponse
from starlette.routing import Route
from starlette.testclient import TestClient

from app.core.config import settings
from app.core.rate_limit import (
    RateLimitMiddleware,
    RateLimitStore,
    SlidingWindowCounter,
)


class TestTheDefaultStoreConformsToTheProtocol:
    def test_the_in_process_counter_is_a_rate_limit_store(self):
        """Structural, via `runtime_checkable` — renaming `hit` or `reset` on the
        counter fails here rather than at the first request in production."""
        assert isinstance(SlidingWindowCounter(), RateLimitStore)

    def test_a_rejected_request_records_nothing(self):
        """Otherwise a client retrying in a loop could never recover: each refused
        attempt would push the window forward and the throttle would never lift."""
        store = SlidingWindowCounter()
        for _ in range(3):
            assert store.hit("k", 3, 60)[0] is True

        first = store.hit("k", 3, 60)
        second = store.hit("k", 3, 60)
        assert first[0] is False and second[0] is False
        # Identical retry_after both times — the window did not move.
        assert first[2] == second[2]

    def test_remaining_counts_down_and_is_zero_on_refusal(self):
        store = SlidingWindowCounter()
        assert store.hit("k", 3, 60)[1] == 2
        assert store.hit("k", 3, 60)[1] == 1
        assert store.hit("k", 3, 60)[1] == 0
        assert store.hit("k", 3, 60)[1] == 0

    def test_keys_do_not_share_an_allowance(self):
        """Buckets are keyed `tier:ip`, so this is what keeps one client's login
        attempts from spending another client's budget."""
        store = SlidingWindowCounter()
        for _ in range(3):
            store.hit("a", 3, 60)
        assert store.hit("a", 3, 60)[0] is False
        assert store.hit("b", 3, 60)[0] is True

    def test_reset_forgets_everything(self):
        store = SlidingWindowCounter()
        for _ in range(3):
            store.hit("k", 3, 60)
        store.reset()
        assert store.hit("k", 3, 60)[0] is True

    def test_a_retry_after_is_always_at_least_one_second(self):
        """`Retry-After: 0` invites an immediate retry, which is the opposite of
        what the header is for."""
        store = SlidingWindowCounter()
        store.hit("k", 1, 60)
        _allowed, _remaining, retry_after = store.hit("k", 1, 60)
        assert retry_after >= 1


class _RecordingStore:
    """A store that refuses everything and remembers being asked.

    Not a `SlidingWindowCounter` subclass: the point is to prove the middleware
    depends on the *protocol*, so this implements it from nothing.
    """

    def __init__(self) -> None:
        self.calls: list[tuple[str, int, int]] = []

    def hit(self, key: str, limit: int, window_seconds: int) -> tuple[bool, int, int]:
        self.calls.append((key, limit, window_seconds))
        return False, 0, 7

    def reset(self) -> None:
        self.calls.clear()


class TestTheMiddlewareUsesTheStoreItWasGiven:
    """**The claim the refactor actually makes.**

    A `store=` argument that were accepted and ignored would leave every test
    green and the limiter still counting in this process — discovered only when
    someone deployed Redis and watched the limits keep multiplying by worker
    count. So this asserts the injected store is consulted, and that its answer
    is what reaches the response.
    """

    @pytest.fixture
    def app_with(self):
        def _build(store: RateLimitStore) -> TestClient:
            app = Starlette(
                routes=[
                    Route(
                        f"{settings.API_PREFIX}/anything",
                        lambda request: PlainTextResponse("ok"),
                    )
                ]
            )
            app.add_middleware(RateLimitMiddleware, store=store)
            return TestClient(app)

        return _build

    def test_the_injected_store_decides_the_outcome(self, app_with, monkeypatch):
        monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
        store = _RecordingStore()
        response = app_with(store).get(f"{settings.API_PREFIX}/anything")

        assert response.status_code == 429, (
            "the middleware ignored the store it was given — the `store=` argument "
            "is decorative, and a shared store would not work"
        )
        assert store.calls, "the store was never consulted"
        assert response.headers["Retry-After"] == "7", (
            "the store's retry_after did not reach the response"
        )

    def test_the_key_carries_the_tier_so_buckets_stay_separate(
        self, app_with, monkeypatch
    ):
        monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
        store = _RecordingStore()
        app_with(store).get(f"{settings.API_PREFIX}/anything")

        key, limit, window = store.calls[0]
        assert key.startswith("default:"), f"unexpected bucket key {key!r}"
        assert limit == settings.RATE_LIMIT_DEFAULT_MAX_REQUESTS
        assert window == settings.RATE_LIMIT_DEFAULT_WINDOW_SECONDS

    def test_disabling_the_limiter_skips_the_store_entirely(
        self, app_with, monkeypatch
    ):
        """`RATE_LIMIT_ENABLED=false` must short-circuit before the store, or a
        remote store would be a round trip per request in a deployment that asked
        for no limiting."""
        monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", False)
        store = _RecordingStore()
        response = app_with(store).get(f"{settings.API_PREFIX}/anything")

        assert response.status_code == 200
        assert store.calls == []

    def test_a_preflight_is_not_charged(self, app_with, monkeypatch):
        """A browser's OPTIONS carries no credentials and is not the caller's
        doing; charging it would make one real request cost two."""
        monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
        store = _RecordingStore()
        app_with(store).options(f"{settings.API_PREFIX}/anything")
        assert store.calls == []

    def test_health_probes_are_never_charged(self, app_with, monkeypatch):
        """An orchestrator polling readiness must not be able to exhaust its own
        quota and pull the service out of a load balancer."""
        monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
        store = _RecordingStore()
        app = Starlette(
            routes=[Route("/health", lambda request: PlainTextResponse("ok"))]
        )
        app.add_middleware(RateLimitMiddleware, store=store)
        response = TestClient(app).get("/health")

        assert response.status_code == 200
        assert store.calls == []

    def test_omitting_the_store_falls_back_to_the_in_process_counter(
        self, monkeypatch
    ):
        """Existing registrations pass no store, so the default must still work —
        this is what makes the refactor non-breaking."""
        monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
        from app.core import rate_limit

        rate_limit.counter.reset()
        app = Starlette(
            routes=[
                Route(
                    f"{settings.API_PREFIX}/anything",
                    lambda request: PlainTextResponse("ok"),
                )
            ]
        )
        app.add_middleware(RateLimitMiddleware)
        response = TestClient(app).get(f"{settings.API_PREFIX}/anything")

        assert response.status_code == 200
        assert "X-RateLimit-Remaining" in response.headers
        rate_limit.counter.reset()
