"""Role and permission queries plus the role CRUD rules.

Protection rules enforced here (ported from LeapDesk's RolePolicy):
  - a protected role cannot be renamed or deleted
  - a super-admin role's permissions can only be changed by a super admin
  - a role with users assigned cannot be deleted
"""

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.crud import get_or_404
from app.core.permissions import PROTECTED_ROLES, ROLE_PERMISSIONS, SUPER_ADMIN_ROLES
from app.models.associations import user_roles
from app.models.permission import Permission
from app.models.permission_group import PermissionGroup
from app.models.role import Role
from app.models.user import User
from app.schemas.rbac import CloneRoleRequest, CreateRoleRequest, UpdateRoleRequest

# --- Reads ------------------------------------------------------------------


def list_permission_groups(db: Session) -> list[PermissionGroup]:
    stmt = (
        select(PermissionGroup)
        .options(selectinload(PermissionGroup.permissions))
        .order_by(PermissionGroup.display_order, PermissionGroup.id)
    )
    return list(db.scalars(stmt))


def list_roles(db: Session) -> list[Role]:
    stmt = (
        select(Role)
        .options(selectinload(Role.permissions))
        .order_by(Role.is_system.desc(), Role.name)
    )
    return list(db.scalars(stmt))


def role_user_counts(db: Session) -> dict[int, int]:
    """role_id -> number of users holding it, in one query."""
    stmt = select(user_roles.c.role_id, func.count(user_roles.c.user_id)).group_by(
        user_roles.c.role_id
    )
    return dict(db.execute(stmt).all())


def get_role_or_404(db: Session, role_id: int) -> Role:
    return get_or_404(db, Role, role_id)


def _resolve_grantable_permissions(
    db: Session, permission_ids: list[int], actor: User
) -> list[Permission]:
    """Load permissions, refusing any the actor does not themselves hold.

    **The privilege ceiling.** Without it, editing a role is an escalation path
    rather than an administrative task: someone holding a custom role that grants
    `role-update` could add `user-delete` to that same role and immediately have it.
    The route guard cannot catch this — they legitimately hold the permission the
    route requires. The escalation is in the *payload*.

    An earlier comment here argued no ceiling was needed "because the catalog holds
    nothing more dangerous than the role-management permissions themselves". That
    stopped being true once `user-delete` and `activity-view` existed, which is the
    trouble with reasoning from the current contents of a list that grows.

    Super admins bypass, because they already hold everything by definition — a
    ceiling below your own level is not a ceiling.
    """
    permissions = resolve_permissions(db, permission_ids)

    if actor.is_super_admin:
        return permissions

    over_ceiling = sorted(
        p.name for p in permissions if not actor.has_permission(p.name)
    )
    if over_ceiling:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            (
                "You cannot grant a permission you do not hold yourself: "
                f"{', '.join(over_ceiling)}."
            ),
        )
    return permissions


def resolve_permissions(db: Session, permission_ids: list[int]) -> list[Permission]:
    """Load permissions by id, rejecting any id that doesn't exist.

    Failing loudly matters: silently dropping an unknown id would create a role
    that grants less than the administrator believes it does.
    """
    if not permission_ids:
        return []
    unique_ids = list(dict.fromkeys(permission_ids))
    found = list(db.scalars(select(Permission).where(Permission.id.in_(unique_ids))))
    if len(found) != len(unique_ids):
        missing = sorted(set(unique_ids) - {p.id for p in found})
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Unknown permission id(s): {missing}",
        )
    return found


def resolve_roles(db: Session, role_ids: list[int]) -> list[Role]:
    """Load roles by id, rejecting unknown ids for the same reason as above."""
    if not role_ids:
        return []
    unique_ids = list(dict.fromkeys(role_ids))
    found = list(db.scalars(select(Role).where(Role.id.in_(unique_ids))))
    if len(found) != len(unique_ids):
        missing = sorted(set(unique_ids) - {r.id for r in found})
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, f"Unknown role id(s): {missing}"
        )
    return found


def get_role_by_name(db: Session, name: str) -> Role | None:
    return db.scalar(select(Role).where(Role.name == name))


def all_permission_names(db: Session) -> list[str]:
    return list(db.scalars(select(Permission.name).order_by(Permission.name)))


def effective_permissions(db: Session, user: User) -> list[str]:
    """The permissions a user effectively holds, sorted.

    For a super admin this expands the bypass into the FULL catalog rather than
    returning their (possibly empty) grants. That keeps the bypass rule in one
    place — the frontend just checks membership and never needs to know that
    super admins are special.
    """
    if user.is_super_admin:
        return all_permission_names(db)
    return sorted(user.permission_names)


def current_user_payload(db: Session, user: User) -> dict:
    """Build the CurrentUserResponse body, including resolved permissions."""
    return {
        "id": user.id,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "full_name": user.full_name,
        "initials": user.initials,
        "avatar_url": user.avatar_url,
        "designation": user.designation,
        "employee_id": user.employee_id,
        "personal_mobile_number": user.personal_mobile_number,
        "personal_email": user.personal_email,
        "company_name": user.company_name,
        "account_type": user.account_type,
        "status": user.status,
        "auth_provider": user.auth_provider,
        "timezone_preference": user.timezone_preference,
        "email_verified_at": user.email_verified_at,
        "last_login_at": user.last_login_at,
        "created_at": user.created_at,
        "roles": user.roles,
        "permissions": effective_permissions(db, user),
        "is_super_admin": user.is_super_admin,
        "has_admin_access": user.has_admin_access,
        # Lets the password page hide the current-password field after the user
        # has verified an OTP, and keeps that state correct across a reload —
        # LeapDesk gets the same effect from an Inertia prop backed by the session.
        "password_otp_grace": user.password_otp_grace,
    }


def role_users(db: Session, role_id: int) -> list[User]:
    """Users holding a role. Ported from the reference's `roles/{role}/users`.

    No pagination: a role's membership is bounded by the user table, and the
    screen it feeds is a list on the role's detail page rather than an index.
    Revisit if a role ever holds thousands.
    """
    get_role_or_404(db, role_id)
    stmt = (
        select(User)
        .join(user_roles, user_roles.c.user_id == User.id)
        .where(user_roles.c.role_id == role_id)
        .order_by(User.first_name, User.last_name, User.id)
    )
    return list(db.scalars(stmt).unique())


def permission_matrix(db: Session) -> tuple[list[PermissionGroup], list[dict]]:
    """Roles down, permission groups across, with a granted/total count per cell.

    Counts rather than a full permission-by-role grid on purpose: the catalog is
    34 permissions across 11 groups and growing, and a 6x34 grid of checkboxes is
    not readable. The reference makes the same choice — its `matrix()` returns
    `granted` and `total` per group.

    Two queries regardless of role count: one for the groups, one for every
    role-permission pair. Building it per role would be N+1.
    """
    groups = list_permission_groups(db)
    roles = list_roles(db)

    group_ids: dict[int, set[int]] = {
        group.id: {p.id for p in group.permissions} for group in groups
    }

    rows: list[dict] = []
    for role in roles:
        held = {p.id for p in role.permissions}
        rows.append(
            {
                "role_id": role.id,
                "role_name": role.name,
                "display_name": role.display_name,
                "is_system": role.is_system,
                "cells": [
                    {
                        "group_id": gid,
                        "granted": len(held & pids),
                        "total": len(pids),
                    }
                    for gid, pids in group_ids.items()
                ],
            }
        )
    return groups, rows


# --- Writes -----------------------------------------------------------------


def clone_role(db: Session, role_id: int, data: CloneRoleRequest, actor: User) -> Role:
    """Copy a role's permissions onto a new role.

    The clone goes through `_resolve_grantable_permissions`, so the privilege
    ceiling applies: you cannot obtain a permission you do not hold by copying a
    role that has it. Cloning is otherwise the exact escalation path the ceiling
    exists to close — copy Admin, get Admin.

    The clone is never a system role, whatever the source was. `is_system` marks
    roles the guards read by name; a copy has a new name and no guard reads it.
    """
    source = get_role_or_404(db, role_id)
    name = data.name.strip()

    if db.scalar(select(Role).where(func.lower(Role.name) == name.lower())):
        raise HTTPException(status.HTTP_409_CONFLICT, "A role with this name already exists")
    if name in SUPER_ADMIN_ROLES or name in PROTECTED_ROLES:
        raise HTTPException(status.HTTP_409_CONFLICT, "That name is reserved for a system role")

    permissions = _resolve_grantable_permissions(
        db, [p.id for p in source.permissions], actor
    )

    clone = Role(
        name=name,
        display_name=(data.display_name or "").strip() or name,
        description=(data.description or "").strip() or source.description,
        is_system=False,
        permissions=permissions,
    )
    db.add(clone)
    db.commit()
    db.refresh(clone)
    return clone


def set_matrix_cell(
    db: Session, role_id: int, group_id: int, granted: bool, actor: User
) -> Role:
    """Grant or revoke every permission in one group for one role.

    The matrix's only write. It is deliberately all-or-nothing per group: the
    grid shows a granted/total count per cell, so a partial state has no cell to
    represent it and a half-applied change would render identically to no change.

    Runs through the same protection rules as an ordinary edit — a protected
    role still refuses a non-super-admin, and the privilege ceiling still applies
    to what is being granted.
    """
    role = get_role_or_404(db, role_id)

    # The same two checks `update_role` applies when `permission_ids` changes.
    # Inlined rather than shared, because they are four lines and hoisting them
    # into a helper used by exactly two callers hides which rule fires where.
    if role.name in SUPER_ADMIN_ROLES and not actor.is_super_admin:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Only a super admin may modify a super-admin role",
        )
    if not actor.has_permission(ROLE_PERMISSIONS):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Changing what a role grants requires the 'role-permissions' permission.",
        )

    group = db.get(PermissionGroup, group_id)
    if group is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Permission group not found")

    group_ids = {p.id for p in group.permissions}
    current = {p.id for p in role.permissions}
    wanted = (current | group_ids) if granted else (current - group_ids)

    role.permissions = _resolve_grantable_permissions(db, sorted(wanted), actor)
    role.updated_by = actor.id
    db.commit()
    db.refresh(role)
    return role


def create_role(db: Session, data: CreateRoleRequest, actor: User) -> Role:
    name = data.name.strip()

    if db.scalar(select(Role).where(func.lower(Role.name) == name.lower())):
        raise HTTPException(status.HTTP_409_CONFLICT, "A role with this name already exists")

    if name in SUPER_ADMIN_ROLES or name in PROTECTED_ROLES:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "That name is reserved for a system role",
        )

    permissions = _resolve_grantable_permissions(db, data.permission_ids, actor)

    role = Role(
        name=name,
        display_name=data.display_name.strip(),
        description=(data.description or "").strip() or None,
        is_system=False,
        created_by=actor.id,
        updated_by=actor.id,
    )
    role.permissions = permissions
    db.add(role)
    db.commit()
    db.refresh(role)
    return role


def update_role(db: Session, role_id: int, data: UpdateRoleRequest, actor: User) -> Role:
    role = get_role_or_404(db, role_id)

    # A super-admin role's grants may only be edited by a super admin, otherwise
    # an Admin could quietly widen their own path to full access.
    if role.name in SUPER_ADMIN_ROLES and not actor.is_super_admin:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Only a super admin may modify a super-admin role",
        )

    if data.display_name is not None:
        role.display_name = data.display_name.strip()
    if data.description is not None:
        role.description = data.description.strip() or None

    if data.permission_ids is not None:
        # Changing grants needs its own permission, beyond the ROLE_UPDATE the route
        # declares. Same pattern as `update_user`, where the route requires
        # USER_UPDATE and the service additionally requires admin access to touch
        # `status` or `role_ids` — the route states the minimum, the service enforces
        # the rest.
        if not actor.has_permission(ROLE_PERMISSIONS):
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                "Changing what a role grants requires the 'role-permissions' permission.",
            )
        role.permissions = _resolve_grantable_permissions(db, data.permission_ids, actor)

    role.updated_by = actor.id
    db.commit()
    db.refresh(role)
    return role


def delete_role(db: Session, role_id: int) -> None:
    role = get_role_or_404(db, role_id)

    if role.is_protected:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"'{role.name}' is a system role and cannot be deleted",
        )

    assigned = db.scalar(
        select(func.count()).select_from(user_roles).where(user_roles.c.role_id == role_id)
    )
    if assigned:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"{assigned} user(s) still hold this role. Reassign them first.",
        )

    db.delete(role)
    db.commit()
