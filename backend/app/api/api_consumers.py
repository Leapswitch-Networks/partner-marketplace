"""Platform API — the governance surface for machine identities (Module 10).

**Not to be confused with `api_credentials.py`, and they are separate on purpose.**
That module holds *other people's* secrets, encrypted so we can send them; this
one holds *ours*, hashed so nobody can read them back. They sit next to each other
in the sidebar and both contain the word "API" — housing them together would blur
an access-control boundary for the sake of a superficial grouping.

Every route is staff-authenticated with a `User`. **Nothing here accepts a machine
token**: the tokens this screen mints have no endpoint to call yet, because Part
II — the reference's registry-driven read engine — is deliberately not ported.
The gate that will honour them is written and tested (`api_consumer_service.
authenticate`), so the first machine-facing endpoint inherits it rather than
inventing one.
"""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_permission
from app.core.permissions import (
    API_CONSUMER_CREATE,
    API_CONSUMER_DELETE,
    API_CONSUMER_UPDATE,
    API_CONSUMER_VIEW,
    API_TOKEN_MANAGE,
)
from app.core.query import page_count
from app.models.user import User
from app.schemas.api_consumer import (
    AbilityOption,
    ConsumerResponse,
    ConsumerUpdateRequest,
    ConsumerUsage,
    ConsumerWriteRequest,
    IssueTokenRequest,
    RequestLogEntry,
    SetActiveRequest,
    TokenIssued,
    TokenSummary,
)
from app.schemas.auth import MessageResponse
from app.schemas.common import Page
from app.services import api_consumer_service

router = APIRouter(prefix="/api-consumers", tags=["platform-api"])


def _to_response(consumer) -> ConsumerResponse:
    response = ConsumerResponse.model_validate(consumer)
    response.has_live_token = any(t.revoked_at is None for t in consumer.tokens)
    return response


@router.get("", response_model=Page[ConsumerResponse])
def list_consumers(
    search: str | None = Query(default=None),
    active: bool | None = Query(default=None),
    has_tokens: bool | None = Query(
        default=None,
        description="True: holds at least one live token. False: registered but cannot call.",
    ),
    sort_by: str | None = Query(default=None),
    sort_order: str = Query(default="desc"),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=15, ge=1, le=100),
    db: Session = Depends(get_db),
    _actor: User = Depends(require_permission(API_CONSUMER_VIEW)),
) -> Page[ConsumerResponse]:
    rows, total = api_consumer_service.list_consumers(
        db,
        search=search,
        active=active,
        has_tokens=has_tokens,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        per_page=per_page,
    )
    return Page[ConsumerResponse](
        items=[_to_response(row) for row in rows],
        total=total,
        page=page,
        per_page=per_page,
        pages=page_count(total, per_page),
    )


@router.get("/abilities", response_model=list[AbilityOption])
def list_abilities(
    _actor: User = Depends(require_permission(API_CONSUMER_VIEW)),
) -> list[AbilityOption]:
    """What a token can be granted.

    Read from the catalogue rather than typed into the UI, because the same
    catalogue is what write-time validation checks against — a list the screen
    kept separately would eventually offer an ability the API rejects.
    """
    return [AbilityOption(**vars(a)) for a in api_consumer_service.list_abilities()]


@router.post("", response_model=ConsumerResponse, status_code=status.HTTP_201_CREATED)
def create_consumer(
    data: ConsumerWriteRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(API_CONSUMER_CREATE)),
) -> ConsumerResponse:
    """Register a system. The slug names the **system**, never a person."""
    return _to_response(api_consumer_service.create_consumer(db, data.model_dump(), actor))


@router.get("/{consumer_id}", response_model=ConsumerResponse)
def get_consumer(
    consumer_id: str,
    db: Session = Depends(get_db),
    _actor: User = Depends(require_permission(API_CONSUMER_VIEW)),
) -> ConsumerResponse:
    return _to_response(api_consumer_service.get_consumer(db, consumer_id))


@router.patch("/{consumer_id}", response_model=ConsumerResponse)
def update_consumer(
    consumer_id: str,
    data: ConsumerUpdateRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(API_CONSUMER_UPDATE)),
) -> ConsumerResponse:
    return _to_response(
        api_consumer_service.update_consumer(
            db, consumer_id, data.model_dump(exclude_unset=True), actor
        )
    )


@router.post("/{consumer_id}/toggle", response_model=ConsumerResponse)
def set_active(
    consumer_id: str,
    data: SetActiveRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(API_CONSUMER_UPDATE)),
) -> ConsumerResponse:
    """The kill switch — switch an integration off without hunting its credentials.

    Its own route because it is what someone reaches for at 2am, and it takes
    effect on the very next call: `active` is checked at the gate ahead of
    anything about the token, so a perfectly valid credential stops working.
    """
    return _to_response(api_consumer_service.set_active(db, consumer_id, data.active, actor))


@router.delete("/{consumer_id}", response_model=MessageResponse)
def delete_consumer(
    consumer_id: str,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(API_CONSUMER_DELETE)),
) -> MessageResponse:
    """Remove a system **and every token it holds** — the tokens cascade.

    Its request logs do not: "which credential made these calls" is the question
    the log exists to answer, and deleting the consumer is often exactly when
    someone needs it.
    """
    api_consumer_service.delete_consumer(db, consumer_id, actor)
    return MessageResponse(message="System removed, along with its tokens")


@router.post(
    "/{consumer_id}/tokens", response_model=TokenIssued, status_code=status.HTTP_201_CREATED
)
def issue_token(
    consumer_id: str,
    data: IssueTokenRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(API_TOKEN_MANAGE)),
) -> TokenIssued:
    """Mint a token. **This response is the only place the plaintext ever exists.**

    Gated on `api-token-manage`, which is deliberately not `api-consumer-update`:
    editing a description and minting standing credentials are not the same act
    and must not ride on one checkbox. Rate-limited by `core/rate_limit.py`'s
    shape matcher, because a runaway script should not mint hundreds before
    anyone notices.

    ⚠️ This body must be excluded from any request/response logging that is ever
    added, and the client must render it, offer copy, and discard it on dismiss —
    never Redux, never `localStorage`.
    """
    token, plaintext = api_consumer_service.issue_token(
        db,
        consumer_id,
        name=data.name,
        abilities=data.abilities,
        expires_in_days=data.expires_in_days,
        actor=actor,
    )
    return TokenIssued(
        token=plaintext,
        warning=(
            "Copy this now — it cannot be shown again. Send it through a password "
            "manager's share link, never Slack or email, and never commit it to a "
            "repository."
        ),
        detail=TokenSummary.model_validate(token),
    )


@router.delete("/{consumer_id}/tokens/{token_id}", response_model=MessageResponse)
def revoke_token(
    consumer_id: str,
    token_id: str,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(API_TOKEN_MANAGE)),
) -> MessageResponse:
    """Revoke a token. It stops working immediately and the row is kept.

    Kept rather than deleted so its request-log rows still point at something —
    "which credential made these calls, and when did we stop it" is the question
    the log exists to answer.
    """
    api_consumer_service.revoke_token(db, consumer_id, token_id, actor)
    return MessageResponse(message="Token revoked")


@router.get("/{consumer_id}/usage", response_model=ConsumerUsage)
def usage(
    consumer_id: str,
    db: Session = Depends(get_db),
    _actor: User = Depends(require_permission(API_CONSUMER_VIEW)),
) -> ConsumerUsage:
    api_consumer_service.get_consumer(db, consumer_id)
    return ConsumerUsage(**api_consumer_service.usage_summary(db, consumer_id))


@router.get("/{consumer_id}/requests", response_model=list[RequestLogEntry])
def recent_requests(
    consumer_id: str,
    limit: int = Query(default=25, ge=1, le=100),
    db: Session = Depends(get_db),
    _actor: User = Depends(require_permission(API_CONSUMER_VIEW)),
) -> list[RequestLogEntry]:
    """The last calls this system made, **including the rejected ones** — a burst
    of refusals is how a leaked or probed token shows up."""
    api_consumer_service.get_consumer(db, consumer_id)
    return [
        RequestLogEntry.model_validate(row)
        for row in api_consumer_service.recent_requests(db, consumer_id, limit)
    ]
