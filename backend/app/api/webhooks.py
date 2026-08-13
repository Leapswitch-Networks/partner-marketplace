"""Webhook endpoints and their delivery log (LeapDesk parity Module 14).

Gated on the Platform API's permissions rather than new ones: a webhook belongs
to an `api_consumer`, so managing one is managing that consumer's integration.
Adding a sixth permission for it would split a single job across two checkboxes.
"""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_permission
from app.core.permissions import (
    API_CONSUMER_UPDATE,
    API_CONSUMER_VIEW,
    API_TOKEN_MANAGE,
)
from app.core.query import page_meta
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.schemas.common import Page
from app.schemas.webhook import (
    DeliveryResponse,
    DeliverySummary,
    EventOption,
    WebhookCreated,
    WebhookCreateRequest,
    WebhookResponse,
    WebhookUpdateRequest,
)
from app.services import webhook_service

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.get("", response_model=Page[WebhookResponse])
def list_endpoints(
    consumer_id: str | None = Query(default=None),
    search: str | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    sort_by: str | None = Query(default=None),
    sort_order: str = Query(default="desc"),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=15, ge=1, le=100),
    db: Session = Depends(get_db),
    _actor: User = Depends(require_permission(API_CONSUMER_VIEW)),
) -> Page[WebhookResponse]:
    rows, total = webhook_service.list_endpoints(
        db,
        consumer_id=consumer_id,
        search=search,
        is_active=is_active,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        per_page=per_page,
    )
    return Page[WebhookResponse](
        items=[WebhookResponse.model_validate(row) for row in rows],
        **page_meta(page, per_page, total),
    )


@router.get("/events", response_model=list[EventOption])
def list_events(
    _actor: User = Depends(require_permission(API_CONSUMER_VIEW)),
) -> list[EventOption]:
    """What an endpoint may subscribe to.

    Every one is emitted by a real call site. Offering an event nothing fires
    would produce an endpoint that reads as configured and delivers nothing.
    """
    return [EventOption(name=name, description=description) for name, description in webhook_service.EVENTS]


@router.post("", response_model=WebhookCreated, status_code=status.HTTP_201_CREATED)
def create_endpoint(
    data: WebhookCreateRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(API_TOKEN_MANAGE)),
) -> WebhookCreated:
    """Register an endpoint. **Returns the signing secret once.**

    Gated on `api-token-manage` rather than `api-consumer-update`: this hands a
    third party a shared secret and points our server at a URL they chose, which
    is credential-issuing work rather than record-editing.

    The URL is checked against private, loopback and metadata addresses before it
    is stored — see `webhook_service.assert_safe_url`.
    """
    endpoint, secret = webhook_service.create_endpoint(db, data.model_dump(), actor)
    return WebhookCreated(
        secret=secret,
        warning=(
            "Copy this signing secret now — it cannot be shown again. The receiver "
            "needs it to verify that a delivery really came from us."
        ),
        endpoint=WebhookResponse.model_validate(endpoint),
    )


@router.get("/{endpoint_id}", response_model=WebhookResponse)
def get_endpoint(
    endpoint_id: str,
    db: Session = Depends(get_db),
    _actor: User = Depends(require_permission(API_CONSUMER_VIEW)),
) -> WebhookResponse:
    return WebhookResponse.model_validate(webhook_service.get_endpoint(db, endpoint_id))


@router.patch("/{endpoint_id}", response_model=WebhookResponse)
def update_endpoint(
    endpoint_id: str,
    data: WebhookUpdateRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(API_CONSUMER_UPDATE)),
) -> WebhookResponse:
    """Edit an endpoint. Re-enabling it also clears the failure counter."""
    return WebhookResponse.model_validate(
        webhook_service.update_endpoint(
            db, endpoint_id, data.model_dump(exclude_unset=True), actor
        )
    )


@router.post("/{endpoint_id}/rotate-secret", response_model=WebhookCreated)
def rotate_secret(
    endpoint_id: str,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(API_TOKEN_MANAGE)),
) -> WebhookCreated:
    """Issue a new signing secret. **Deliveries signed with the old one stop
    verifying immediately**, so the receiver has to be updated in the same
    change."""
    endpoint, secret = webhook_service.rotate_secret(db, endpoint_id, actor)
    return WebhookCreated(
        secret=secret,
        warning=(
            "The previous secret stopped working the moment this was issued. Update "
            "the receiver before the next event fires."
        ),
        endpoint=WebhookResponse.model_validate(endpoint),
    )


@router.delete("/{endpoint_id}", response_model=MessageResponse)
def delete_endpoint(
    endpoint_id: str,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(API_CONSUMER_UPDATE)),
) -> MessageResponse:
    webhook_service.delete_endpoint(db, endpoint_id, actor)
    return MessageResponse(message="Webhook removed, along with its delivery history")


@router.post("/{endpoint_id}/test", response_model=DeliveryResponse)
def send_test(
    endpoint_id: str,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(API_CONSUMER_UPDATE)),
) -> DeliveryResponse:
    """Send a test delivery now, whatever the endpoint is subscribed to.

    The question being asked is "can we reach you and will you accept our
    signature", not "do you want this event".
    """
    return DeliveryResponse.model_validate(webhook_service.send_test(db, endpoint_id, actor))


@router.get("/{endpoint_id}/deliveries", response_model=list[DeliveryResponse])
def list_deliveries(
    endpoint_id: str,
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    _actor: User = Depends(require_permission(API_CONSUMER_VIEW)),
) -> list[DeliveryResponse]:
    """The delivery log. **With the redeliver button, this is the module** —
    without it, a webhook that failed silently is unrecoverable."""
    return [
        DeliveryResponse.model_validate(row)
        for row in webhook_service.list_deliveries(db, endpoint_id, limit=limit)
    ]


@router.get("/{endpoint_id}/summary", response_model=DeliverySummary)
def delivery_summary(
    endpoint_id: str,
    db: Session = Depends(get_db),
    _actor: User = Depends(require_permission(API_CONSUMER_VIEW)),
) -> DeliverySummary:
    webhook_service.get_endpoint(db, endpoint_id)
    return DeliverySummary(**webhook_service.delivery_summary(db, endpoint_id))


@router.post("/deliveries/{delivery_id}/redeliver", response_model=DeliveryResponse)
def redeliver(
    delivery_id: str,
    db: Session = Depends(get_db),
    _actor: User = Depends(require_permission(API_CONSUMER_UPDATE)),
) -> DeliveryResponse:
    """Try a past delivery again.

    **The retry that actually works today.** The backoff schedule exists and
    records when each attempt is due, but nothing sweeps for due retries because
    there is no scheduler — see `webhook_service.process_due_retries`.
    """
    return DeliveryResponse.model_validate(webhook_service.redeliver(db, delivery_id))
