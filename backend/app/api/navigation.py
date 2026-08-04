"""Sidebar navigation for the authenticated user.

The tree is assembled and permission-filtered server-side — see
`services/navigation_service.py` for why. This endpoint has no permission of its
own beyond being signed in: it returns *less* to a less-privileged user rather
than refusing, because a user with no admin permissions still needs a Dashboard
link.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.navigation import NavigationResponse
from app.services import navigation_service

router = APIRouter(prefix="/navigation", tags=["navigation"])


@router.get("", response_model=NavigationResponse)
def get_navigation(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> NavigationResponse:
    """The sections and items this user should see, in render order."""
    return NavigationResponse(
        sections=navigation_service.get_navigation(db, current_user)
    )
