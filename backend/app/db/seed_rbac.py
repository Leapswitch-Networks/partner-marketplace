"""Seed the RBAC tables and the bootstrap root account.

Idempotent: safe to re-run after every deploy. It reconciles the database with
`app.core.permissions`, which is the source of truth:

  * permission groups and permissions are created or updated to match the catalog
  * system roles are created if missing, and their permissions are re-synced
  * a non-system (administrator-created) role is never touched
  * the root account is created only if no user exists at all

Usage (from backend/):
    python -m app.db.seed_rbac

The root password comes from ROOT_PASSWORD in the environment. There is no
hardcoded default — a public repo must not ship a working credential.
"""

import os
import secrets
import sys
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.permissions import (
    PERMISSION_CATALOG,
    ROLE_DESCRIPTIONS,
    ROLE_PERMISSION_MATRIX,
    ROLE_ROOT,
    SUPER_ADMIN_ROLES,
)
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.permission import Permission
from app.models.permission_group import PermissionGroup
from app.models.role import Role
from app.models.user import User

ROOT_EMAIL_ENV = "ROOT_EMAIL"
ROOT_PASSWORD_ENV = "ROOT_PASSWORD"
DEFAULT_ROOT_EMAIL = "root@leapswitch.com"


def seed_permissions(db: Session) -> dict[str, Permission]:
    """Create/update every group and permission in the catalog."""
    by_name: dict[str, Permission] = {}

    for group_name, (display, order, module, entries) in PERMISSION_CATALOG.items():
        group = db.scalar(select(PermissionGroup).where(PermissionGroup.name == group_name))
        if group is None:
            group = PermissionGroup(name=group_name)
            db.add(group)
        group.display_name = display
        group.display_order = order
        group.module = module
        db.flush()

        for permission_name, label in entries:
            permission = db.scalar(
                select(Permission).where(Permission.name == permission_name)
            )
            if permission is None:
                permission = Permission(name=permission_name)
                db.add(permission)
            permission.display_name = label
            permission.permission_group_id = group.id
            db.flush()
            by_name[permission_name] = permission

    db.commit()
    print(f"[seed] permissions: {len(by_name)} across {len(PERMISSION_CATALOG)} groups")
    return by_name


def seed_roles(db: Session, permissions: dict[str, Permission]) -> dict[str, Role]:
    """Create system roles and re-sync their permission grants."""
    roles: dict[str, Role] = {}

    for role_name, grants in ROLE_PERMISSION_MATRIX.items():
        role = db.scalar(select(Role).where(Role.name == role_name))
        created = role is None
        if role is None:
            role = Role(name=role_name)
            db.add(role)

        role.display_name = role_name
        role.description = ROLE_DESCRIPTIONS.get(role_name)
        role.is_system = True

        if grants == "*":
            role.permissions = list(permissions.values())
        else:
            resolved = [permissions[name] for name in grants if name in permissions]
            missing = [name for name in grants if name not in permissions]
            if missing:
                # Loud, because a typo here silently under-grants a role.
                print(f"[seed] WARNING role '{role_name}' references unknown: {missing}")
            role.permissions = resolved

        db.flush()
        roles[role_name] = role
        print(
            f"[seed] role {'created' if created else 'synced '} {role_name:<12} "
            f"({len(role.permissions)} permissions)"
        )

    db.commit()
    return roles


def seed_root_user(db: Session, roles: dict[str, Role]) -> None:
    """Create the bootstrap root account, only when the users table is empty.

    Guarding on "no users at all" rather than "no root user" is deliberate: once
    a real administrator exists, this must never silently mint a second
    all-powerful account.
    """
    existing_users = db.scalar(select(func.count()).select_from(User)) or 0
    if existing_users:
        print(f"[seed] {existing_users} user(s) already exist — root account not created")
        _report_rootless(db)
        return

    email = os.environ.get(ROOT_EMAIL_ENV, DEFAULT_ROOT_EMAIL).strip().lower()
    password = os.environ.get(ROOT_PASSWORD_ENV, "").strip()
    generated = False

    if not password:
        # Better a random password printed once than a known default committed.
        password = secrets.token_urlsafe(16)
        generated = True

    root = User(
        email=email,
        password=hash_password(password),
        first_name="Root",
        last_name="User",
        account_type="staff",
        auth_provider="password",
        status="ACTIVE",
        email_verified_at=datetime.now(timezone.utc),
    )
    root_role = roles.get(ROLE_ROOT)
    if root_role:
        root.roles.append(root_role)

    db.add(root)
    db.commit()

    print(f"[seed] created root account: {email}")
    if generated:
        print("[seed] ------------------------------------------------------------")
        print(f"[seed] GENERATED PASSWORD: {password}")
        print("[seed] Shown once. Store it now, then change it after signing in.")
        print(f"[seed] Set {ROOT_PASSWORD_ENV} to choose your own instead.")
        print("[seed] ------------------------------------------------------------")


def _report_rootless(db: Session) -> None:
    """Warn only when NO account can bypass permission checks.

    Checks both super-admin roles, not just RootUser — SuperAdmin bypasses too,
    so warning on a missing RootUser alone would be misleading noise.
    """
    holders: list[str] = []
    for role_name in SUPER_ADMIN_ROLES:
        role = db.scalar(select(Role).where(Role.name == role_name))
        if role is not None:
            holders.extend(f"{u.email} ({role_name})" for u in role.users)

    if holders:
        print(f"[seed] super-admin accounts: {', '.join(sorted(holders))}")
        return

    print(
        f"[seed] WARNING no account holds {' or '.join(sorted(SUPER_ADMIN_ROLES))}. "
        "Nobody can bypass permission checks — grant one before locking yourself out."
    )


def seed() -> None:
    db = SessionLocal()
    try:
        permissions = seed_permissions(db)
        roles = seed_roles(db, permissions)
        seed_root_user(db, roles)
        print("[seed] done")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
    sys.exit(0)
