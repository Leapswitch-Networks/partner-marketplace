"""Schemas for the Data Access module — who may see or manage whose records.

The response is **flattened deliberately**. The reference's controller maps each
grant through a `userLabel()` helper that emits `{id, name, email}` for both
parties, and the table renders exactly those two fields per side. Returning the
full `UserResponse` for grantee, subject and granter instead would put three
complete user records — including status, roles and auth provider — on every row
of a 25-row page to render four strings.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import Page


class GrantParty(BaseModel):
    """One side of a grant, as the table renders it.

    Mirrors the reference's `userLabel()` — `{id, name, email}` and nothing more.
    """

    id: str
    name: str
    email: str


class DataAccessGrantResponse(BaseModel):
    id: str
    grantee: GrantParty
    subject: GrantParty
    scope: str
    #: Resolved through the scope catalogue so the table never renders a bare
    #: `*`. Falls back to the raw value for a scope the catalogue does not name,
    #: which is what a module slug added ahead of its catalogue entry looks like.
    scope_label: str
    access_level: str
    #: Null once the granting account is deleted — `granted_by` is `ON DELETE SET
    #: NULL`, because a grant outlives whoever handed it out.
    granted_by: str | None = None
    created_at: datetime


class DataAccessListResponse(Page[DataAccessGrantResponse]):
    """The standard page envelope, plus the reference's `canManage`.

    A subclass rather than a new shape: `Page[T]` stays the one envelope every
    index returns, the frontend's `useResourceList` reads `items`/`total`/`pages`
    unchanged, and `can_manage` rides along as an extra key it ignores.

    **Why it is on the list response at all**, when the client already knows its
    own permissions: the reference computes it server-side and the write controls
    are gated on it. Keeping that means one authority for "may I write here"
    rather than a client-side permission string that can drift from the router's
    guard — the guard below and this flag read the same constant.
    """

    can_manage: bool


class ScopeOption(BaseModel):
    """One entry in the scope catalogue, shaped for a `<Select>`."""

    value: str
    label: str


class GrantUserOption(BaseModel):
    """An ACTIVE user, for the grantee and subject pickers."""

    id: str
    name: str
    email: str


class DataAccessOptionsResponse(BaseModel):
    """Everything the create form needs, in one request.

    The reference ships `users` and `scopes` alongside the grants in a single
    Inertia payload. We cannot: our index is a paged JSON endpoint that refetches
    on every filter keystroke, and re-sending the whole ACTIVE user list with each
    page would be the dominant cost of the screen. Split into its own route,
    fetched once on mount — the same split the Users module already makes for
    roles.
    """

    users: list[GrantUserOption]
    scopes: list[ScopeOption]


class CreateDataAccessRequest(BaseModel):
    """One grantee, many subjects — the reference's shape, verbatim.

    `subject_ids` is a list because the screen's job is "give Priya access to
    these five people", and issuing that as five requests would make a partial
    failure look like a total one. Each pair is upserted on the unique triple, so
    re-granting changes the level rather than erroring.
    """

    grantee_id: str
    subject_ids: list[str] = Field(min_length=1)
    scope: str
    access_level: str


class CreateDataAccessResult(BaseModel):
    """What the batch did.

    `created` counts pairs written **or updated** — the endpoint upserts, and the
    reference's own flash message counts the same way ("Data access updated for N
    user(s)"). `skipped` carries the self-grant pairs the reference silently
    `continue`s past; saying so is the one place the message is more honest than
    the original, and it costs nothing.
    """

    created: int
    skipped: int = 0
    skipped_reasons: list[str] = Field(default_factory=list)
    message: str
