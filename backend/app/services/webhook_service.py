"""Outbound webhooks — signing, delivery, retries and the circuit breaker.

LeapDesk parity Module 14. Three mechanics are copied exactly because each
encodes a decision worth keeping:

1. **The timestamp is inside the signed string** (`{timestamp}.{body}`), not
   merely a header beside it. That is what stops a captured payload being
   replayed later: a receiver that checks the age of the timestamp knows the
   signature covers it, so an attacker cannot keep the body and change the clock.
2. **Backoff `[30, 120, 600]` over three attempts** — "a receiver that is down is
   usually down for minutes, not milliseconds."
3. **A 4xx is not retried; a 5xx is.** A receiver that rejects the payload will
   reject it again, and retrying is just noise in their logs and ours.

## Two places this cannot follow the reference, and what happens instead

**We have no queue.** LeapDesk hands delivery to a worker. Here `deliver_now`
performs one attempt inline with a hard timeout, and a failed delivery records
`next_attempt_at` from the schedule above. `process_due_retries()` performs the
sweep — and **nothing calls it on a schedule, because there is no scheduler**, the
same honest position `activity_service.purge_older_than` takes. The Redeliver
button on the delivery log is the retry that actually works today.

**The reference does not guard the destination URL; we do.** An endpoint is a URL
supplied by a user that our server then makes a POST to, which is textbook SSRF:
`http://169.254.169.254/` reads cloud instance credentials, and
`http://localhost:8002/api/v1/...` reaches our own API from inside the network
perimeter. `assert_safe_url` refuses loopback, private, link-local and
metadata addresses at write time **and again before every send**, because DNS can
change between the two.
"""

from __future__ import annotations

import hashlib
import hmac
import ipaddress
import json
import logging
import socket
import time
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

import httpx
from fastapi import HTTPException, status
from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session, selectinload

from app.core import crypto
from app.core.crud import get_or_404
from app.core.query import ListParams, ListSpec, run_list
from app.core.security import generate_token
from app.models.user import User
from app.models.webhook import (
    STATUS_DELIVERED,
    STATUS_FAILED,
    STATUS_PENDING,
    WebhookDelivery,
    WebhookEndpoint,
)
from app.services import activity_service, api_consumer_service

logger = logging.getLogger("app.webhooks")

SIGNATURE_HEADER = "X-PMP-Signature"
EVENT_HEADER = "X-PMP-Event"
DELIVERY_HEADER = "X-PMP-Delivery"
TIMESTAMP_HEADER = "X-PMP-Timestamp"

#: Seconds before each retry. Three attempts total, per the reference.
BACKOFF_SECONDS: tuple[int, ...] = (30, 120, 600)
MAX_ATTEMPTS = len(BACKOFF_SECONDS)

#: Consecutive failures before the endpoint is disabled altogether.
FAILURE_THRESHOLD = 10

#: A receiver gets ten seconds. Longer and a slow endpoint holds a worker; the
#: reference relies on its queue's timeout for the same purpose.
TIMEOUT_SECONDS = 10.0

#: Response bodies are stored for debugging, truncated so a receiver that returns
#: a page of HTML on error cannot fill the table.
MAX_RESPONSE_CHARS = 2000

SECRET_PREFIX = "whsec_"

#: The events an endpoint may subscribe to. **Deliberately small and real**: each
#: one is emitted by an existing call site rather than reserved for a future one.
#: Subscribing to an event that never fires reads as configured and delivers
#: nothing, which is the same failure Module 10's ability catalogue avoids.
EVENTS: tuple[tuple[str, str], ...] = (
    ("partner.created", "A partner organisation was registered"),
    # ⚠️ **`partner.activated`, not `partner.approved`.** The plan and the first
    # version of this list both said "approved" — but the domain has no such
    # status: a partner is `PENDING`, `ACTIVE` or `SUSPENDED`, and activation is
    # what approval means here. The event fired on a status that could never
    # occur, which is precisely the failure `_validate_events` exists to stop,
    # and it took a probe against the real service to notice. Named after the
    # state that exists.
    ("partner.activated", "A pending partner became active — the approval step"),
    ("user.created", "A user account was created"),
    ("invitation.accepted", "An invitation was accepted"),
)
EVENT_NAMES = frozenset(name for name, _ in EVENTS)

EVENT_ENDPOINT_CREATED = "webhook_endpoint_created"
EVENT_ENDPOINT_DELETED = "webhook_endpoint_deleted"
SUBJECT = "WebhookEndpoint"


# --- The destination guard ---------------------------------------------------


def assert_safe_url(url: str) -> None:
    """Refuse a URL our server must not be made to fetch.

    **Ours, not the reference's.** Every check here maps to a real attack: an
    endpoint pointing at `169.254.169.254` turns a webhook into a read of cloud
    instance credentials; one pointing at `localhost` reaches our own API from
    inside the perimeter, where it is trusted; one pointing at `10.x` reaches
    whatever else is on the private network.

    Resolution failure is treated as unsafe. A hostname we cannot resolve is one
    we cannot check, and "allow what we could not verify" is how these guards get
    bypassed.
    """
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "The URL must start with http:// or https://.",
        )
    if not parsed.hostname:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "That URL has no host.")

    try:
        infos = socket.getaddrinfo(parsed.hostname, None)
    except OSError as exc:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"'{parsed.hostname}' could not be resolved.",
        ) from exc

    # **Every** address, not the first: a hostname resolving to one public and one
    # private address would otherwise pass the check and be delivered to the
    # private one.
    for info in infos:
        address = ipaddress.ip_address(info[4][0])
        if (
            address.is_private
            or address.is_loopback
            or address.is_link_local
            or address.is_reserved
            or address.is_multicast
            or address.is_unspecified
        ):
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "That URL resolves to a private or internal address, which cannot "
                "be used as a webhook destination.",
            )


# --- Signing -----------------------------------------------------------------


def sign(secret: str, timestamp: int, body: str) -> str:
    """`sha256=<hmac of "{timestamp}.{body}">`.

    The timestamp is part of the signed string, so a receiver checking its age is
    checking something the signature covers.
    """
    digest = hmac.new(
        secret.encode("utf-8"),
        f"{timestamp}.{body}".encode(),
        hashlib.sha256,
    ).hexdigest()
    return f"sha256={digest}"


def _new_secret() -> str:
    return f"{SECRET_PREFIX}{generate_token(32)}"


# --- Endpoints ---------------------------------------------------------------

_LIST_SPEC = ListSpec(
    sortable={
        "name": WebhookEndpoint.name,
        "created_at": WebhookEndpoint.created_at,
        "is_active": WebhookEndpoint.is_active,
        "failure_count": WebhookEndpoint.failure_count,
    },
    default_sort="created_at",
    tiebreak=WebhookEndpoint.id,
    searchable=(WebhookEndpoint.name, WebhookEndpoint.url),
    default_per_page=15,
)


def get_endpoint(db: Session, endpoint_id: str) -> WebhookEndpoint:
    return get_or_404(db, WebhookEndpoint, endpoint_id, "That webhook does not exist.")


def list_endpoints(
    db: Session,
    *,
    consumer_id: str | None = None,
    search: str | None = None,
    is_active: bool | None = None,
    sort_by: str | None = None,
    sort_order: str = "desc",
    page: int = 1,
    per_page: int = 15,
) -> tuple[list[WebhookEndpoint], int]:
    stmt: Select = select(WebhookEndpoint)
    if consumer_id:
        stmt = stmt.where(WebhookEndpoint.api_consumer_id == consumer_id)
    if is_active is not None:
        stmt = stmt.where(WebhookEndpoint.is_active.is_(is_active))
    return run_list(
        db,
        stmt,
        _LIST_SPEC,
        ListParams(
            page=page,
            per_page=per_page,
            search=search,
            sort_by=sort_by,
            sort_order="asc" if sort_order == "asc" else "desc",
        ),
    )


def _validate_events(events: list[str]) -> list[str]:
    cleaned = [e.strip() for e in events or [] if e and e.strip()]
    unknown = [e for e in cleaned if e not in EVENT_NAMES]
    if unknown:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Unknown event(s): {', '.join(unknown)}.",
        )
    if not cleaned:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "An endpoint subscribed to no events would never be called.",
        )
    return sorted(set(cleaned))


def create_endpoint(db: Session, data: dict, actor: User) -> tuple[WebhookEndpoint, str]:
    """Register an endpoint. Returns `(row, plaintext_secret)`.

    The secret is returned **once**, like a token — the receiver needs it to
    verify signatures, and after this it exists only as ciphertext we decrypt for
    signing, never for display.
    """
    consumer = api_consumer_service.get_consumer(db, data["api_consumer_id"])
    url = (data.get("url") or "").strip()
    assert_safe_url(url)

    secret = _new_secret()
    endpoint = WebhookEndpoint(
        api_consumer_id=consumer.id,
        name=(data.get("name") or "").strip(),
        url=url,
        secret=crypto.encrypt_value(secret),
        events=_validate_events(data.get("events", [])),
        is_active=bool(data.get("is_active", True)),
        created_by=actor.id,
    )
    db.add(endpoint)
    db.commit()
    db.refresh(endpoint)

    activity_service.record(
        db,
        description=f"{actor.full_name} added a webhook for '{consumer.slug}' to {url}",
        event=EVENT_ENDPOINT_CREATED,
        subject_type=SUBJECT,
        subject_id=endpoint.id,
        actor=actor,
        # The URL and the events; never the secret.
        properties={"url": url, "events": endpoint.events, "consumer": consumer.slug},
    )
    return endpoint, secret


def update_endpoint(db: Session, endpoint_id: str, data: dict, actor: User) -> WebhookEndpoint:
    endpoint = get_endpoint(db, endpoint_id)

    if "url" in data and data["url"]:
        url = data["url"].strip()
        assert_safe_url(url)
        endpoint.url = url
    if "name" in data and data["name"]:
        endpoint.name = data["name"].strip()
    if "events" in data and data["events"] is not None:
        endpoint.events = _validate_events(data["events"])
    if "is_active" in data and data["is_active"] is not None:
        endpoint.is_active = bool(data["is_active"])
        if endpoint.is_active:
            # Switching it back on clears the breaker. Otherwise an endpoint that
            # was auto-disabled, then fixed and re-enabled, would still carry the
            # count that disabled it and trip again almost immediately.
            endpoint.failure_count = 0
            endpoint.disabled_at = None

    db.commit()
    db.refresh(endpoint)
    return endpoint


def rotate_secret(db: Session, endpoint_id: str, actor: User) -> tuple[WebhookEndpoint, str]:
    """Issue a new signing secret. Returns the plaintext once."""
    endpoint = get_endpoint(db, endpoint_id)
    secret = _new_secret()
    endpoint.secret = crypto.encrypt_value(secret)
    db.commit()
    db.refresh(endpoint)

    activity_service.record(
        db,
        description=f"{actor.full_name} rotated the signing secret for '{endpoint.name}'",
        event="webhook_secret_rotated",
        subject_type=SUBJECT,
        subject_id=endpoint.id,
        actor=actor,
    )
    return endpoint, secret


def delete_endpoint(db: Session, endpoint_id: str, actor: User) -> None:
    endpoint = get_endpoint(db, endpoint_id)
    name, url = endpoint.name, endpoint.url
    db.delete(endpoint)
    db.commit()

    activity_service.record(
        db,
        description=f"{actor.full_name} removed the webhook '{name}'",
        event=EVENT_ENDPOINT_DELETED,
        subject_type=SUBJECT,
        subject_id=endpoint_id,
        actor=actor,
        properties={"url": url},
    )


# --- Delivery ----------------------------------------------------------------


def _attempt(endpoint: WebhookEndpoint, delivery: WebhookDelivery) -> tuple[int | None, str, int]:
    """One HTTP POST. Returns `(status_code, body, duration_ms)`.

    `status_code` is None when the request never got a response at all — a
    timeout, a refused connection, DNS failure. That is a different thing from a
    5xx and both are retried, but only one of them means the receiver is there.
    """
    body = json.dumps(
        {"event": delivery.event, "delivery_id": delivery.id, "data": delivery.payload},
        default=str,
        separators=(",", ":"),
    )
    timestamp = int(time.time())
    secret = crypto.decrypt_value(endpoint.secret) or ""

    headers = {
        "Content-Type": "application/json",
        SIGNATURE_HEADER: sign(secret, timestamp, body),
        TIMESTAMP_HEADER: str(timestamp),
        EVENT_HEADER: delivery.event,
        DELIVERY_HEADER: delivery.id,
        "User-Agent": "PartnerMarketplace-Webhooks/1.0",
    }

    started = time.monotonic()
    try:
        # `follow_redirects=False` deliberately: a redirect would take the request
        # to a URL that never passed `assert_safe_url`, which is the standard way
        # around an SSRF allowlist.
        response = httpx.post(
            endpoint.url,
            content=body,
            headers=headers,
            timeout=TIMEOUT_SECONDS,
            follow_redirects=False,
        )
        duration = int((time.monotonic() - started) * 1000)
        return response.status_code, response.text[:MAX_RESPONSE_CHARS], duration
    except Exception as exc:  # noqa: BLE001 - any transport failure is one outcome
        duration = int((time.monotonic() - started) * 1000)
        logger.warning("webhook delivery failed to %s: %s", endpoint.url, type(exc).__name__)
        return None, f"{type(exc).__name__}: {exc}"[:MAX_RESPONSE_CHARS], duration


def deliver_now(db: Session, delivery: WebhookDelivery) -> WebhookDelivery:
    """Attempt one delivery and record the outcome.

    Inline rather than queued — see the module docstring. The URL is re-checked
    here as well as at write time, because DNS can change between the two and the
    check that matters is the one taken before the request.
    """
    endpoint = delivery.endpoint
    delivery.attempts += 1

    try:
        assert_safe_url(endpoint.url)
    except HTTPException as exc:
        delivery.status = STATUS_FAILED
        delivery.failed_at = datetime.now(timezone.utc)
        delivery.next_attempt_at = None
        delivery.response_body = f"refused before sending: {exc.detail}"
        db.commit()
        return delivery

    code, body, duration = _attempt(endpoint, delivery)
    delivery.response_status = code
    delivery.response_body = body
    delivery.duration_ms = duration
    endpoint.last_delivery_at = datetime.now(timezone.utc)

    if code is not None and 200 <= code < 300:
        delivery.status = STATUS_DELIVERED
        delivery.delivered_at = datetime.now(timezone.utc)
        delivery.next_attempt_at = None
        # Consecutive failures — a success means it is working now, whatever
        # happened last week.
        endpoint.failure_count = 0
        db.commit()
        return delivery

    # A 4xx is the receiver saying "not this payload", and it will say it again.
    permanent = code is not None and 400 <= code < 500
    exhausted = delivery.attempts >= MAX_ATTEMPTS

    if permanent or exhausted:
        delivery.status = STATUS_FAILED
        delivery.failed_at = datetime.now(timezone.utc)
        delivery.next_attempt_at = None
        endpoint.failure_count += 1
        if endpoint.failure_count >= FAILURE_THRESHOLD and endpoint.disabled_at is None:
            # The circuit breaker. Without it a dead endpoint is retried on every
            # event forever, and its delivery log fills with one failure repeated
            # until nobody reads it.
            endpoint.is_active = False
            endpoint.disabled_at = datetime.now(timezone.utc)
            logger.warning(
                "webhook endpoint auto-disabled after %s consecutive failures: %s",
                endpoint.failure_count,
                endpoint.url,
            )
    else:
        delivery.status = STATUS_PENDING
        delivery.next_attempt_at = datetime.now(timezone.utc) + timedelta(
            seconds=BACKOFF_SECONDS[min(delivery.attempts - 1, len(BACKOFF_SECONDS) - 1)]
        )

    db.commit()
    return delivery


def dispatch(db: Session, event: str, payload: dict) -> list[WebhookDelivery]:
    """Queue this event for every endpoint subscribed to it, and try each once.

    The entry point a call site uses: `webhook_service.dispatch(db,
    "partner.activated", {...})`. Inactive endpoints are skipped rather than
    queued — an endpoint switched off should not accumulate a backlog that floods
    the receiver the moment it is switched on.
    """
    if event not in EVENT_NAMES:
        raise ValueError(f"Unknown webhook event {event!r}")

    endpoints = list(
        db.scalars(
            select(WebhookEndpoint)
            .options(selectinload(WebhookEndpoint.deliveries))
            .where(WebhookEndpoint.is_active.is_(True))
            .where(WebhookEndpoint.events.contains([event]))
        )
    )

    deliveries: list[WebhookDelivery] = []
    for endpoint in endpoints:
        delivery = WebhookDelivery(
            webhook_endpoint_id=endpoint.id, event=event, payload=payload
        )
        db.add(delivery)
        db.commit()
        db.refresh(delivery)
        deliveries.append(deliver_now(db, delivery))
    return deliveries


def emit(db: Session, event: str, payload: dict) -> None:
    """Fire an event from a call site. **Never raises, whatever happens.**

    The rule `activity_service.record` already follows, and it matters more here
    because delivery makes a *network request*: a receiver that is slow, down,
    or returning nonsense must not be able to fail the operation that triggered
    the event. Creating a user is not allowed to break because somebody else's
    server did.

    ⚠️ **It is still synchronous**, so a registered endpoint adds up to
    `TIMEOUT_SECONDS` to the request that emitted the event. That is the honest
    cost of having no queue, and it is why `emit` is called *after* the work is
    committed rather than inside the transaction — a slow webhook delays the
    response, it does not hold a database lock or risk rolling anything back.
    """
    try:
        dispatch(db, event, payload)
    except Exception as exc:  # noqa: BLE001 - an event must never break its cause
        logger.error(
            "webhook emit failed for %s: %s: %s", event, type(exc).__name__, exc
        )
        try:
            db.rollback()
        except Exception:  # noqa: BLE001
            pass


def send_test(db: Session, endpoint_id: str, actor: User) -> WebhookDelivery:
    """Send a `webhook.test` payload to one endpoint, now.

    Its own path rather than `dispatch`, because a test must reach an endpoint
    whatever it is subscribed to — the question being asked is "can we reach you
    and will you accept our signature", not "do you want this event".
    """
    endpoint = get_endpoint(db, endpoint_id)
    delivery = WebhookDelivery(
        webhook_endpoint_id=endpoint.id,
        event="webhook.test",
        payload={"message": "This is a test delivery.", "sent_by": actor.email},
    )
    db.add(delivery)
    db.commit()
    db.refresh(delivery)
    return deliver_now(db, delivery)


def redeliver(db: Session, delivery_id: str) -> WebhookDelivery:
    """Try a past delivery again, by hand.

    **This is the retry that actually works today**, because nothing sweeps for
    due retries automatically. Attempts are reset so a redelivery gets the full
    schedule rather than inheriting an exhausted one.
    """
    delivery = get_or_404(db, WebhookDelivery, delivery_id, "That delivery does not exist.")
    delivery.attempts = 0
    delivery.status = STATUS_PENDING
    delivery.failed_at = None
    delivery.next_attempt_at = None
    db.commit()
    return deliver_now(db, delivery)


def due_retries(db: Session, limit: int = 50) -> list[WebhookDelivery]:
    now = datetime.now(timezone.utc)
    return list(
        db.scalars(
            select(WebhookDelivery)
            .options(selectinload(WebhookDelivery.endpoint))
            .where(WebhookDelivery.status == STATUS_PENDING)
            .where(WebhookDelivery.next_attempt_at.is_not(None))
            .where(WebhookDelivery.next_attempt_at <= now)
            .order_by(WebhookDelivery.next_attempt_at)
            .limit(limit)
        )
    )


def process_due_retries(db: Session, limit: int = 50) -> int:
    """Attempt every delivery whose backoff has elapsed. Returns how many ran.

    **Nothing calls this on a schedule, because there is no scheduler** — the
    same position `activity_service.purge_older_than` takes, and the same reason
    Module 16 is blocked. It exists so that the retry policy is a function
    someone can run rather than a paragraph someone wrote, and so that adding a
    worker later is a wiring job rather than a design one.
    """
    ran = 0
    for delivery in due_retries(db, limit):
        deliver_now(db, delivery)
        ran += 1
    return ran


# --- Reads -------------------------------------------------------------------


def list_deliveries(
    db: Session, endpoint_id: str, *, limit: int = 50
) -> list[WebhookDelivery]:
    get_endpoint(db, endpoint_id)
    return list(
        db.scalars(
            select(WebhookDelivery)
            .where(WebhookDelivery.webhook_endpoint_id == endpoint_id)
            .order_by(WebhookDelivery.created_at.desc())
            .limit(limit)
        )
    )


def delivery_summary(db: Session, endpoint_id: str) -> dict:
    def count(*conditions) -> int:
        return db.scalar(
            select(func.count())
            .select_from(WebhookDelivery)
            .where(WebhookDelivery.webhook_endpoint_id == endpoint_id, *conditions)
        ) or 0

    return {
        "total": count(),
        "delivered": count(WebhookDelivery.status == STATUS_DELIVERED),
        "failed": count(WebhookDelivery.status == STATUS_FAILED),
        "pending": count(WebhookDelivery.status == STATUS_PENDING),
    }
