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
from app.models.ai_conversation import (
    AgentConversation,
    AgentConversationMessage,
    AiMessageFeedback,
)
from app.models.api_consumer import ApiConsumer, ApiConsumerToken, ApiRequestLog
from app.models.api_credential import (
    ApiCredential,
    ApiCredentialSchema,
    ApiCredentialValue,
    ApiServiceProvider,
)
from app.models.app_settings import AppSettings
from app.models.associations import role_permissions, user_roles
from app.models.data_access_grant import DataAccessGrant
from app.models.error_group import ErrorGroup, ErrorOccurrence
from app.models.feature_flag import FeatureFlag
from app.models.permission import Permission
from app.models.permission_group import PermissionGroup
from app.models.role import Role
from app.models.searchable_entity import SearchableEntity, SearchLog
from app.models.setting import Setting
from app.models.user import User
from app.models.user_invitation import UserInvitation
from app.models.user_session import UserSession
from app.models.webhook import WebhookDelivery, WebhookEndpoint
from app.models.worker_run import WorkerJobRun

# isort: split
# --- Domain models ---------------------------------------------------------
#
# Everything above is platform. Everything below belongs to the partner
# directory and is what a second project built on this core DELETES — see
# `CORE_EXTRACTION_PLAN.md` § 1 and `app/domain/`.
#
# They stay in `app/models/` rather than moving under `app/domain/`: Alembic's
# `env.py` imports this module to discover metadata, and it is a PROTECTED file
# whose comment warns that a model missing from the import graph can produce a
# migration that DROPS ITS TABLE. One labelled block here is safer than a second
# discovery path.
#
# ⚠️ Keep this block to domain models ONLY, and check new imports land ABOVE the
# split. `WorkerJobRun` sat here from 3b9946d until 2026-08-17 because isort
# appends below a split marker: a platform model, inside the block that says
# "delete this", whose table `retention_policies`, `worker_service` and
# `activity_service` all read. Deleting it as instructed would have dropped
# `worker_job_runs` — exactly the failure `env.py` warns about.
from app.models.partner import Partner
from app.models.partner_tier import PartnerTier

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
    # Installation settings (DYNAMIC_BRANDING_PLAN phase 1)
    "AppSettings",
    # Partner directory (PARTNER_DIRECTORY_PLAN phase 1)
    "Partner",
    "PartnerTier",
    # LeapDesk parity — Module 11 (Configuration) and Module 6 (Data Access)
    "Setting",
    "FeatureFlag",
    "SearchableEntity",
    "SearchLog",
    "ErrorGroup",
    "ErrorOccurrence",
    "ApiServiceProvider",
    "ApiCredentialSchema",
    "ApiCredential",
    "ApiCredentialValue",
    # `DataAccessGrant` was in the database and in `env.py` but never here, so
    # its mapper was only configured when something imported it directly. Nothing
    # had yet, which is why it went unnoticed; the first string-target
    # relationship pointing at it would have failed to resolve.
    "DataAccessGrant",
    # LeapDesk parity — Module 9 (AI Assistant)
    "AgentConversation",
    "AgentConversationMessage",
    "AiMessageFeedback",
    # LeapDesk parity — Module 10 (Platform API). Not to be confused with the
    # Module 7 tables above: those hold *other people's* secrets, encrypted so we
    # can send them; these hold *ours*, hashed so nobody can read them back.
    "ApiConsumer",
    "ApiConsumerToken",
    "ApiRequestLog",
    # LeapDesk parity — Module 14 (Webhooks). Endpoints belong to a consumer,
    # not to a person: a webhook is a machine-to-machine arrangement.
    "WebhookEndpoint",
    "WebhookDelivery",
    # LeapDesk parity — Module 16, re-scoped: a worker is not a queue, so this
    # records runs rather than a backlog. See the model docstring.
    "WorkerJobRun",
]
