"""User administration: list, create, update, delete, approve, bulk operations.

The protection rules are the important part — ported from LeapDesk's UserPolicy
and enforced HERE, in one place, so no route can forget them:

  * you cannot delete your own account
  * you cannot change your own status (no locking yourself out, no self-approval)
  * a super-admin target can only be edited by a super admin
  * a super-admin target can never be deleted through the API
  * only an actor with admin access may change `status` or `role_ids`
  * bulk operations SKIP protected targets rather than failing the whole batch,
    and report what they skipped

`can_*` flags are computed with the same predicates the write paths use, so the
UI and the API cannot disagree about what is allowed.
"""

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import Select, select
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.core.query import ListParams, ListSpec, run_list
from app.core.security import hash_password
from app.models.activity_log import EVENT_STATUS_CHANGED
from app.models.role import Role
from app.models.user import User
from app.schemas.rbac import CreateUserRequest, UpdateUserRequest
from app.services import activity_service, session_service, two_factor_service
from app.services.auth_service import email_exists, normalise_email
from app.services.rbac_service import resolve_roles

_LIST_SPEC = ListSpec(
    sortable={
        "created_at": User.created_at,
        "email": User.email,
        "first_name": User.first_name,
        "last_name": User.last_name,
        "status": User.status,
        "account_type": User.account_type,
        "last_login_at": User.last_login_at,
    },
    default_sort="created_at",
    # `created_at` is not unique — a seeded batch or two users created in the same
    # request share a timestamp. Without this tiebreak the sort is partial, and a
    # tying row can appear on two consecutive pages or on neither.
    # `activity_service.list_entries` already sorts by `id` for exactly this
    # reason; this listing did not, and that was a live bug.
    tiebreak=User.id,
    searchable=(User.email, User.first_name, User.last_name, User.company_name),
)


# --- Predicates (single source of truth for both flags and writes) -----------


def can_edit(actor: User, target: User) -> bool:
    if target.is_super_admin and not actor.is_super_admin:
        return False
    return actor.has_permission("user-update")


def can_delete(actor: User, target: User) -> bool:
    if actor.id == target.id:
        return False
    if target.is_super_admin:
        return False
    return actor.has_permission("user-delete")


def can_toggle_status(actor: User, target: User) -> bool:
    if actor.id == target.id:
        return False
    if target.is_super_admin:
        return False
    return actor.has_permission("user-update")


def can_approve(actor: User, target: User) -> bool:
    if actor.id == target.id:
        return False
    if target.status == "ACTIVE" or target.is_super_admin:
        return False
    return actor.has_permission("user-approve")


def decorate(target: User, actor: User) -> User:
    """Attach the per-row `can_*` flags the list/detail schemas read."""
    target.can_edit = can_edit(actor, target)
    target.can_delete = can_delete(actor, target)
    target.can_toggle_status = can_toggle_status(actor, target)
    target.can_approve = can_approve(actor, target)
    return target


def get_user_or_404(db: Session, user_id: str) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return user


# --- Listing ----------------------------------------------------------------


def list_users(
    db: Session,
    actor: User,
    *,
    search: str | None = None,
    status_filter: str | None = None,
    account_type: str | None = None,
    role_id: int | None = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    page: int = 1,
    per_page: int = 15,
) -> tuple[list[User], int]:
    """Paginated users, scoped by the actor's visibility.

    Data visibility: an actor WITHOUT admin access sees only their own record.
    That is the conservative default — there is no "see your team" concept yet,
    and no partner-scoped ownership model (TECH_DEBT PM-5), so anything less
    strict would leak accounts across partners.
    """
    stmt: Select = select(User).options(selectinload(User.roles))

    if not actor.has_admin_access:
        stmt = stmt.where(User.id == actor.id)

    # Filters needing a join stay here — `run_list` owns only what is identical
    # for every resource (search, sort allowlist, tiebreak, clamping, count).
    if status_filter:
        stmt = stmt.where(User.status == status_filter)
    if account_type:
        stmt = stmt.where(User.account_type == account_type)
    if role_id is not None:
        stmt = stmt.where(User.roles.any(Role.id == role_id))

    return run_list(
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


# --- Writes -----------------------------------------------------------------


def create_user(db: Session, data: CreateUserRequest, actor: User) -> User:
    email = normalise_email(data.email)

    if email_exists(db, email):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")

    roles = resolve_roles(db, data.role_ids)
    _guard_role_assignment(roles, actor)

    user = User(
        email=email,
        password=hash_password(data.password) if data.password else None,
        auth_provider="password" if data.password else "google",
        first_name=data.first_name.strip(),
        last_name=data.last_name.strip(),
        account_type=data.account_type,
        status=data.status,
        designation=(data.designation or "").strip() or None,
        employee_id=(data.employee_id or "").strip() or None,
        personal_mobile_number=(data.personal_mobile_number or "").strip() or None,
        company_name=(data.company_name or "").strip() or None,
        timezone_preference=data.timezone_preference,
        # An admin creating an account vouches for the address.
        email_verified_at=datetime.now(timezone.utc),
        created_by=actor.id,
        updated_by=actor.id,
    )
    user.roles = roles

    db.add(user)
    db.commit()
    db.refresh(user)

    activity_service.record_created(
        db,
        subject_type="User",
        subject_id=user.id,
        values={
            "email": user.email,
            "status": user.status,
            "account_type": user.account_type,
            "roles": sorted(role.name for role in user.roles),
            # Recorded because an admin-created account is pre-verified without
            # the holder proving anything, which is a decision worth being able
            # to trace back to whoever made it.
            "email_verified_at": user.email_verified_at.isoformat() if user.email_verified_at else None,
        },
        actor=actor,
        label=user.email,
    )
    return user


def update_user(db: Session, user_id: str, data: UpdateUserRequest, actor: User) -> User:
    target = get_user_or_404(db, user_id)

    if not can_edit(actor, target):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "You do not have permission to edit this account.",
        )

    updates = data.model_dump(exclude_unset=True)

    # Snapshot before anything mutates, for the audit diff (PM-32). Taken here
    # rather than field by field so the recorded "old" values are genuinely the
    # pre-change state and cannot drift as the assignments below run.
    _audited = ("email", "status", "account_type", "first_name", "last_name",
                "designation", "employee_id", "personal_mobile_number",
                "personal_email", "company_name", "timezone_preference")
    before = {field: getattr(target, field) for field in _audited}
    roles_before = sorted(role.name for role in target.roles)

    # --- privileged fields ---
    if "status" in updates and updates["status"] is not None:
        if not actor.has_admin_access:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, "Administrator access required to change status."
            )
        if target.id == actor.id:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, "You cannot change your own status."
            )
        if target.is_super_admin:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, "A super-admin account's status cannot be changed."
            )
        target.status = updates["status"]
        if updates["status"] == "ACTIVE":
            # Approving clears any standing lockout.
            target.failed_login_attempts = 0
            target.locked_until = None

    if "role_ids" in updates and updates["role_ids"] is not None:
        if not actor.has_admin_access:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, "Administrator access required to change roles."
            )
        if target.id == actor.id:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, "You cannot change your own roles."
            )
        roles = resolve_roles(db, updates["role_ids"])
        _guard_role_assignment(roles, actor)
        target.roles = roles

    # --- email ---
    if "email" in updates and updates["email"]:
        new_email = normalise_email(updates["email"])
        if new_email != target.email:
            if email_exists(db, new_email, exclude_user_id=target.id):
                raise HTTPException(
                    status.HTTP_409_CONFLICT, "An account with this email already exists"
                )
            target.email = new_email

    # --- password ---
    if updates.get("password"):
        target.password = hash_password(updates["password"])
        if target.auth_provider == "google" and target.google_id is None:
            target.auth_provider = "password"

    # --- plain fields ---
    for field in ("first_name", "last_name"):
        if updates.get(field):
            setattr(target, field, updates[field].strip())

    for field in ("designation", "employee_id", "personal_mobile_number", "personal_email", "company_name"):
        if field in updates:
            setattr(target, field, (updates[field] or "").strip() or None)

    if updates.get("timezone_preference"):
        target.timezone_preference = updates["timezone_preference"]
    if updates.get("account_type"):
        target.account_type = updates["account_type"]

    target.updated_by = actor.id
    db.commit()
    db.refresh(target)

    # Audit after the commit: the trail should say what happened, and nothing
    # happened until it committed.
    activity_service.record_change(
        db,
        subject_type="User",
        subject_id=target.id,
        before=before,
        after={field: getattr(target, field) for field in _audited},
        actor=actor,
        label=target.email,
    )
    activity_service.record_roles_changed(
        db,
        target=target,
        before=roles_before,
        after=sorted(role.name for role in target.roles),
        actor=actor,
    )

    # A password set by an administrator ends every session the account has. The
    # holder of the old password — which may be the legitimate user, or may not —
    # must not keep a live session after someone else changed their credential.
    if updates.get("password"):
        session_service.revoke_all(db, target.id, reason="password_change")
        activity_service.record(
            db,
            description=f"{target.email} — password set by an administrator",
            event="password_changed",
            subject_type="User",
            subject_id=target.id,
            actor=actor,
        )

    return target


def delete_user(db: Session, user_id: str, actor: User) -> str:
    target = get_user_or_404(db, user_id)

    if target.id == actor.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot delete your own account.")
    if target.is_super_admin:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "A super-admin account cannot be deleted."
        )

    name = target.full_name
    # Snapshot before the delete: this is a hard delete, so afterwards there is
    # nothing left to describe. An audit row reading only "deleted #7" answers
    # nothing a year later.
    snapshot = {
        "email": target.email,
        "first_name": target.first_name,
        "last_name": target.last_name,
        "status": target.status,
        "account_type": target.account_type,
        "company_name": target.company_name,
        "roles": sorted(role.name for role in target.roles),
    }
    target_id = target.id

    db.delete(target)
    db.commit()

    activity_service.record_deleted(
        db,
        subject_type="User",
        subject_id=target_id,
        values=snapshot,
        actor=actor,
        label=snapshot["email"],
    )
    return name


def approve_user(
    db: Session, user_id: str, actor: User, *, force_unverified: bool = False
) -> User:
    """Flip an INACTIVE account to ACTIVE. This is the gate SSO does not open.

    **Approval is where email verification earns its place (PM-35).** Registration
    already lands INACTIVE pending approval, so blocking the *user* on verification
    would add a second gate that tells them nothing new. Blocking the *approver* is
    different and useful: approving an unverified address activates an account whose
    owner may not control that address, and password reset then delivers a live
    credential to it.

    `force_unverified` exists because an administrator who has confirmed identity
    out-of-band — over a call, in person — should not be stuck behind an email the
    user cannot receive. The override is recorded distinctly in the audit trail, so
    "who approved an unverified account" stays answerable.
    """
    target = get_user_or_404(db, user_id)

    if target.status == "ACTIVE":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This account is already active.")
    if target.id == actor.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot approve your own account.")
    if target.is_super_admin:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "A super-admin account cannot be approved here."
        )

    unverified = target.email_verified_at is None
    if unverified and settings.REQUIRE_VERIFIED_EMAIL_FOR_APPROVAL and not force_unverified:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            (
                "This address has not been confirmed yet. Ask the user to click the link "
                "in their email, or approve anyway if you have verified their identity "
                "another way."
            ),
        )

    was = target.status
    target.status = "ACTIVE"
    target.failed_login_attempts = 0
    target.locked_until = None
    target.updated_by = actor.id
    db.commit()
    db.refresh(target)

    # Approval is the gate SSO does not open, so who opened it and when is one of
    # the more important things this trail holds. An override of the verification
    # requirement is flagged in the row rather than looking like a normal approval.
    activity_service.record(
        db,
        description=(
            f"{target.email} — approved"
            + (" (email NOT confirmed — overridden)" if unverified else "")
        ),
        event=EVENT_STATUS_CHANGED,
        subject_type="User",
        subject_id=target.id,
        actor=actor,
        properties={
            "attributes": {"status": "ACTIVE"},
            "old": {"status": was},
            "email_verified": not unverified,
            **({"unverified_override": True} if unverified else {}),
        },
    )
    return target


def toggle_status(db: Session, user_id: str, actor: User) -> User:
    """ACTIVE <-> INACTIVE. SUSPENDED is deliberately not part of the toggle —
    un-suspending is a decision, not a flip, so it goes through `update_user`.
    """
    target = get_user_or_404(db, user_id)

    if not can_toggle_status(actor, target):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "You cannot change this account's status."
        )
    if target.status == "SUSPENDED":
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "A suspended account must be updated explicitly, not toggled.",
        )

    was = target.status
    target.status = "INACTIVE" if target.status == "ACTIVE" else "ACTIVE"
    if target.status == "ACTIVE":
        target.failed_login_attempts = 0
        target.locked_until = None
    target.updated_by = actor.id
    db.commit()
    db.refresh(target)

    activity_service.record(
        db,
        description=f"{target.email} — status {was} to {target.status}",
        event=EVENT_STATUS_CHANGED,
        subject_type="User",
        subject_id=target.id,
        actor=actor,
        properties={"attributes": {"status": target.status}, "old": {"status": was}},
    )

    # Deactivating must end their live sessions, not merely stop new sign-ins.
    # `get_current_user` already re-reads status on every request, so access is
    # refused immediately either way — but leaving the session rows live would
    # mean that re-activating the account silently restores whatever tokens were
    # outstanding, including any an attacker holds. Revoking makes deactivation
    # a real eviction.
    if target.status != "ACTIVE":
        session_service.revoke_all(db, target.id, reason="revoked_by_admin")

    return target


def unlock_user(db: Session, user_id: str, actor: User) -> User:
    """Clear a failed-login lockout without waiting for it to expire."""
    target = get_user_or_404(db, user_id)
    if not can_edit(actor, target):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You cannot modify this account.")

    was_locked = target.locked_until
    target.failed_login_attempts = 0
    target.locked_until = None
    target.updated_by = actor.id
    db.commit()
    db.refresh(target)

    # Worth a row: clearing a lockout removes a control that fired because of
    # repeated failures, so the trail should show who overrode it.
    activity_service.record(
        db,
        description=f"{target.email} — lockout cleared",
        event="lockout_cleared",
        subject_type="User",
        subject_id=target.id,
        actor=actor,
        properties={"old": {"locked_until": was_locked.isoformat() if was_locked else None}},
    )
    return target


def reset_two_factor(db: Session, user_id: str, actor: User) -> User:
    """Clear another user's 2FA enrolment, and end their sessions.

    Sessions are revoked as well as the secret cleared, and that pairing is the
    point. If a phone was stolen rather than lost, whoever has it may still hold a
    live session on that device — clearing only the secret would remove the second
    factor and leave the attacker signed in, which is worse than doing nothing.
    """
    target = get_user_or_404(db, user_id)

    # Same rule as an edit, so a non-super-admin cannot strip a super-admin's 2FA.
    if not can_edit(actor, target):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "You cannot modify this account."
        )
    if target.two_factor_secret is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "This account does not have two-factor authentication set up.",
        )

    had_confirmed = target.two_factor_confirmed_at is not None
    two_factor_service.disable(db, target)
    target.updated_by = actor.id
    db.commit()
    db.refresh(target)

    session_service.revoke_all(db, target.id, reason="revoked_by_admin")

    activity_service.record(
        db,
        log_name="auth",
        description=f"{target.email} — two-factor authentication reset by an administrator",
        event="two_factor_reset_by_admin",
        subject_type="User",
        subject_id=target.id,
        actor=actor,
        properties={"was_confirmed": had_confirmed},
    )
    return target


# --- Bulk -------------------------------------------------------------------


def bulk_delete(db: Session, user_ids: list[str], actor: User) -> tuple[int, int, list[str]]:
    targets = _load_bulk_targets(db, user_ids)
    skipped: list[str] = []
    deleted = 0

    # One batch id shared by every row this operation writes, so "who deleted
    # these nine accounts" reads as one action rather than nine unrelated ones.
    batch = activity_service.new_batch()
    snapshots: list[dict] = []

    for target in targets:
        if target.id == actor.id:
            skipped.append(f"{target.email}: cannot delete your own account")
            continue
        if target.is_super_admin:
            skipped.append(f"{target.email}: super-admin accounts are protected")
            continue
        snapshots.append(
            {
                "id": target.id,
                "email": target.email,
                "status": target.status,
                "account_type": target.account_type,
                "roles": sorted(role.name for role in target.roles),
            }
        )
        db.delete(target)
        deleted += 1

    db.commit()

    for snapshot in snapshots:
        activity_service.record_deleted(
            db,
            subject_type="User",
            subject_id=snapshot["id"],
            values={k: v for k, v in snapshot.items() if k != "id"},
            actor=actor,
            label=snapshot["email"],
            batch_uuid=batch,
        )

    skipped.extend(_missing_ids(user_ids, targets))
    return deleted, len(skipped), skipped


def bulk_set_status(
    db: Session, user_ids: list[str], new_status: str, actor: User
) -> tuple[int, int, list[str]]:
    targets = _load_bulk_targets(db, user_ids)
    skipped: list[str] = []
    deactivated: list[str] = []
    changes: list[dict] = []
    batch = activity_service.new_batch()
    updated = 0

    for target in targets:
        if target.id == actor.id:
            skipped.append(f"{target.email}: cannot change your own status")
            continue
        if target.is_super_admin:
            skipped.append(f"{target.email}: super-admin accounts are protected")
            continue
        if target.status == new_status:
            skipped.append(f"{target.email}: already {new_status}")
            continue
        changes.append({"id": target.id, "email": target.email, "was": target.status})
        target.status = new_status
        if new_status == "ACTIVE":
            target.failed_login_attempts = 0
            target.locked_until = None
        target.updated_by = actor.id
        deactivated.append(target.id)
        updated += 1

    db.commit()

    for change in changes:
        activity_service.record(
            db,
            description=f"{change['email']} — status {change['was']} to {new_status}",
            event=EVENT_STATUS_CHANGED,
            subject_type="User",
            subject_id=change["id"],
            actor=actor,
            properties={
                "attributes": {"status": new_status},
                "old": {"status": change["was"]},
            },
            batch_uuid=batch,
        )

    # Same reasoning as `toggle_status`: a bulk deactivation has to evict, or
    # re-activating later would silently restore every outstanding token. Done
    # after the commit so a revocation failure cannot roll back the status change.
    if new_status != "ACTIVE":
        for user_id in deactivated:
            session_service.revoke_all(db, user_id, reason="revoked_by_admin")

    skipped.extend(_missing_ids(user_ids, targets))
    return updated, len(skipped), skipped


def _load_bulk_targets(db: Session, user_ids: list[str]) -> list[User]:
    unique = list(dict.fromkeys(user_ids))
    return list(db.scalars(select(User).where(User.id.in_(unique))).unique())


def _missing_ids(requested: list[str], found: list[User]) -> list[str]:
    found_ids = {u.id for u in found}
    return [f"{uid}: not found" for uid in dict.fromkeys(requested) if uid not in found_ids]


def _guard_role_assignment(roles: list[Role], actor: User) -> None:
    """Only a super admin may grant a super-admin role.

    Without this, anyone holding `user-update` could promote themselves by
    assigning SuperAdmin to a second account and logging into it — the exact
    escalation path that existed before (TECH_DEBT PM-3).
    """
    if actor.is_super_admin:
        return
    elevated = [r.name for r in roles if r.is_super_admin_role]
    if elevated:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            f"Only a super admin may assign: {', '.join(elevated)}",
        )
