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
from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.security import hash_password
from app.models.role import Role
from app.models.user import User
from app.schemas.rbac import CreateUserRequest, UpdateUserRequest
from app.services.auth_service import email_exists, normalise_email
from app.services.rbac_service import resolve_roles

_SORTABLE = {
    "created_at": User.created_at,
    "email": User.email,
    "first_name": User.first_name,
    "last_name": User.last_name,
    "status": User.status,
    "account_type": User.account_type,
    "last_login_at": User.last_login_at,
}


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

    if search:
        term = f"%{search.strip().lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(User.email).like(term),
                func.lower(User.first_name).like(term),
                func.lower(User.last_name).like(term),
                func.lower(func.coalesce(User.company_name, "")).like(term),
            )
        )

    if status_filter:
        stmt = stmt.where(User.status == status_filter)
    if account_type:
        stmt = stmt.where(User.account_type == account_type)
    if role_id is not None:
        stmt = stmt.where(User.roles.any(Role.id == role_id))

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0

    column = _SORTABLE.get(sort_by, User.created_at)
    stmt = stmt.order_by(column.desc() if sort_order == "desc" else column.asc())

    per_page = max(1, min(per_page, 100))
    page = max(1, page)
    stmt = stmt.offset((page - 1) * per_page).limit(per_page)

    users = list(db.scalars(stmt).unique())
    return users, total


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
        auth_provider="credentials" if data.password else "google",
        first_name=data.first_name.strip(),
        last_name=data.last_name.strip(),
        account_type=data.account_type,
        status=data.status,
        designation=(data.designation or "").strip() or None,
        employee_id=(data.employee_id or "").strip() or None,
        phone=(data.phone or "").strip() or None,
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
    return user


def update_user(db: Session, user_id: str, data: UpdateUserRequest, actor: User) -> User:
    target = get_user_or_404(db, user_id)

    if not can_edit(actor, target):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "You do not have permission to edit this account.",
        )

    updates = data.model_dump(exclude_unset=True)

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
            target.auth_provider = "credentials"

    # --- plain fields ---
    for field in ("first_name", "last_name"):
        if updates.get(field):
            setattr(target, field, updates[field].strip())

    for field in ("designation", "employee_id", "phone", "company_name"):
        if field in updates:
            setattr(target, field, (updates[field] or "").strip() or None)

    if updates.get("timezone_preference"):
        target.timezone_preference = updates["timezone_preference"]
    if updates.get("account_type"):
        target.account_type = updates["account_type"]

    target.updated_by = actor.id
    db.commit()
    db.refresh(target)
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
    db.delete(target)
    db.commit()
    return name


def approve_user(db: Session, user_id: str, actor: User) -> User:
    """Flip an INACTIVE account to ACTIVE. This is the gate SSO does not open."""
    target = get_user_or_404(db, user_id)

    if target.status == "ACTIVE":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This account is already active.")
    if target.id == actor.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot approve your own account.")
    if target.is_super_admin:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "A super-admin account cannot be approved here."
        )

    target.status = "ACTIVE"
    target.failed_login_attempts = 0
    target.locked_until = None
    target.updated_by = actor.id
    db.commit()
    db.refresh(target)
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

    target.status = "INACTIVE" if target.status == "ACTIVE" else "ACTIVE"
    if target.status == "ACTIVE":
        target.failed_login_attempts = 0
        target.locked_until = None
    target.updated_by = actor.id
    db.commit()
    db.refresh(target)
    return target


def unlock_user(db: Session, user_id: str, actor: User) -> User:
    """Clear a failed-login lockout without waiting for it to expire."""
    target = get_user_or_404(db, user_id)
    if not can_edit(actor, target):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You cannot modify this account.")

    target.failed_login_attempts = 0
    target.locked_until = None
    target.updated_by = actor.id
    db.commit()
    db.refresh(target)
    return target


# --- Bulk -------------------------------------------------------------------


def bulk_delete(db: Session, user_ids: list[str], actor: User) -> tuple[int, int, list[str]]:
    targets = _load_bulk_targets(db, user_ids)
    skipped: list[str] = []
    deleted = 0

    for target in targets:
        if target.id == actor.id:
            skipped.append(f"{target.email}: cannot delete your own account")
            continue
        if target.is_super_admin:
            skipped.append(f"{target.email}: super-admin accounts are protected")
            continue
        db.delete(target)
        deleted += 1

    db.commit()
    skipped.extend(_missing_ids(user_ids, targets))
    return deleted, len(skipped), skipped


def bulk_set_status(
    db: Session, user_ids: list[str], new_status: str, actor: User
) -> tuple[int, int, list[str]]:
    targets = _load_bulk_targets(db, user_ids)
    skipped: list[str] = []
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
        target.status = new_status
        if new_status == "ACTIVE":
            target.failed_login_attempts = 0
            target.locked_until = None
        target.updated_by = actor.id
        updated += 1

    db.commit()
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
