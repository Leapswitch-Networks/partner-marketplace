"""Tokenised user invitations.

The token is the only credential an invitee holds, so acceptance enforces three
things and all of them matter:

  1. the invitation is still `pending` and not past `expires_at`
  2. the accepting account's email MATCHES the invited address — without this,
     anyone who obtained a link could claim the invited role
  3. the invitation is consumed exactly once (status flips to `accepted`)

There is no mail transport configured in this project yet, so `create` returns
the accept URL to the caller and the frontend surfaces it for the admin to send
manually. That is deliberate and visible rather than a silently dropped email.
"""

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import Select, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import generate_token, hash_password
from app.models.user import User
from app.models.user_invitation import UserInvitation
from app.schemas.auth import AcceptInvitationRequest
from app.schemas.rbac import CreateInvitationRequest
from app.services.auth_service import email_exists, normalise_email
from app.services.rbac_service import get_role_or_404

INVITATION_TTL_DAYS = 7


def _accept_url(token: str) -> str:
    return f"{settings.FRONTEND_URL.rstrip('/')}/accept-invitation?token={token}"


# --- Reads ------------------------------------------------------------------


def list_invitations(
    db: Session, actor: User, *, status_filter: str | None = None
) -> list[UserInvitation]:
    """Invitations visible to the actor.

    Data visibility: an actor without admin access sees only invitations they
    sent themselves.
    """
    stmt: Select = select(UserInvitation)

    if not actor.has_admin_access:
        stmt = stmt.where(UserInvitation.invited_by == actor.id)
    if status_filter:
        stmt = stmt.where(UserInvitation.status == status_filter)

    stmt = stmt.order_by(UserInvitation.created_at.desc())
    invitations = list(db.scalars(stmt).unique())

    # Reflect elapsed expiry into the stored status so the list is honest without
    # needing a scheduled job (there is no scheduler in this project).
    changed = False
    for invitation in invitations:
        if invitation.is_pending and invitation.is_expired:
            invitation.status = "expired"
            changed = True
    if changed:
        db.commit()

    return invitations


def get_by_token(db: Session, token: str) -> UserInvitation:
    invitation = db.scalar(select(UserInvitation).where(UserInvitation.token == token))
    if invitation is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "This invitation link is not valid."
        )
    return invitation


def get_usable_by_token(db: Session, token: str) -> UserInvitation:
    """Fetch an invitation that may still be accepted, or explain why it can't be."""
    invitation = get_by_token(db, token)

    if invitation.status == "accepted":
        raise HTTPException(
            status.HTTP_409_CONFLICT, "This invitation has already been used."
        )
    if invitation.status == "cancelled":
        raise HTTPException(
            status.HTTP_410_GONE, "This invitation was cancelled by an administrator."
        )
    if invitation.is_expired:
        if invitation.is_pending:
            invitation.status = "expired"
            db.commit()
        raise HTTPException(
            status.HTTP_410_GONE,
            "This invitation has expired. Ask an administrator to send a new one.",
        )

    return invitation


# --- Writes -----------------------------------------------------------------


def create_invitation(
    db: Session, data: CreateInvitationRequest, actor: User
) -> tuple[UserInvitation, str]:
    """Create a pending invitation and return it with its accept URL."""
    email = normalise_email(data.email)

    if email_exists(db, email):
        raise HTTPException(
            status.HTTP_409_CONFLICT, "An account with this email already exists"
        )

    existing = db.scalar(
        select(UserInvitation)
        .where(UserInvitation.email == email)
        .where(UserInvitation.status == "pending")
    )
    if existing is not None and not existing.is_expired:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "A pending invitation for this address already exists. Resend it instead.",
        )

    role = None
    if data.role_id is not None:
        role = get_role_or_404(db, data.role_id)
        if role.is_super_admin_role and not actor.is_super_admin:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                "Only a super admin may invite someone into a super-admin role.",
            )

    # A staff invitation must point at a staff domain, or the invitee could never
    # complete it — staff sign in with Google, which is domain-gated.
    if data.account_type == "staff" and not settings.is_staff_email(email):
        allowed = ", ".join("@" + d for d in settings.staff_domains)
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"A staff invitation requires an address at {allowed}.",
        )

    now = datetime.now(timezone.utc)
    invitation = UserInvitation(
        email=email,
        token=generate_token(64),
        status="pending",
        account_type=data.account_type,
        role_id=role.id if role else None,
        expires_at=now + timedelta(days=INVITATION_TTL_DAYS),
        invited_by=actor.id,
        last_sent_at=now,
        note=(data.note or "").strip() or None,
    )
    db.add(invitation)
    db.commit()
    db.refresh(invitation)
    return invitation, _accept_url(invitation.token)


def resend_invitation(
    db: Session, invitation_id: str, actor: User
) -> tuple[UserInvitation, str]:
    """Issue a NEW token and extend the expiry.

    Rotating the token is the point: the previous link stops working, so a
    resend genuinely replaces a leaked or stale link rather than adding a second
    valid one.
    """
    invitation = _get_owned_or_404(db, invitation_id, actor)

    if invitation.status == "accepted":
        raise HTTPException(
            status.HTTP_409_CONFLICT, "This invitation has already been accepted."
        )
    if invitation.status == "cancelled":
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "A cancelled invitation cannot be resent."
        )

    now = datetime.now(timezone.utc)
    invitation.token = generate_token(64)
    invitation.status = "pending"
    invitation.expires_at = now + timedelta(days=INVITATION_TTL_DAYS)
    invitation.resent_count += 1
    invitation.last_sent_at = now
    db.commit()
    db.refresh(invitation)
    return invitation, _accept_url(invitation.token)


def cancel_invitation(db: Session, invitation_id: str, actor: User) -> None:
    invitation = _get_owned_or_404(db, invitation_id, actor)

    if invitation.status == "accepted":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This invitation was already accepted and cannot be cancelled.",
        )

    invitation.status = "cancelled"
    db.commit()


def accept_with_credentials(
    db: Session, data: AcceptInvitationRequest
) -> User:
    """Complete a partner invitation by setting a password.

    The resulting account is ACTIVE immediately — unlike self-registration. An
    administrator already vouched for this address by inviting it, so a second
    approval step would be pure friction.
    """
    invitation = get_usable_by_token(db, data.token)

    if invitation.account_type == "staff":
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "This is a staff invitation — accept it by signing in with Google.",
        )

    if email_exists(db, invitation.email):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "An account with this email already exists. Try signing in instead.",
        )

    user = User(
        email=invitation.email,
        password=hash_password(data.password),
        first_name=data.first_name.strip(),
        last_name=data.last_name.strip(),
        account_type="partner",
        auth_provider="password",
        status="ACTIVE",
        email_verified_at=datetime.now(timezone.utc),
        created_by=invitation.invited_by,
    )
    if invitation.role is not None:
        user.roles.append(invitation.role)

    db.add(user)
    db.flush()

    _mark_accepted(invitation, user)
    db.commit()
    db.refresh(user)
    return user


def apply_to_google_user(db: Session, token: str, user: User) -> bool:
    """Consume a staff invitation for a user who just authenticated with Google.

    Returns True when the invitation was applied. The email-match check is the
    load-bearing one: holding the link is not enough, the Google account must be
    the invited address.
    """
    invitation = db.scalar(select(UserInvitation).where(UserInvitation.token == token))
    if invitation is None or not invitation.is_usable:
        return False

    if invitation.email != user.email:
        # Someone is trying to redeem an invitation meant for another address.
        return False

    if invitation.role is not None:
        # Replace rather than append: the invitation states the intended role.
        user.roles = [invitation.role]

    # An invited staff member is vouched for, so skip the approval queue.
    if user.status == "INACTIVE":
        user.status = "ACTIVE"

    _mark_accepted(invitation, user)
    db.commit()
    db.refresh(user)
    return True


def _mark_accepted(invitation: UserInvitation, user: User) -> None:
    invitation.status = "accepted"
    invitation.accepted_at = datetime.now(timezone.utc)
    invitation.accepted_user_id = user.id


def _get_owned_or_404(db: Session, invitation_id: str, actor: User) -> UserInvitation:
    """Fetch an invitation the actor is allowed to act on.

    A 404 (not 403) for someone else's invitation, so the endpoint does not
    confirm that an invitation exists for an address the caller can't see.
    """
    invitation = db.get(UserInvitation, invitation_id)
    if invitation is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invitation not found")
    if not actor.has_admin_access and invitation.invited_by != actor.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invitation not found")
    return invitation
