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
from app.models.activity_log import EVENT_PERMISSIONS_CHANGED
from app.models.associations import user_roles
from app.models.permission import Permission
from app.models.permission_group import PermissionGroup
from app.models.role import Role
from app.models.user import User
from app.schemas.rbac import CloneRoleRequest, CreateRoleRequest, UpdateRoleRequest
from app.services import activity_service, setting_service

#: Registered in `seed_settings.py`. Read here rather than assumed, because the
#: Security screen shows it as a switch and a switch wired to nothing is worse
#: than no switch.
AUDIT_SETTING = "security.audit.permission_changes"

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
        # Both, because they answer different questions. `theme_preference` is the
        # user's own choice and is None when they inherit — the picker needs it to
        # show which option is selected, and a resolved value cannot tell "chose
        # pine" apart from "inherits, and the installation is pine".
        # `resolved_theme` is what should actually render, so the client applies a
        # theme without a second request and without reimplementing precedence.
        #
        # This rides on `/auth/me`, which every authenticated page load already
        # makes — so a personal theme costs no extra request. It has to be
        # client-side regardless: the root layout resolves branding on the SERVER,
        # and per `AGENTS.md` § 5 an httpOnly cookie cannot be forwarded there, so
        # the server cannot know who is asking before the page renders.
        "theme_preference": user.theme_preference,
        "resolved_theme": _resolved_theme(db, user),
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


def _resolved_theme(db: Session, user: User) -> str | None:
    """Which theme should actually render for this user.

    Precedence, and NULL means *inherit* at every level rather than "no theme":

        user.theme_preference        a personal choice
          -> app_settings.brand_color / theme_preset   the installation's
             -> theme.DEFAULT_PRESET                   the shipped default

    Returns None when the installation is using a **custom brand colour**, because a
    preset key cannot name one. The client then falls back to the server-rendered
    installation theme, which is already correct — and is why this returns an
    optional rather than inventing a key that resolves to something else.
    """
    if user.theme_preference:
        return user.theme_preference

    from app.core import theme
    from app.models.app_settings import SINGLETON_ID, AppSettings

    row = db.get(AppSettings, SINGLETON_ID)
    if row is not None and row.brand_color:
        return None
    if row is not None and row.theme_preset in theme.THEME_PRESETS:
        return row.theme_preset
    return theme.DEFAULT_PRESET


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


def _assert_may_change_grants(role: Role, actor: User) -> None:
    """The two rules every write to a role's permissions has to pass.

    Three call sites apply them — the ordinary edit, the matrix cell and the
    dedicated permissions route — and they were previously copied into two of
    them and reasoned about separately. Copies of a privilege check are how one
    of them ends up a version behind.
    """
    # A super-admin role's grants may only be edited by a super admin, otherwise
    # an Admin could quietly widen their own path to full access.
    if role.name in SUPER_ADMIN_ROLES and not actor.is_super_admin:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Only a super admin may modify a super-admin role",
        )
    # Beyond whatever the route declares. A route states the minimum; the service
    # enforces the rest — the same split `update_user` makes for `status`.
    if not actor.has_permission(ROLE_PERMISSIONS):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Changing what a role grants requires the 'role-permissions' permission.",
        )


def _apply_permissions(
    db: Session, role: Role, permission_ids: list[int], actor: User
) -> None:
    """Set a role's grants, and record what changed.

    **The audit entry is the point of routing all three writers through here.**
    `security.audit.permission_changes` has been in the registry since the
    Configuration module shipped, described as "already true of our behaviour" —
    and nothing read it and nothing wrote the entry. A permission grant is the
    single most security-relevant change in an RBAC system; it was the one kind
    of change the trail did not have.

    Recorded before/after by **name**, not id: an audit row is read by a person,
    and `[3, 17, 41]` is not evidence of anything a year later.
    """
    before = {p.name for p in role.permissions}
    role.permissions = _resolve_grantable_permissions(db, permission_ids, actor)
    after = {p.name for p in role.permissions}
    role.updated_by = actor.id

    granted, revoked = sorted(after - before), sorted(before - after)
    if not granted and not revoked:
        return
    if not setting_service.get(db, AUDIT_SETTING, True):
        return

    # Written after the caller commits would be safer against a rollback, but
    # `activity_service.record` commits on its own — deliberately, so an audit
    # row survives a caller that fails partway. The trade is that a change that
    # is then rolled back leaves a row saying it happened; for grants, a false
    # positive in the trail is the better failure.
    activity_service.record(
        db,
        description=(
            f"{actor.full_name} changed what '{role.display_name or role.name}' grants"
        ),
        event=EVENT_PERMISSIONS_CHANGED,
        subject_type="Role",
        subject_id=str(role.id),
        actor=actor,
        properties={"granted": granted, "revoked": revoked},
    )


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

    # `cloned_from` is the field that matters: a clone carries a whole
    # permission set in one action, and "copied from Admin" explains a grant
    # list that an ordinary create would have had to justify item by item.
    activity_service.record_created(
        db,
        subject_type="Role",
        subject_id=str(clone.id),
        values={
            "name": clone.name,
            "display_name": clone.display_name,
            "cloned_from": source.name,
            "permissions": sorted(p.name for p in clone.permissions),
        },
        actor=actor,
        label=clone.display_name or clone.name,
    )
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

    # Was two inlined checks with a comment explaining that hoisting them would
    # hide which rule fires where. A third caller has since appeared, so they are
    # shared — the comment's concern is answered by the helper naming the rules
    # rather than by repeating them.
    _assert_may_change_grants(role, actor)

    group = db.get(PermissionGroup, group_id)
    if group is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Permission group not found")

    group_ids = {p.id for p in group.permissions}
    current = {p.id for p in role.permissions}
    wanted = (current | group_ids) if granted else (current - group_ids)

    _apply_permissions(db, role, sorted(wanted), actor)
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

    # The grants ride in the creation snapshot rather than through
    # `_apply_permissions`: on a brand-new role "changed from nothing" and
    # "created with" are the same fact, and one row reads better than two.
    activity_service.record_created(
        db,
        subject_type="Role",
        subject_id=str(role.id),
        values={
            "name": role.name,
            "display_name": role.display_name,
            "permissions": sorted(p.name for p in role.permissions),
        },
        actor=actor,
        label=role.display_name or role.name,
    )
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

    before = {"display_name": role.display_name, "description": role.description}
    if data.display_name is not None:
        role.display_name = data.display_name.strip()
    if data.description is not None:
        role.description = data.description.strip() or None
    after = {"display_name": role.display_name, "description": role.description}

    if data.permission_ids is not None:
        # The conditional check survives alongside `set_role_permissions`'s
        # declarative one, and both are needed: this route accepts grants as one
        # field of an ordinary edit, so `role-update` alone must not carry them.
        _assert_may_change_grants(role, actor)
        _apply_permissions(db, role, data.permission_ids, actor)

    role.updated_by = actor.id
    db.commit()
    db.refresh(role)

    # Grants are `_apply_permissions`' row; this one covers the rename path,
    # which used to be the only role edit the trail could not see.
    # `record_change` writes nothing when the diff is empty.
    activity_service.record_change(
        db,
        subject_type="Role",
        subject_id=str(role.id),
        before=before,
        after=after,
        actor=actor,
        label=role.display_name or role.name,
    )
    return role


def set_role_permissions(
    db: Session, role_id: int, permission_ids: list[int], actor: User
) -> Role:
    """Replace a role's grants. The write behind `PUT /roles/{id}/permissions`.

    **Split out on 2026-08-12 to close § 3e of the parity plan.** The rule was
    enforced only as a conditional field check inside `update_role`, so unlike
    every other permission in the system it appeared nowhere in OpenAPI — and
    `VERSION_SUMMARY.md`'s principle is that gating is declarative per route
    precisely so an ungated route is obvious in review. A rule you cannot see in
    the contract is one a reviewer has to know to go looking for.
    """
    role = get_role_or_404(db, role_id)
    _assert_may_change_grants(role, actor)
    _apply_permissions(db, role, permission_ids, actor)
    db.commit()
    db.refresh(role)
    return role


def delete_role(db: Session, role_id: int, actor: User) -> None:
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

    # Snapshot taken before the delete: this is a hard delete, so the audit row
    # is the only place the role's grant list survives.
    snapshot = {
        "name": role.name,
        "display_name": role.display_name,
        "description": role.description,
        "permissions": sorted(p.name for p in role.permissions),
    }
    label = role.display_name or role.name

    db.delete(role)
    db.commit()

    activity_service.record_deleted(
        db,
        subject_type="Role",
        subject_id=str(role_id),
        values=snapshot,
        actor=actor,
        label=label,
    )
