"""Association tables for the RBAC pivots.

Declared as Core `Table` objects rather than models because they carry no
columns of their own beyond the two foreign keys — there is nothing to query
about a pivot row itself.
"""

from sqlalchemy import Column, ForeignKey, Integer, String, Table

from app.db.base import Base

#: users <-> roles. A user may hold several roles; permissions are the union.
user_roles = Table(
    "user_roles",
    Base.metadata,
    Column(
        "user_id",
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "role_id",
        Integer,
        ForeignKey("roles.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)

#: roles <-> permissions.
role_permissions = Table(
    "role_permissions",
    Base.metadata,
    Column(
        "role_id",
        Integer,
        ForeignKey("roles.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "permission_id",
        Integer,
        ForeignKey("permissions.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)
