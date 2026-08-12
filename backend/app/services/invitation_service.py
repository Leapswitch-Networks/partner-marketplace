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
from sqlalchemy import Select, case, func, select, update
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.core.crud import get_or_404
from app.core.query import ListParams, ListSpec, run_list
from app.core.security import generate_token, hash_password
from app.models.user import User
from app.models.user_invitation import UserInvitation
from app.schemas.auth import AcceptInvitationRequest
from app.schemas.rbac import CreateInvitationRequest
from app.services import activity_service, webhook_service
from app.services.auth_service import email_exists, normalise_email
from app.services.rbac_service import get_role_or_404

INVITATION_TTL_DAYS = 7

#: Minimum gap between resends of the same invitation. Ported verbatim from the
#: reference, which checks `last_sent_at->diffInSeconds(now()) < 60`.
#:
#: Distinct from the HTTP rate limit, and both are needed: the rate limit is
#: per-IP and stops one caller hammering the endpoint, this is per-invitation and
#: stops one invitee being mailed repeatedly by several admins who each see a
#: stale list.
RESEND_COOLDOWN_SECONDS = 60


def _accept_url(token: str) -> str:
    return f"{settings.FRONTEND_URL.rstrip('/')}/accept-invitation?token={token}"


# --- Reads ------------------------------------------------------------------


_LIST_SPEC = ListSpec(
    sortable={
        "created_at": UserInvitation.created_at,
        "email": UserInvitation.email,
        "status": UserInvitation.status,
        "expires_at": UserInvitation.expires_at,
        "last_sent_at": UserInvitation.last_sent_at,
    },
    default_sort="created_at",
    # `created_at` is not unique — a bulk create writes a whole batch inside one
    # transaction, which is precisely when a partial sort drops or repeats rows.
    tiebreak=UserInvitation.id,
    searchable=(UserInvitation.email, UserInvitation.note),
)


def _expire_elapsed(db: Session, actor: User | None = None) -> None:
    """Flip lapsed `pending` rows to `expired`, in one statement.

    There is no scheduler in this project, so expiry is reflected on read. Doing
    it as a bulk UPDATE rather than by walking a fetched page means it is applied
    to rows the caller's filter would have excluded — which is the whole point,
    because a filter on `status` reads the stored value.

    Not scoped by actor even when one is given: a lapsed invitation is lapsed for
    everybody, and scoping would leave the same row `pending` for one reader and
    `expired` for another.
    """
    now = datetime.now(timezone.utc)
    result = db.execute(
        update(UserInvitation)
        .where(UserInvitation.status == "pending")
        .where(UserInvitation.expires_at <= now)
        .values(status="expired")
    )
    if result.rowcount:
        db.commit()


def list_invitations(
    db: Session,
    actor: User,
    *,
    status_filter: str | None = None,
    account_type: str | None = None,
    search: str | None = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    page: int = 1,
    per_page: int = 25,
) -> tuple[list[UserInvitation], int]:
    """Invitations visible to the actor, paginated.

    Data visibility: an actor without admin access sees only invitations they
    sent themselves.

    Paginated as of 2026-08-07. It previously returned a plain list, which was
    fine while nothing consumed it — the response shape changing is a break, and
    the moment to take it is before the first UI exists rather than after.
    """
    # Reflect elapsed expiry BEFORE filtering, not after.
    #
    # It used to run over the fetched page, which meant `?status=pending`
    # selected on the stored value and then rewrote some of those rows to
    # `expired` on the way out — so a caller asking for pending invitations got
    # rows whose `status` field said `expired`, and the count included them.
    # There is no scheduler in this project, so a lazy flip is the mechanism;
    # doing it first is what makes it honest.
    _expire_elapsed(db, actor)

    # Binned invitations are not listed.
    stmt: Select = select(UserInvitation).where(
        UserInvitation.deleted_at.is_(None)
    ).options(
        selectinload(UserInvitation.role), selectinload(UserInvitation.inviter)
    )

    if not actor.has_admin_access:
        stmt = stmt.where(UserInvitation.invited_by == actor.id)
    if status_filter:
        stmt = stmt.where(UserInvitation.status == status_filter)
    if account_type:
        stmt = stmt.where(UserInvitation.account_type == account_type)

    invitations, total = run_list(
        db,
        stmt,
        _LIST_SPEC,
        ListParams(
            page=page,
            per_page=per_page,
            sort_by=sort_by,
            sort_order=sort_order,
            search=search,
        ),
    )

    return invitations, total


def stats(db: Session, actor: User) -> dict[str, int]:
    """Counts by status, scoped the same way the list is.

    One grouped query, not four counts. Scoped identically to `list_invitations`
    — a non-admin's cards must agree with their table, or the numbers look like a
    bug in whichever they read second.

    Expiry is reflected lazily on read (there is no scheduler), so a row whose
    `expires_at` has passed but whose stored status is still `pending` would be
    counted as pending here. The CASE below classifies on the same rule the model
    uses, so the cards and the rows agree.
    """
    now = datetime.now(timezone.utc)
    expired_case = case(
        (UserInvitation.status == "accepted", "accepted"),
        (UserInvitation.status == "cancelled", "cancelled"),
        (UserInvitation.expires_at <= now, "expired"),
        else_="pending",
    ).label("bucket")

    stmt = select(expired_case, func.count()).group_by(expired_case)
    if not actor.has_admin_access:
        stmt = stmt.where(UserInvitation.invited_by == actor.id)

    counts = {"pending": 0, "accepted": 0, "expired": 0, "cancelled": 0}
    for bucket, total in db.execute(stmt).all():
        counts[bucket] = total
    return counts


def get_by_token(db: Session, token: str) -> UserInvitation:
    # A binned invitation must not be acceptable. The token is still valid
    # cryptographically and still in somebody's inbox — this filter is the
    # only thing that stops a cancelled-then-deleted invite creating an
    # account.
    invitation = db.scalar(
        select(UserInvitation).where(
            UserInvitation.token == token, UserInvitation.deleted_at.is_(None)
        )
    )
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

    # Flip lapsed rows first. Without this, the guard below saw a stale
    # `pending` row, decided it was expired, allowed the create — and left the
    # stale row still stored as `pending`. Re-inviting a lapsed address produced
    # TWO rows both reading `pending`, and `stats` counted both.
    _expire_elapsed(db)

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

        # **The privilege ceiling, applied to invitations.**
        #
        # `rbac_service._resolve_grantable_permissions` already states the rule
        # for editing a role — *"the escalation is in the payload"*, which the
        # route guard cannot catch because the actor legitimately holds the
        # permission the route requires. An invitation is the same escalation
        # with a delay on it: whoever accepts arrives holding whatever `role_id`
        # said.
        #
        # Found by the parity audit on 2026-08-12, and by probing rather than
        # reading: **Staff holds `invitation-create` and could invite a new
        # Admin**, which is every permission in the catalogue. The super-admin
        # guard above stopped RootUser and SuperAdmin; nothing stopped Admin.
        #
        # `has_permission` returns True for a super admin, so they are unaffected
        # — this narrows nobody who could not already grant the same access
        # directly.
        ungrantable = sorted(
            p.name for p in role.permissions if not actor.has_permission(p.name)
        )
        if ungrantable:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"You cannot invite someone into '{role.display_name or role.name}': "
                f"it grants {len(ungrantable)} permission(s) you do not hold yourself.",
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

    # Audited because an invitation is a role grant with a delay on it: whoever
    # accepts arrives holding whatever `role_id` says. AUTHORIZATION.md lists the
    # security-relevant paths, and this one was missing from both the list and
    # the code. The token is never recorded — it is a live credential, and an
    # audit trail is read by more people than a mailbox is.
    activity_service.record(
        db,
        description=f"Invited {invitation.email}"
        + (f" as {role.display_name}" if role else ""),
        event="invited",
        subject_type="UserInvitation",
        subject_id=invitation.id,
        actor=actor,
        properties={
            "email": invitation.email,
            "account_type": invitation.account_type,
            "role": role.name if role else None,
        },
    )
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

    if invitation.last_sent_at is not None:
        # `last_sent_at` may be naive depending on how the driver returned it;
        # compare in UTC rather than assuming.
        last = invitation.last_sent_at
        if last.tzinfo is None:
            last = last.replace(tzinfo=timezone.utc)
        waited = (now - last).total_seconds()
        if waited < RESEND_COOLDOWN_SECONDS:
            remaining = int(RESEND_COOLDOWN_SECONDS - waited) + 1
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                f"This invitation was just sent. Try again in {remaining} seconds.",
            )
    invitation.token = generate_token(64)
    invitation.status = "pending"
    invitation.expires_at = now + timedelta(days=INVITATION_TTL_DAYS)
    invitation.resent_count += 1
    invitation.last_sent_at = now
    db.commit()
    db.refresh(invitation)

    activity_service.record(
        db,
        description=f"Resent the invitation to {invitation.email}",
        event="invitation_resent",
        subject_type="UserInvitation",
        subject_id=invitation.id,
        actor=actor,
        # The count is the useful part: a repeatedly resent invitation is either
        # a delivery problem or someone being chased, and both are worth seeing.
        properties={"email": invitation.email, "resent_count": invitation.resent_count},
    )
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

    activity_service.record(
        db,
        description=f"Cancelled the invitation to {invitation.email}",
        event="invitation_cancelled",
        subject_type="UserInvitation",
        subject_id=invitation.id,
        actor=actor,
        properties={"email": invitation.email},
    )


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

    # After the commit. `emit` never raises, so a webhook receiver cannot fail an
    # acceptance that has already created the account — the invitee would be left
    # with a working password and an error page.
    webhook_service.emit(
        db,
        "invitation.accepted",
        {
            "invitation_id": invitation.id,
            "user_id": user.id,
            "email": user.email,
            "role": invitation.role.name if invitation.role is not None else None,
        },
    )
    return user


def apply_to_google_user(db: Session, token: str, user: User) -> bool:
    """Consume a staff invitation for a user who just authenticated with Google.

    Returns True when the invitation was applied. The email-match check is the
    load-bearing one: holding the link is not enough, the Google account must be
    the invited address.
    """
    # A binned invitation must not be acceptable. The token is still valid
    # cryptographically and still in somebody's inbox — this filter is the
    # only thing that stops a cancelled-then-deleted invite creating an
    # account.
    invitation = db.scalar(
        select(UserInvitation).where(
            UserInvitation.token == token, UserInvitation.deleted_at.is_(None)
        )
    )
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
    # `label` is passed because the model is `UserInvitation` but the word a user
    # should read is "Invitation".
    invitation = get_or_404(db, UserInvitation, invitation_id, "Invitation")
    # Deliberately the *same* 404, not a 403 — see the docstring.
    if not actor.has_admin_access and invitation.invited_by != actor.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invitation not found")
    return invitation
