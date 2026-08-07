"""Fetch-or-404, in one place.

Five services each wrote their own version of the same four lines, and they had
drifted: "User not found", "Role not found", "Invitation not found", and
"This invitation link is not valid." for the same class of failure. A client
cannot branch on prose, and the inconsistency is the kind that spreads — the
sixth module copies whichever one it happened to read.

**Deliberately not a CRUD base class**, which is what
`CORE_COMPLETION_PLAN.md` § 3.3 originally specified. Reading the real write
paths killed that idea:

  * `user_service.update_user` runs permission predicates, snapshots an audit
    diff before mutating, and gates `status` and `role_ids` behind separate
    admin checks. A generic `update()` would be overridden in full.
  * `invitation_service` has no plain update at all — its writes are resend,
    cancel and accept, each with its own state machine.
  * `FASTAPI_STANDARDS.md` § 3 specifies services as **module-level functions**
    with `db` first and `actor` last. A base class would introduce a second way
    of doing the same thing, which `AGENTS.md` § Core Principles forbids.

So the shared layer takes the part that is genuinely identical everywhere and
leaves the part that genuinely differs alone. `run_list` in `app.core.query`
carries the reads; this carries the single-row fetch. The domain rules stay in
the services, where they are readable.
"""

from __future__ import annotations

from typing import TypeVar

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.db.base import Base

ModelT = TypeVar("ModelT", bound=Base)


def get_or_404(
    db: Session,
    model: type[ModelT],
    pk: object,
    label: str | None = None,
) -> ModelT:
    """Load a row by primary key, or raise a 404 naming the resource.

    `label` defaults to the model's class name, so `get_or_404(db, User, uid)`
    produces "User not found" — the message four of the five call sites already
    used. Pass it explicitly only when the model name is not what a user should
    read.

    Returns the ORM object; the router's `response_model` serialises it
    (`FASTAPI_STANDARDS.md` § 3).

    This is also the seam for row-level scoping (PM-5). When a partner may only
    read its own rows, the check belongs here — one function, rather than
    remembered at every `db.get()` in the codebase. It is not implemented yet;
    do not assume this function authorises anything today.
    """
    obj = db.get(model, pk)
    if obj is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, f"{label or model.__name__} not found"
        )
    return obj
