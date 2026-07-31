"""Invitation endpoints.

`GET /preview` is the only UNAUTHENTICATED route here — the invitee has a token
but no account yet. It returns the bare minimum needed to render the acceptance
page and nothing about the inviter or the wider system.
"""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_permission
from app.core.permissions import (
    INVITATION_CANCEL,
    INVITATION_CREATE,
    INVITATION_RESEND,
    INVITATION_VIEW,
)
from app.models.user import User
from app.models.user_invitation import UserInvitation
from app.schemas.auth import MessageResponse
from app.schemas.rbac import (
    BulkCreateInvitationRequest,
    CreateInvitationRequest,
    InvitationPreviewResponse,
    InvitationResponse,
)
from app.services import invitation_service

router = APIRouter(prefix="/invitations", tags=["invitations"])


def _to_response(invitation: UserInvitation, accept_url: str | None = None) -> dict:
    payload = {
        "id": invitation.id,
        "email": invitation.email,
        "status": invitation.status,
        "account_type": invitation.account_type,
        "expires_at": invitation.expires_at,
        "accepted_at": invitation.accepted_at,
        "resent_count": invitation.resent_count,
        "last_sent_at": invitation.last_sent_at,
        "note": invitation.note,
        "created_at": invitation.created_at,
        "is_expired": invitation.is_expired,
        "role": invitation.role,
        "invited_by_name": invitation.inviter.full_name if invitation.inviter else None,
    }
    if accept_url is not None:
        payload["accept_url"] = accept_url
    return payload


class InvitationCreatedResponse(InvitationResponse):
    """Includes the accept URL.

    Returned because no mail transport is configured yet — the administrator
    copies the link and sends it. Better a visible manual step than an email
    that silently never arrives.
    """

    accept_url: str


@router.get("", response_model=list[InvitationResponse])
def list_invitations(
    status_filter: str | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(INVITATION_VIEW)),
) -> list[InvitationResponse]:
    invitations = invitation_service.list_invitations(db, actor, status_filter=status_filter)
    return [InvitationResponse(**_to_response(i)) for i in invitations]


@router.get("/preview", response_model=InvitationPreviewResponse)
def preview_invitation(
    token: str = Query(min_length=8, max_length=128),
    db: Session = Depends(get_db),
) -> InvitationPreviewResponse:
    """Unauthenticated: what the acceptance page shows before the user commits."""
    invitation = invitation_service.get_usable_by_token(db, token)
    return InvitationPreviewResponse(
        email=invitation.email,
        role_name=invitation.role.display_name if invitation.role else None,
        account_type=invitation.account_type,
        expires_at=invitation.expires_at,
        # Staff must complete via Google; partners set a password.
        requires_google=invitation.account_type == "staff",
    )


@router.post("", response_model=InvitationCreatedResponse, status_code=status.HTTP_201_CREATED)
def create_invitation(
    data: CreateInvitationRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(INVITATION_CREATE)),
) -> InvitationCreatedResponse:
    invitation, accept_url = invitation_service.create_invitation(db, data, actor)
    return InvitationCreatedResponse(**_to_response(invitation, accept_url))


@router.post(
    "/bulk",
    response_model=list[InvitationCreatedResponse],
    status_code=status.HTTP_201_CREATED,
)
def create_invitations(
    data: BulkCreateInvitationRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(INVITATION_CREATE)),
) -> list[InvitationCreatedResponse]:
    """Invite several addresses at once.

    Each is created independently: one duplicate or bad address does not lose
    the rest. The response contains only those that succeeded.
    """
    created: list[InvitationCreatedResponse] = []
    for entry in data.invitations:
        try:
            invitation, accept_url = invitation_service.create_invitation(db, entry, actor)
        except Exception:  # noqa: BLE001 - a rejected address must not abort the batch
            db.rollback()
            continue
        created.append(InvitationCreatedResponse(**_to_response(invitation, accept_url)))
    return created


@router.post("/{invitation_id}/resend", response_model=InvitationCreatedResponse)
def resend_invitation(
    invitation_id: str,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(INVITATION_RESEND)),
) -> InvitationCreatedResponse:
    """Rotates the token, so the previous link stops working."""
    invitation, accept_url = invitation_service.resend_invitation(db, invitation_id, actor)
    return InvitationCreatedResponse(**_to_response(invitation, accept_url))


@router.delete("/{invitation_id}", response_model=MessageResponse)
def cancel_invitation(
    invitation_id: str,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(INVITATION_CANCEL)),
) -> MessageResponse:
    invitation_service.cancel_invitation(db, invitation_id, actor)
    return MessageResponse(message="Invitation cancelled")
