"""Invitation endpoints.

`GET /preview` is the only UNAUTHENTICATED route here — the invitee has a token
but no account yet. It returns the bare minimum needed to render the acceptance
page and nothing about the inviter or the wider system.
"""

import logging
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.dependencies import get_db, require_permission
from app.core.permissions import (
    INVITATION_CANCEL,
    INVITATION_CREATE,
    INVITATION_RESEND,
    INVITATION_VIEW,
)
from app.core.query import page_meta
from app.models.user import User
from app.models.user_invitation import UserInvitation
from app.schemas.auth import MessageResponse
from app.schemas.common import Page
from app.schemas.rbac import (
    BulkCreateInvitationRequest,
    CreateInvitationRequest,
    InvitationPreviewResponse,
    InvitationResponse,
    InvitationStats,
    SkippedInvitation,
)
from app.services import invitation_service, mail_service, settings_service

logger = logging.getLogger("app.invitations")

router = APIRouter(prefix="/invitations", tags=["invitations"])


def _deliver(db: Session, invitation: UserInvitation, accept_url: str) -> dict:
    """Email the invitation, and decide what the response should expose.

    The link is withheld from the response only when a real email was delivered.
    Otherwise the administrator needs it — a failed send with no link in the
    response would leave the invitation created and uncompletable, and resending
    would then refuse with "a pending invitation already exists".
    """
    sent = mail_service.send_invitation(
        to=invitation.email,
        accept_url=accept_url,
        inviter_name=invitation.inviter.full_name if invitation.inviter else None,
        expires_days=invitation_service.INVITATION_TTL_DAYS,
        # The role is what the invitee is being asked to accept, and the note is
        # what the column comment has always promised. Both were being dropped.
        role_name=invitation.role.display_name if invitation.role else None,
        note=invitation.note,
        app_name=settings_service.get_branding(db).app_name,
    )
    delivered = sent and settings.MAIL_BACKEND.lower() != "console"
    payload = _to_response(invitation, None if delivered else accept_url)
    payload["email_sent"] = delivered
    return payload


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
    """Includes the accept URL, and says whether an email actually went out.

    `accept_url` used to be returned unconditionally because there was no mail
    transport at all (PM-27). Now it is returned only when the invitee did **not**
    receive an email — either because the backend is `console`, or because the
    send failed. When a real email was delivered the field is `null`, so the link
    is not sitting in an API response, a browser devtools tab and a log for a
    credential that was already delivered privately.

    `email_sent` exists so the UI can tell the two cases apart: "we emailed them"
    versus "copy this link and send it yourself".
    """

    accept_url: str | None = None
    email_sent: bool = False


class BulkInvitationResult(BaseModel):
    """What a batch actually did.

    Mirrors `BulkActionResult` in the users module, for the same reason: a
    partial success that reports only its successes reads as a total one.

    Declared here rather than in `schemas/rbac.py` because it embeds
    `InvitationCreatedResponse`, which is defined in this module — the accept-url
    withholding logic belongs next to the endpoint that decides it.
    """

    requested: int
    created: list[InvitationCreatedResponse] = Field(default_factory=list)
    skipped: list[SkippedInvitation] = Field(default_factory=list)


@router.get("", response_model=Page[InvitationResponse])
def list_invitations(
    # Literal, not `str`. It goes straight into a WHERE against an enum column,
    # so an unrecognised value used to return an empty page that looked like
    # "no invitations" rather than "you asked for a status that does not exist".
    status_filter: Literal["pending", "accepted", "expired", "cancelled"] | None = Query(
        default=None, alias="status"
    ),
    
    account_type: Literal["internal", "external"] | None = Query(default=None),
    search: str | None = Query(default=None, description="Matches email or note"),
    sort_by: str = Query(default="created_at"),
    sort_order: str = Query(default="desc", pattern="^(asc|desc)$"),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=25, ge=1, le=100),
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(INVITATION_VIEW)),
) -> Page[InvitationResponse]:
    """Invitations visible to the caller, newest first.

    Returns the shared `Page[T]` envelope like every other index endpoint. It
    previously returned a bare list; nothing consumed it, so the shape change
    was free to take now and would not have been later.
    """
    invitations, total = invitation_service.list_invitations(
        db,
        actor,
        status_filter=status_filter,
        account_type=account_type,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        per_page=per_page,
    )
    return Page[InvitationResponse](
        items=[InvitationResponse(**_to_response(i)) for i in invitations],
        **page_meta(page, per_page, total),
    )


@router.get("/stats", response_model=InvitationStats)
def invitation_stats(
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(INVITATION_VIEW)),
) -> InvitationStats:
    """Counts by status, scoped like the list.

    Declared before `/{invitation_id}` would be if one existed, for the same
    reason `/preview` is: FastAPI matches in declaration order.
    """
    return InvitationStats(**invitation_service.stats(db, actor))


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
        requires_google=invitation.account_type == "internal",
    )


@router.post("", response_model=InvitationCreatedResponse, status_code=status.HTTP_201_CREATED)
def create_invitation(
    data: CreateInvitationRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(INVITATION_CREATE)),
) -> InvitationCreatedResponse:
    invitation, accept_url = invitation_service.create_invitation(db, data, actor)
    return InvitationCreatedResponse(**_deliver(db, invitation, accept_url))


@router.post(
    "/bulk",
    response_model=BulkInvitationResult,
    status_code=status.HTTP_201_CREATED,
)
def create_invitations(
    data: BulkCreateInvitationRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(INVITATION_CREATE)),
) -> BulkInvitationResult:
    """Invite several addresses at once.

    Each is created independently: one duplicate or bad address does not lose the
    rest. **The response says what was skipped and why** — the same contract the
    users module's bulk actions use, and for the same reason: a partial success
    that reports only its successes reads as a total one.
    """
    created: list[InvitationCreatedResponse] = []
    skipped: list[SkippedInvitation] = []

    for entry in data.invitations:
        try:
            invitation, accept_url = invitation_service.create_invitation(db, entry, actor)
        except HTTPException as exc:
            # The service raises 409 for a duplicate, 403 for a role the actor
            # may not grant, and 400 for a staff address on the wrong domain.
            # Those are three different things an administrator should act on
            # differently, and a bare `except Exception: continue` reported them
            # identically — as silence.
            db.rollback()
            skipped.append(
                SkippedInvitation(email=entry.email, reason=str(exc.detail))
            )
        except Exception as exc:  # noqa: BLE001 - one address must not abort the batch
            db.rollback()
            logger.exception("bulk invitation failed for %s", entry.email)
            skipped.append(
                SkippedInvitation(
                    email=entry.email,
                    # Deliberately not `str(exc)`: an unexpected exception's text
                    # can carry internals, and this goes to a browser.
                    reason=f"Unexpected error ({type(exc).__name__}).",
                )
            )
        else:
            created.append(InvitationCreatedResponse(**_deliver(db, invitation, accept_url)))

    return BulkInvitationResult(
        requested=len(data.invitations),
        created=created,
        skipped=skipped,
    )


@router.post("/{invitation_id}/resend", response_model=InvitationCreatedResponse)
def resend_invitation(
    invitation_id: str,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(INVITATION_RESEND)),
) -> InvitationCreatedResponse:
    """Rotates the token, so the previous link stops working."""
    invitation, accept_url = invitation_service.resend_invitation(db, invitation_id, actor)
    return InvitationCreatedResponse(**_deliver(db, invitation, accept_url))


@router.delete("/{invitation_id}", response_model=MessageResponse)
def cancel_invitation(
    invitation_id: str,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(INVITATION_CANCEL)),
) -> MessageResponse:
    invitation_service.cancel_invitation(db, invitation_id, actor)
    return MessageResponse(message="Invitation cancelled")
