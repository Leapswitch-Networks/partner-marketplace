"""Configuration — the shared settings registry (LeapDesk parity, Module 11).

Port of `SettingController`. Its docblock explains why it exists: it *"replaces
four parallel per-plugin implementations"* — every module that needs a tunable
value reads it from here instead of growing a settings table and a settings
screen of its own.

## Two endpoints, and deliberately no more

There is **no create and no delete**. Rows are declared in code by
`setting_service.register` and reconciled by a seeder, which is what guarantees
the screen always knows a label, a type and a group for everything it renders. A
setting nothing reads is dead weight; code reading a setting that does not exist
is a bug. Both are migration concerns.

## Why this is not part of `app/api/settings.py`

That router is the **installation's identity** — name, monogram, tagline, theme —
a singleton row rendered on the sign-in page before any session exists, with a
deliberately unauthenticated GET. This one is an authenticated, permission-gated
registry of operational tunables. Same English word, two unrelated things; mounted
at `/settings/configuration` so the URL says which.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_permission
from app.core.permissions import SETTINGS_UPDATE, SETTINGS_VIEW
from app.core.setting_types import SETTING_TYPE_LABELS, type_options
from app.models.setting import Setting
from app.models.user import User
from app.schemas.setting import (
    SettingListResponse,
    SettingResponse,
    UpdateSettingRequest,
)
from app.services import setting_service

router = APIRouter(prefix="/settings/configuration", tags=["configuration"])


def _to_response(setting: Setting) -> SettingResponse:
    """Flatten one row for the wire.

    `type_label` is sent alongside `type` so the client renders "Yes / No" without
    carrying its own copy of the type vocabulary — the same reason `types` is in
    the list envelope. Two places holding that mapping is how the API and the UI
    end up disagreeing about what a type is called.
    """
    return SettingResponse(
        id=setting.id,
        key=setting.key,
        label=setting.label,
        description=setting.description,
        type=setting.type,
        type_label=SETTING_TYPE_LABELS.get(setting.type, setting.type),
        group=setting.group,
        module=setting.module,
        value=setting.typed_value(),
        updated_at=setting.updated_at,
    )


@router.get("", response_model=SettingListResponse)
def list_configuration(
    module: str | None = Query(default=None, description="Restrict to one module"),
    db: Session = Depends(get_db),
    _actor: User = Depends(require_permission(SETTINGS_VIEW)),
) -> SettingListResponse:
    """Every setting, ordered `module → group → label`.

    Unpaged, matching LeapDesk. The registry is declared in code and is tens of
    rows — it does not grow with usage — so the screen filters and pages in the
    browser. `modules` is read from the data rather than hardcoded, so a new
    module's settings appear in the filter the moment they are seeded.
    """
    rows = setting_service.list_settings(db, module=module)
    return SettingListResponse(
        items=[_to_response(s) for s in rows],
        modules=setting_service.list_modules(db),
        types=type_options(),
    )


@router.put("/{setting_id}", response_model=SettingResponse)
def update_configuration(
    setting_id: int,
    payload: UpdateSettingRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(SETTINGS_UPDATE)),
) -> SettingResponse:
    """Change one setting's value.

    Validation lives in the service and is derived from the row's **own declared
    type** — an `int` setting rejects `"abc"`, a `bool` rejects `"maybe"` — so a
    new setting needs no new validation rule anywhere. A rejected value answers
    422 naming the setting, because this screen edits many rows and "invalid
    input" would not say which.

    No password confirmation, matching LeapDesk. The controls that *do* warrant
    re-authentication live under `security.*` and are Module 12's business, which
    is also where the setting deciding that will live.
    """
    setting = setting_service.get_or_404(db, setting_id)
    updated = setting_service.update_value(db, setting, payload.value, actor)
    return _to_response(updated)
