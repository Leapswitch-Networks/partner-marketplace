"""System Health — one read-only endpoint (LeapDesk parity, Module 18).

Port of `SystemHealthController`. **No write.** LeapDesk has one
(`POST probe/{slug}`, checking a provider on demand) and it is absent here for the
reason given in `health_service.providers`: the credential resolution chain it
probes with is Module 7's, and it does not exist yet. Adding the button now would
give it nothing to call.

Not to be confused with `/health` at the application root, which is the
orchestrator's liveness probe — unauthenticated, no database, answers in
microseconds. This one is a permission-gated operator dashboard that queries.
Same word, two audiences, which is why the paths differ.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_permission
from app.core.permissions import HEALTH_VIEW
from app.models.user import User
from app.schemas.health import SystemHealthResponse
from app.services import health_service

router = APIRouter(prefix="/system/health", tags=["system-health"])


@router.get("", response_model=SystemHealthResponse)
def system_health(
    db: Session = Depends(get_db),
    _actor: User = Depends(require_permission(HEALTH_VIEW)),
) -> SystemHealthResponse:
    """Database, storage, errors, queue and providers — summaries only.

    Every panel degrades rather than raising: a health endpoint that 500s when the
    thing it monitors is unwell is useless exactly when it is needed.
    """
    return SystemHealthResponse(**health_service.overview(db))
