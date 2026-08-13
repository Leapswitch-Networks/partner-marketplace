"""Data Access endpoints — universal "who may see/manage whose records" delegation.

## Where this is mounted, and why it is not `/roles/data-access`

The reference mounts these under `roles/data-access` and its own plan carries the
warning that the declaration must precede `roles/{role}`, or the wildcard
swallows it — FastAPI has the same first-match-wins behaviour, so the trap ports
across intact.

This router takes `/data-access` as its own prefix instead, which removes the
ordering hazard rather than documenting it: there is no `/{role_id}` above it to
collide with, so the route cannot break because someone reordered
`include_router` calls in `main.py`. The grants are user-to-user and have never
been attached to a role — the reference's URL is the misleading part, as
`DataAccessGrant`'s own docstring says. The *screen* still lives with Roles in
the sidebar, which is the parity that was actually specified.

## What is NOT here

No update route. A grant is identified by the triple
`(grantee, subject, scope)`, and `POST` upserts on it — re-submitting a pair
changes its level. That is the reference's `updateOrCreate`, and adding a PATCH
would create a second way to write the same field.
"""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_permission
from app.core.permissions import DATA_ACCESS_MANAGE, DATA_ACCESS_VIEW
from app.core.query import page_meta
from app.models.data_access_grant import SCOPE_ALL, DataAccessGrant
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.schemas.data_access import (
    CreateDataAccessRequest,
    CreateDataAccessResult,
    DataAccessGrantResponse,
    DataAccessListResponse,
    DataAccessOptionsResponse,
)
from app.services import data_access_service

router = APIRouter(prefix="/data-access", tags=["data-access"])

#: The module scopes a grant can target, and the catalogue the labels come from.
#:
#: The reference lists `*`, `qmas`, `presales` and `inventory` — three of which
#: are its own plugins and none of which exist here. `LEAPDESK_PARITY_PLAN.md`
#: § Module 6 settles this explicitly: **PM's list is `*` plus whatever modules
#: exist, initially just `*`.** Seeding their slugs would offer a delegation over
#: a module nobody can reach.
#:
#: A wildcard grant covers modules added later without a migration, so growing
#: this list never invalidates an existing grant.
SCOPES: tuple[tuple[str, str], ...] = ((SCOPE_ALL, "All Modules"),)

_SCOPE_LABELS = dict(SCOPES)
_SCOPE_VALUES = tuple(value for value, _ in SCOPES)


def _scope_label(scope: str) -> str:
    """Human label for a stored scope, falling back to the raw slug.

    Falls back rather than raising: a grant written when the catalogue was wider
    must still render. An unknown slug shown as itself is legible; a 500 on the
    index because one row disagrees with a constant is not.
    """
    return _SCOPE_LABELS.get(scope, scope)


def _party(user: User) -> dict:
    """One side of a grant. Mirrors the reference's `userLabel()`."""
    return {"id": user.id, "name": user.full_name, "email": user.email}


def _to_response(grant: DataAccessGrant) -> DataAccessGrantResponse:
    return DataAccessGrantResponse(
        id=grant.id,
        grantee=_party(grant.grantee),
        subject=_party(grant.subject),
        scope=grant.scope,
        scope_label=_scope_label(grant.scope),
        access_level=grant.access_level,
        granted_by=grant.granter.full_name if grant.granter else None,
        created_at=grant.created_at,
    )


@router.get("", response_model=DataAccessListResponse)
def list_data_access_grants(
    search: str | None = Query(
        default=None,
        description="Matches either party's first name, last name, email, or full name",
    ),
    # `Literal`, not `str`: both go straight into a WHERE, and an unrecognised
    # value would return an empty page that reads as "no grants" rather than
    # "you asked for something that does not exist". Same reasoning as
    # `list_invitations`.
    scope: str | None = Query(default=None),
    access_level: Literal["view", "manage"] | None = Query(default=None),
    sort_by: str = Query(default="created_at"),
    sort_order: str = Query(default="desc", pattern="^(asc|desc)$"),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=25, ge=1, le=100),
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(DATA_ACCESS_VIEW)),
) -> DataAccessListResponse:
    """Every grant, newest first.

    `sort_by` outside `scope` / `access_level` / `created_at` falls back to
    `created_at` rather than erroring — the allowlist lives in the service's
    `ListSpec`, and `column_for` degrades instead of raising so a stale bookmark
    still renders.
    """
    grants, total = data_access_service.list_grants(
        db,
        search=search,
        scope=scope,
        access_level=access_level,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        per_page=per_page,
    )

    return DataAccessListResponse(
        items=[_to_response(g) for g in grants],
        **page_meta(page, per_page, total),
        # Recomputed from the same constant the write routes are guarded on, so
        # the flag and the guard cannot disagree.
        can_manage=actor.has_permission(DATA_ACCESS_MANAGE),
    )


@router.get("/options", response_model=DataAccessOptionsResponse)
def data_access_options(
    db: Session = Depends(get_db),
    _actor: User = Depends(require_permission(DATA_ACCESS_VIEW)),
) -> DataAccessOptionsResponse:
    """Pickers for the create form: ACTIVE users, and the scope catalogue.

    Declared before `/{grant_id}` would be. There is no such GET route today, but
    the ordering rule that bit the reference applies to any literal segment under
    a path parameter, and putting it in the right place now costs nothing.
    """
    users = data_access_service.list_active_users(db)
    return DataAccessOptionsResponse(
        users=[
            {"id": u.id, "name": u.full_name, "email": u.email} for u in users
        ],
        scopes=[{"value": value, "label": label} for value, label in SCOPES],
    )


@router.post("", response_model=CreateDataAccessResult, status_code=status.HTTP_201_CREATED)
def create_data_access_grants(
    payload: CreateDataAccessRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(DATA_ACCESS_MANAGE)),
) -> CreateDataAccessResult:
    """Grant one grantee access over many subjects.

    ## Self-grant pairs are skipped, not fatal

    The reference `continue`s past any `subject_id` equal to the `grantee_id`,
    so submitting a grantee who is also in the subject list succeeds for the
    others. Rejecting the whole batch would be the easier code and the worse
    behaviour — a "select all" that happens to include the grantee would fail
    entirely with nothing written.

    The pairs it skipped are **reported** rather than dropped silently, which is
    the one place this is more forthcoming than the original. `create_grant`
    still raises on a self-grant reaching it directly; this loop simply never
    hands it one.

    `create_grant` also refuses `grantee_id == actor.id` with a 403 — the
    self-elevation guard — and that propagates, because it is the whole batch's
    problem and not one pair's.
    """
    if payload.scope not in _SCOPE_VALUES:
        # 422 rather than a silent fallback to `*`: quietly widening a grant to
        # every module because its scope was misspelled is the worst available
        # failure for this endpoint.
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Unknown scope {payload.scope!r}.",
        )

    created = 0
    skipped_reasons: list[str] = []

    # `dict.fromkeys` rather than `set`: it dedupes like the reference's
    # `array_unique` while keeping the submitted order, so the audit log entries
    # come out in the order the administrator picked them.
    for subject_id in dict.fromkeys(payload.subject_ids):
        if subject_id == payload.grantee_id:
            skipped_reasons.append(
                "A user cannot be granted access to their own records."
            )
            continue

        data_access_service.create_grant(
            db,
            grantee_id=payload.grantee_id,
            subject_id=subject_id,
            scope=payload.scope,
            access_level=payload.access_level,
            actor=actor,
        )
        created += 1

    return CreateDataAccessResult(
        created=created,
        skipped=len(skipped_reasons),
        skipped_reasons=skipped_reasons,
        # The reference's flash copy, verbatim: "Data access updated for N
        # user(s)." — "updated" and not "created" because the write upserts.
        message=f"Data access updated for {created} user(s).",
    )


@router.delete("/{grant_id}", response_model=MessageResponse)
def delete_data_access_grant(
    grant_id: str,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(DATA_ACCESS_MANAGE)),
) -> MessageResponse:
    """Revoke a grant. 404 if it is already gone."""
    data_access_service.delete_grant(db, grant_id, actor)
    return MessageResponse(message="Data access grant removed.")
