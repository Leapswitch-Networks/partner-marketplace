"""Role and permission queries plus the role CRUD rules.

Protection rules enforced here (ported from LeapDesk's RolePolicy):
  - a protected role cannot be renamed or deleted
  - a super-admin role's permissions can only be changed by a super admin
  - a role with users assigned cannot be deleted
"""

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.permissions import PROTECTED_ROLES, SUPER_ADMIN_ROLES, ROLE_PERMISSIONS
from app.models.associations import user_roles
from app.models.permission import Permission
from app.models.permission_group import PermissionGroup
from app.models.role import Role
from app.models.user import User
from app.schemas.rbac import CreateRoleRequest, UpdateRoleRequest


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
    role = db.get(Role, role_id)
    if role is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Role not found")
    return role


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
    }


# --- Writes -----------------------------------------------------------------


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
