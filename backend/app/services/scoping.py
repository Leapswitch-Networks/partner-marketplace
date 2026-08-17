"""Row-level scoping — **PM-5**, and the one place a mistake is a data breach.

`MARKETPLACE_DOMAIN_PLAN.md` § Row-Level Scoping rule 1: *"never write
`where(organisation_id == ...)` in a service."* That rule has been right and
unenforceable since it was written, because the module it names did not exist.
This is it.

## The three rules it encodes

**1. Anonymous is the most restrictive branch BY CONSTRUCTION.**
`PARTNER_DIRECTORY_PLAN.md` § 7 warned that the obvious `if actor is None:
return stmt` would serve unfiltered rows to the internet. Here the default for
every principal that is not a scoped human is `false()` — a model must *opt in*
to being publicly visible by registering a `public_predicate`, and a model that
registers nothing is invisible to anonymous callers. Forgetting to think about
the public case fails closed.

**2. 404, never 403.** A 403 confirms the row exists. In a directory that tells
one partner a competitor is on the platform before it is published, so
`assert_can_read` raises `404` with a generic message for both "no such row" and
"not yours".

**3. The filter reaches SQL.** Post-filtering a page corrupts the count: the
caller is told there are 40 rows and handed 12 (`FASTAPI_STANDARDS.md` § 12).
`apply_scope` returns a modified `Select`, so `run_list` counts what it returns.

## What "owns" a row

A model registers **one column** holding the owning organisation's id. Two
shapes exist and both are ordinary:

    register_scope(Listing, owner_column=Listing.organisation_id)
    register_scope(Partner, owner_column=Partner.id)   # a partner IS the org

The second is not a special case — the organisation's own row is owned by the
organisation, and its id column is where that id lives.

## Why registration rather than a mixin or a naming convention

A convention ("any model with an `organisation_id` is scoped") fails silently in
the direction that matters: add a table, forget the column, and it is unscoped
with nothing to notice. Registration is explicit, and `scoped_models()` lets a
test enumerate what is covered — which is how you find the table nobody scoped.

Registration lives with the model's own service (`partner_service` registers
`Partner`), not here. This module names no domain model, and
`tests/test_core_extraction.py` keeps it that way.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, TypeVar

from fastapi import HTTPException, status
from sqlalchemy import ColumnElement, Select, false
from sqlalchemy.orm import InstrumentedAttribute

from app.core.principal import Principal, UserPrincipal, for_user
from app.models.user import User

T = TypeVar("T")

#: The 404 every refusal answers with. One instance, one message: two different
#: wordings for "not found" and "not yours" would reintroduce exactly the
#: disclosure the single status code exists to prevent.
NOT_FOUND = HTTPException(status.HTTP_404_NOT_FOUND, "Not found")


@dataclass(frozen=True)
class Scope:
    """How one model answers "who owns this row, and what may the public see"."""

    #: Column holding the owning organisation's id.
    owner_column: InstrumentedAttribute

    #: What an ANONYMOUS caller may see, or `None` for "nothing".
    #:
    #: `None` is the default and the safe answer. A model becomes publicly
    #: readable only by naming the predicate that makes a row public — for the
    #: directory that is `is_listed AND status == ACTIVE`, which is two
    #: conditions precisely because either alone would publish the wrong rows.
    public_predicate: ColumnElement[bool] | None = None


_SCOPES: dict[type, Scope] = {}


def register_scope(
    model: type,
    *,
    owner_column: InstrumentedAttribute,
    public_predicate: ColumnElement[bool] | None = None,
) -> None:
    """Declare how `model` is owned. Called once, at import, by its own service."""
    if model in _SCOPES:
        raise ValueError(f"{model.__name__} already has a scope registered.")
    _SCOPES[model] = Scope(owner_column=owner_column, public_predicate=public_predicate)


def scoped_models() -> dict[type, Scope]:
    """Every registered model. Used by tests to enumerate what is covered."""
    return dict(_SCOPES)


def scope_for(model: type) -> Scope:
    """The registered scope, or a loud failure.

    **Raises rather than returning an unscoped statement.** A missing
    registration is a programming error, and the safe behaviour for a
    programming error in this module is to refuse to run — returning `stmt`
    unchanged would serve every row and look like it worked.
    """
    try:
        return _SCOPES[model]
    except KeyError:
        raise LookupError(
            f"{model.__name__} has no scope registered. Call scoping.register_scope() "
            "in its service module before scoping a query against it."
        ) from None


def reset_for_tests() -> None:
    """Empty the registry. **Tests only** — see `core/registry.reset_for_tests`."""
    _SCOPES.clear()


# --- Reads -------------------------------------------------------------------


def _as_principal(actor: Principal | User | None) -> Principal:
    """Accept a `User`, a `Principal`, or `None`.

    The stack is still overwhelmingly typed `actor: User` — 258 signatures as of
    2026-08-17 — and blanket-retyping them onto `Principal` would make most of
    them *less* accurate, not more: `user_service.update_user` genuinely requires
    a human and reads `actor.id` and `actor.has_admin_access`. So the union is
    normalised at this boundary instead, which is the boundary that actually has
    to cope with anonymous and machine callers.
    """
    if actor is None:
        return for_user(None)
    if isinstance(actor, User):
        return for_user(actor)
    return actor


def apply_scope(stmt: Select, model: type, actor: Principal | User | None) -> Select:
    """Narrow `stmt` to the rows `actor` may see.

    The four branches, in the order they are decided:

    | Principal | Result |
    |---|---|
    | human with admin access | unchanged — they see every row |
    | human in an organisation | `owner_column == their organisation` |
    | human with no organisation | **nothing** (see below) |
    | machine or anonymous | the public predicate, or nothing |

    **A human with no organisation gets nothing, not everything.** They are an
    internal account without admin access, and scoping them on
    `organisation_id IS NULL` would match every unowned row. The conservative
    branch is the only safe reading, and it is the same choice `list_users`
    already makes for the same reason.
    """
    scope = scope_for(model)
    principal = _as_principal(actor)

    if isinstance(principal, UserPrincipal):
        user = principal.user
        if user.has_admin_access:
            return stmt
        if user.organisation_id is None:
            return stmt.where(false())
        return stmt.where(scope.owner_column == user.organisation_id)

    # Machine and anonymous share this branch deliberately. A token holder is not
    # a member of any organisation, so "what the public may see" is exactly the
    # right allowance for it too — and a machine that needs more must be given a
    # scope of its own rather than inheriting a human's.
    if scope.public_predicate is None:
        return stmt.where(false())
    return stmt.where(scope.public_predicate)


def can_read(obj: Any, model: type, actor: Principal | User | None) -> bool:
    """Whether `actor` may see this already-loaded row.

    Mirrors `apply_scope`'s branches exactly. Kept beside it rather than derived
    from it because the two answer different shapes — a `WHERE` clause and a
    boolean — and a clever shared implementation would make the security rule
    harder to read than to trust.
    """
    scope = scope_for(model)
    principal = _as_principal(actor)

    if isinstance(principal, UserPrincipal):
        user = principal.user
        if user.has_admin_access:
            return True
        if user.organisation_id is None:
            return False
        owner = getattr(obj, scope.owner_column.key)
        return owner == user.organisation_id

    return False


def assert_can_read(obj: Any, model: type, actor: Principal | User | None) -> None:
    """Raise `404` unless `actor` may see this row.

    **404 and not 403**, and the message says nothing. See rule 2 in the module
    docstring: a 403 is a confirmation that the row exists, and in a directory
    that is a disclosure about a competitor.
    """
    if not can_read(obj, model, actor):
        raise NOT_FOUND


__all__ = [
    "Scope",
    "register_scope",
    "scoped_models",
    "scope_for",
    "reset_for_tests",
    "apply_scope",
    "can_read",
    "assert_can_read",
    "NOT_FOUND",
]
