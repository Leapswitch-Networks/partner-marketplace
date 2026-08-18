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


#: partners <-> service_categories. What a partner advertises expertise in.
#:
#: A pivot rather than a column on `partners` because it is many-to-many and
#: because it is the join the **public filter** runs on — "show me partners who
#: do Kubernetes in Pune" is an index scan here, not a LIKE over free text.
#:
#: ⚠️ This records what a partner *offers*, and nothing else. It must never gain
#: a column describing what they buy from us — see the confidentiality block in
#: `PARTNER_DIRECTORY_PLAN.md` § 0.1. That relationship is not modelled on any
#: table a public response can reach.
partner_expertise = Table(
    "partner_expertise",
    Base.metadata,
    Column(
        "partner_id",
        String(36),
        ForeignKey("partners.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "category_id",
        Integer,
        ForeignKey("service_categories.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)
