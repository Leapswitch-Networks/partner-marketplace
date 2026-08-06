"""Installation-wide settings — the project's identity.

**The GET is deliberately unauthenticated, and that is a decision rather than an
oversight.** The sign-in page renders the application name, monogram and tagline
before any session exists, so a gated endpoint could not serve it. `/api/navigation`
— the other server-driven-chrome endpoint — *is* gated on `get_current_user`, which
is why branding cannot simply ride along on it.

⚠️ **Every field this endpoint returns is world-readable.** It currently returns
exactly what an anonymous visitor already sees painted on the login screen, so it
discloses nothing. **Do not add a field here that is not already public.** The
instinct when adding a new setting later will be to extend the response that already
exists; that instinct is how an unauthenticated endpoint starts leaking configuration.
Anything non-public belongs behind a second, gated endpoint.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import (
    get_db,
    require_password_confirmation,
    require_super_admin,
)
from app.models.user import User
from app.schemas.settings import BrandingResponse, UpdateBrandingRequest
from app.services import settings_service

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/branding", response_model=BrandingResponse)
def read_branding(db: Session = Depends(get_db)) -> BrandingResponse:
    """The resolved project identity. Public — see the module docstring.

    Always returns a complete object: the service falls back to the environment for
    anything unset, so a fresh install with an empty table answers correctly.
    """
    return settings_service.get_branding(db)


@router.put(
    "/branding",
    response_model=BrandingResponse,
    dependencies=[Depends(require_password_confirmation)],
)
def update_branding(
    payload: UpdateBrandingRequest,
    actor: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> BrandingResponse:
    """Change the project identity. Super-admin, with a recent password confirmation.

    **Two guards, deliberately.**

    `require_super_admin` rather than `require_permission(SETTINGS_MANAGE)` because
    `ROLE_PERMISSION_MATRIX` grants `ROLE_ADMIN` the `"*"` wildcard — so putting
    `settings-manage` in the catalog hands it to every Admin on the next seed, the
    same consequence PM-32 hit with `activity-view`. The permission exists so the
    capability is visible on the role permissions page; this guard is the control.

    `require_password_confirmation` because repainting the application is a
    convincing setup for a phishing screen served from the real domain. Someone
    holding a hijacked admin session should not be able to do it — the same reasoning
    that guards enabling and disabling 2FA.

    A partial update: omitting a field leaves it alone, sending `null` clears the
    override and falls back to the environment.
    """
    return settings_service.update_branding(db, payload, actor)
