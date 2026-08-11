"""Security — the hardening controls (LeapDesk parity, Module 12).

Port of `SecuritySettingController`. **Not its own table**: it reads and writes
the `security.*` namespace of Module 11's registry, with its own screen because
these controls need grouping and explaining in a way a generic settings list
cannot do.

## The guard is the point

`abort_unless(str_starts_with($setting->key, 'security.'), 404)` is the one line
that keeps two screens over one table honest, and it is reproduced exactly.
Without it, `PUT /settings/security/{id}` is a second write path to **every**
setting — one that a reader of the Security screen's permissions would never
think to check. Same reason it answers **404 rather than 403**: a caller with no
business here learns that this endpoint does not address that row, not that the
row exists and is guarded.

## Every default reproduces today's behaviour

Stated in the seeder and worth repeating at the endpoint: nothing on this screen
changes anything until an administrator deliberately tightens it. That is what
makes a security-settings page safe to ship — a default that hardened something
on deploy would lock people out of a system nobody had asked them about.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_permission
from app.core.permissions import SETTINGS_UPDATE, SETTINGS_VIEW
from app.core.setting_types import SETTING_TYPE_LABELS
from app.models.activity_log import LOG_AUTH, LOG_SETTINGS, ActivityLog
from app.models.setting import Setting
from app.models.user import User
from app.schemas.security import (
    SecurityAuditRow,
    SecurityOverviewResponse,
)
from app.schemas.setting import SettingResponse, UpdateSettingRequest
from app.services import setting_service
from app.services.setting_service import SECURITY_PREFIX

router = APIRouter(prefix="/settings/security", tags=["security"])

#: How many audit rows the panel carries. LeapDesk's number.
#:
#: It is a fixed window rather than a paged list on purpose — this is a "what has
#: happened lately" panel, not the Activity Log. Anyone who needs to go further
#: back belongs on `/dashboard/activity`, which is built for it and can filter.
AUDIT_LIMIT = 50


def _to_response(setting: Setting) -> SettingResponse:
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


def _recent_audit(db: Session) -> list[SecurityAuditRow]:
    """Recent security-relevant activity.

    Reads the **log channels**, not a separate table, so these are the same rows
    the Activity Log shows — one audit trail with two views onto it, rather than
    two trails that can disagree.

    `auth` + `settings` is our equivalent of LeapDesk's `security` + `auth`: who
    signed in, and who changed how signing in works. We have no `security`
    channel because nothing writes one; when something does, add it here and the
    panel picks it up.
    """
    rows = db.scalars(
        select(ActivityLog)
        .where(ActivityLog.log_name.in_([LOG_AUTH, LOG_SETTINGS]))
        .order_by(ActivityLog.id.desc())
        .limit(AUDIT_LIMIT)
    ).all()

    # Causer names resolved in one query for the whole page rather than per row —
    # the same rule `activity_service.list_entries` follows, and for the same
    # reason: 50 rows would otherwise be 50 lookups.
    causer_ids = {r.causer_id for r in rows if r.causer_id}
    names: dict[str, str] = {}
    if causer_ids:
        for user in db.scalars(select(User).where(User.id.in_(causer_ids))):
            names[user.id] = user.full_name

    return [
        SecurityAuditRow(
            id=row.id,
            description=row.description,
            event=row.event,
            log_name=row.log_name,
            # Three states, not two, and the third is the one LeapDesk gets
            # wrong. Theirs is `$a->causer ? name : 'system'`, so a row whose
            # causer has since been **deleted** resolves the relation to null and
            # prints "system" — labelling a human action as automation, on the
            # one screen where "did a person do this" is the question being
            # asked. `causer_id` is retained on the row precisely so that
            # distinction survives the account; saying so is the whole point.
            causer=(
                "system"
                if not row.causer_id
                else names.get(row.causer_id) or "deleted user"
            ),
            created_at=row.created_at,
        )
        for row in rows
    ]


@router.get("", response_model=SecurityOverviewResponse)
def security_overview(
    db: Session = Depends(get_db),
    _actor: User = Depends(require_permission(SETTINGS_VIEW)),
) -> SecurityOverviewResponse:
    """Every `security.*` control, plus the recent audit.

    Returned as a flat list with each row carrying its `group`, rather than
    pre-grouped into a map. A JSON object does not guarantee key order, so
    grouping server-side would hand the client a shape whose tab order is not
    reliable — the list is already ordered `group → label`, and the client groups
    it while preserving that order.
    """
    settings = [
        s
        for s in setting_service.list_settings(db)
        if s.key.startswith(SECURITY_PREFIX)
    ]
    return SecurityOverviewResponse(
        items=[_to_response(s) for s in settings],
        audit=_recent_audit(db),
    )


@router.put("/{setting_id}", response_model=SettingResponse)
def update_security_setting(
    setting_id: int,
    payload: UpdateSettingRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(SETTINGS_UPDATE)),
) -> SettingResponse:
    """Change one security control.

    The namespace check is the reason this endpoint exists separately from
    `PUT /settings/configuration/{id}` rather than being an alias for it — see
    the module docstring.
    """
    setting = setting_service.get_or_404(db, setting_id)

    if not setting.key.startswith(SECURITY_PREFIX):
        # 404, not 403. This endpoint does not address that row at all, and
        # saying "forbidden" would confirm which ids exist outside the namespace.
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "That setting does not exist."
        )

    updated = setting_service.update_value(db, setting, payload.value, actor)
    return _to_response(updated)
