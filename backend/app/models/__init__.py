"""Model registry.

Importing every model here is load-bearing, not tidiness. Relationships are
declared with string targets (`Mapped[list["Role"]]`), which SQLAlchemy resolves
against its class registry at mapper-configuration time. If a module imports
`User` without `Role` having been imported anywhere, configuring the mapper fails
with:

    InvalidRequestError: expression 'Role' failed to locate a name

Importing `app.models` — which `from app.models.user import User` does as a side
effect of loading the package — registers all of them, so any import order works.

Add every new model to this list.
"""

from app.models.activity_log import ActivityLog
from app.models.associations import role_permissions, user_roles
from app.models.candidate import Candidate
from app.models.category import Category
from app.models.option import Option
from app.models.permission import Permission
from app.models.permission_group import PermissionGroup
from app.models.question import Question
from app.models.role import Role
from app.models.session_answer import SessionAnswer
from app.models.test import Test
from app.models.test_session import TestSession
from app.models.user import User
from app.models.user_invitation import UserInvitation
from app.models.user_session import UserSession

__all__ = [
    # Core identity + RBAC
    "User",
    "Role",
    "Permission",
    "PermissionGroup",
    "UserInvitation",
    "UserSession",
    "ActivityLog",
    "user_roles",
    "role_permissions",
    # Inherited test-platform domain (SCAFFOLD_CLEANUP_PLAN § 2)
    "Candidate",
    "Category",
    "Test",
    "Question",
    "Option",
    "TestSession",
    "SessionAnswer",
]
