"""Delegated data access: whose records may this user see.

Ported in behaviour from the reference's `HasDataAccess` concern. The semantics
below were checked against that source line by line, because a mis-stated rule
here is a data leak rather than a bug.

## The three rules that are easy to get wrong

1. **Fail closed, and never empty.** `accessible_user_ids` seeds its result with
   the caller's own id *before* consulting any grant, so a user with no grants
   gets `[self]` — not `[]`. That distinction is the whole safety property: an
   empty list read as "no restriction" by a caller would widen a query to
   everything, which is the exact inversion of what this module is for.

2. **`manage` is not a superset of `view` in the filter.** Asking for `view`
   accepts both levels. Asking for `manage` accepts **only** grants stored as
   `manage` — string equality, not a hierarchy. Two values do not need an
   ordering, and inventing one changes who can write.

3. **`manageable_user_ids` returns `[]` for a non-delegate**, not `[self]`.
   Because the list always contains self, `len > 1` is precisely "holds a manage
   grant over at least one other person". Returning `[self]` instead would tell
   every ordinary user they may administer their own records — which is a
   different claim, and one no caller asked about.

## What this module does NOT do

**It injects no query.** There is no global filter and no automatic scoping;
`narrow_to_creators` has to be called by each read that should respect
delegation. That is the reference's design, and its real cost is worth naming: a
module that never calls it has no data-access enforcement at all. The resolver is
fail-closed; the *system* is not, because nothing forces the call.

The mitigation is that PM-5 will attach this at the `get_or_404` and `run_list`
seams so new modules inherit it. Until then, every consumer is a deliberate call
site and this docstring is the reason it must be.

## Composition with tenant scoping (PM-5)

They are complementary and must compose with AND. Data Access answers *whose
records* (creator-based, user to user); PM-5 answers *which tenant*
(organisation-based). **Tenant scoping applies first and unconditionally** — a
grant may only ever widen visibility *within* a tenant, never across one. Both
are `Select -> Select`, so they chain.
"""

from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session, aliased

from app.core.crud import get_or_404
from app.core.query import ListParams, ListSpec, run_list
from app.models.data_access_grant import SCOPE_ALL, DataAccessGrant
from app.models.user import User
from app.services import activity_service, recycle_bin_service

LEVEL_VIEW = "view"
LEVEL_MANAGE = "manage"


def _scope_applies(grant_scope: str, requested: str | None) -> bool:
    """Does a stored grant cover the scope being asked about?

    A `*` grant matches everything, **including modules that do not exist yet**.
    That forward extension is the feature rather than an oversight: an
    organisation that granted "all modules" last year should not silently lose
    coverage the day a new module ships.

    A `None` request means "wildcard grants only" — a grant naming a specific
    module matches neither `None` nor `*`. The reference types this parameter as
    nullable for the same reason, and a port that makes it a required string
    quietly drops the behaviour.
    """
    if grant_scope == SCOPE_ALL:
        return True
    if requested is None:
        return False
    return grant_scope == requested


def accessible_user_ids(
    db: Session,
    actor: User,
    scope: str | None = None,
    level: str = LEVEL_VIEW,
) -> list[str]:
    """User ids whose records `actor` may reach at `level`.

    **Always contains `actor.id`, always non-empty.** See rule 1 above.

    One query regardless of how many scopes a caller asks about — the grants are
    loaded once and filtered in Python. Grants per user are single digits, so
    pushing the scope/level predicate into SQL would cost a round trip per
    distinct pair asked for in one request and buy nothing.
    """
    ids = [actor.id]

    # `deleted_at IS NULL` is the whole point of the filter here: a grant sitting
    # in the recycle bin must not still grant anything. Without this line,
    # revoking access would mean "hide the grant from the admin screen" while it
    # kept working — a silent privilege leak, and the worst possible one to have,
    # because the screen would show it as revoked.
    grants = db.scalars(
        select(DataAccessGrant).where(
            DataAccessGrant.grantee_id == actor.id,
            DataAccessGrant.deleted_at.is_(None),
        )
    ).all()

    for grant in grants:
        if not _scope_applies(grant.scope, scope):
            continue
        # Rule 2: `manage` is matched exactly, not as "at least view".
        if level == LEVEL_MANAGE and grant.access_level != LEVEL_MANAGE:
            continue
        if grant.subject_id not in ids:
            ids.append(grant.subject_id)

    return ids


def manageable_user_ids(
    db: Session, actor: User, scope: str | None = None
) -> list[str]:
    """User ids whose records `actor` may WRITE, or `[]` if they are not a delegate.

    Rule 3. The `len > 1` gate is the subtlest line in this module: the list
    always contains self, so more than one entry means "has a manage grant over
    someone else". A non-delegate gets an empty list rather than `[self]`.

    Note the deliberate consequence, which is the reference's and not ours to
    invent away: holding a manage grant over **one** colleague also puts your own
    id in the returned list, so it confers self-administration. Diverging would
    make a manage grant mean two different things in the two systems.
    """
    ids = accessible_user_ids(db, actor, scope, LEVEL_MANAGE)
    return ids if len(ids) > 1 else []


def can_manage_data_of(
    db: Session, actor: User, target_user_id: str | None, scope: str | None = None
) -> bool:
    """May `actor` write records created by `target_user_id`?

    Returns False for a null target rather than treating it as "anyone". That
    guard matters more here than in the reference: `created_by` is nullable on
    several of our tables, so a system-created row would otherwise be writable by
    whoever asked first.
    """
    if target_user_id is None:
        return False
    manageable = manageable_user_ids(db, actor, scope)
    return bool(manageable) and target_user_id in manageable


def narrow_to_creators(
    stmt: Select,
    creator_column,
    db: Session,
    actor: User,
    scope: str | None = None,
    level: str = LEVEL_VIEW,
) -> Select:
    """Restrict a query to rows created by users the actor may reach.

    **Admin access returns the statement unmodified.** `has_admin_access`
    (RootUser, SuperAdmin, Admin) means "sees all data" and is checked first, the
    same short-circuit the reference expects each caller to write by hand. Having
    it as a first-class property is one place our version is less error-prone
    than the original — there, forgetting the check silently narrows an admin's
    view instead of widening it.

    Everyone else is narrowed to `accessible_user_ids`, which for a user with no
    grants is exactly their own id.
    """
    if actor.has_admin_access:
        return stmt
    return stmt.where(creator_column.in_(accessible_user_ids(db, actor, scope, level)))


# --- Grant administration ----------------------------------------------------


_LIST_SPEC = ListSpec(
    sortable={
        "created_at": DataAccessGrant.created_at,
        "scope": DataAccessGrant.scope,
        "access_level": DataAccessGrant.access_level,
    },
    default_sort="created_at",
    tiebreak=DataAccessGrant.id,
)


def _name_or_email_matches(alias, term: str):
    """One party's name/email against a lowered `%term%`.

    `CONCAT(first_name, ' ', last_name)` is matched in addition to the two
    columns separately, not instead of them — that is what makes searching
    "jane smith" find a row that neither column contains on its own. Ported from
    the reference's `orWhereRaw("CONCAT(first_name, ' ', last_name) LIKE ?")`.
    """
    return or_(
        func.lower(alias.first_name).like(term),
        func.lower(alias.last_name).like(term),
        func.lower(alias.email).like(term),
        func.lower(func.concat(alias.first_name, " ", alias.last_name)).like(term),
    )


def list_grants(
    db: Session,
    *,
    search: str | None = None,
    grantee_id: str | None = None,
    subject_id: str | None = None,
    scope: str | None = None,
    access_level: str | None = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    page: int = 1,
    per_page: int = 25,
) -> tuple[list[DataAccessGrant], int]:
    """Every grant, searchable and filterable by either party.

    **Not scoped to the caller**, matching the reference — any holder of
    `data-access-view` sees the whole delegation graph. That is defensible only
    while the permission is narrowly held, and ours is not narrowly held: Staff
    has `data-access-view`. Flagged in DAILY_CHANGES (2026-08-13) and PM-5
    rather than silently diverged, because scoping it is a visible behaviour
    change and the owner's call. This sentence claimed that flag for a month
    before the § 8.2 sweep noticed nobody had written it — the flag now exists.

    ## Why the search is built here and not by `ListSpec.searchable`

    `apply_search` ORs simple columns on the statement it is given. This search
    spans **two different rows of the same table** — the grantee and the subject
    — so it needs two aliased joins, which is precisely the case
    `core/query.py`'s docstring assigns to the caller. Passing these columns as
    `searchable` would search whichever `users` row the eager load happened to
    join, which is not a thing anyone asked for.

    The joins are `INNER`, and that is safe rather than lossy: both FKs are
    `nullable=False` with `ON DELETE CASCADE`, so a grant whose grantee or
    subject is gone does not exist to be dropped.
    """
    grantee_user = aliased(User)
    subject_user = aliased(User)

    stmt: Select = (
        select(DataAccessGrant)
        .join(grantee_user, DataAccessGrant.grantee_id == grantee_user.id)
        .join(subject_user, DataAccessGrant.subject_id == subject_user.id)
        .where(DataAccessGrant.deleted_at.is_(None))
    )

    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        stmt = stmt.where(
            or_(
                _name_or_email_matches(grantee_user, term),
                _name_or_email_matches(subject_user, term),
            )
        )

    if grantee_id:
        stmt = stmt.where(DataAccessGrant.grantee_id == grantee_id)
    if subject_id:
        stmt = stmt.where(DataAccessGrant.subject_id == subject_id)
    if scope:
        stmt = stmt.where(DataAccessGrant.scope == scope)
    if access_level:
        stmt = stmt.where(DataAccessGrant.access_level == access_level)

    # `search` is deliberately NOT forwarded to `ListParams`: it has already been
    # applied above, and `_LIST_SPEC.searchable` is empty, so passing it would be
    # a no-op that reads as though the spec were doing the work.
    return run_list(
        db,
        stmt,
        _LIST_SPEC,
        ListParams(page=page, per_page=per_page, sort_by=sort_by, sort_order=sort_order),
    )


def list_active_users(db: Session) -> list[User]:
    """Candidates for the grantee and subject pickers.

    ACTIVE only, matching the reference's `where('status', 'ACTIVE')`. It is not
    merely cosmetic here: `create_grant` refuses a non-ACTIVE party outright, so
    offering one would build a picker whose selections the API rejects.
    """
    return list(
        db.scalars(
            select(User).where(User.status == "ACTIVE").order_by(User.first_name.asc())
        ).unique()
    )


def _require_active_user(db: Session, user_id: str, label: str) -> User:
    """Both parties must exist and be ACTIVE.

    The reference validates only `exists:users,id`, so a crafted POST can grant
    to or over a suspended account — its own UI never offers one, which is what
    hid it. That is a defect rather than behaviour, and nothing a user can see
    depends on it, so we diverge.
    """
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"{label} not found")
    if user.status != "ACTIVE":
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"{label} is not an active account, so it cannot take part in a grant.",
        )
    return user


def create_grant(
    db: Session,
    *,
    grantee_id: str,
    subject_id: str,
    scope: str,
    access_level: str,
    actor: User,
) -> DataAccessGrant:
    """Grant `grantee_id` access to records created by `subject_id`.

    ## The escalation this refuses

    **You cannot grant access to yourself.** Blocking only
    `grantee_id == subject_id` — the reference's check, and the obvious one —
    leaves the dangerous case open: an actor sets `grantee_id` to their OWN id,
    `subject_id` to anyone, `scope='*'`, `access_level='manage'`, and one request
    self-elevates them to seeing and writing every user's records.

    "Only administrators hold `data-access-manage`" is not a defence, because it
    is data rather than a control. `has_admin_access` is derived from role
    **names** (RootUser / SuperAdmin / Admin) while this route is gated on a
    **permission** — so a custom role created in the Roles UI can hold
    `data-access-manage` without being an admin, and the two sets diverge the
    moment someone uses that screen. The guard has to be here.

    Administrators are refused too. They already see everything through
    `has_admin_access`, so a self-grant would buy them nothing and the exception
    would only weaken the rule.
    """
    if grantee_id == subject_id:
        # Verbatim from the reference — user-visible copy.
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "A user cannot be granted access to their own records.",
        )

    if grantee_id == actor.id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "You cannot grant data access to yourself. Ask another administrator.",
        )

    if access_level not in (LEVEL_VIEW, LEVEL_MANAGE):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "Access level must be view or manage."
        )

    _require_active_user(db, grantee_id, "The grantee")
    _require_active_user(db, subject_id, "The subject")

    # Upsert on the unique triple, matching the reference's updateOrCreate: an
    # admin re-submitting the same pair changes the level rather than hitting a
    # constraint error. The level change is audited below precisely BECAUSE a
    # re-grant can silently escalate view -> manage.
    # Deliberately does NOT filter `deleted_at`: the unique constraint on
    # (grantee, subject, scope) still covers a binned row, so re-granting has to
    # find it and revive it rather than insert a duplicate that the database
    # would reject. Same reasoning as `auth_service.email_exists`.
    existing = db.scalar(
        select(DataAccessGrant)
        .where(DataAccessGrant.grantee_id == grantee_id)
        .where(DataAccessGrant.subject_id == subject_id)
        .where(DataAccessGrant.scope == scope)
    )

    if existing is not None:
        previous = existing.access_level
        was_binned = existing.deleted_at is not None
        existing.access_level = access_level
        existing.granted_by = actor.id
        # Revive it if it was in the recycle bin. Without this line the row is
        # updated but stays `deleted_at`-stamped, so the admin is told the grant
        # was made, the screen shows it, and it grants nothing — the failure mode
        # is a permission that silently does not exist.
        existing.deleted_at = None
        db.commit()
        db.refresh(existing)
        if previous != access_level:
            activity_service.record(
                db,
                description=(
                    f"Changed data access for {existing.grantee.email} over "
                    f"{existing.subject.email} from {previous} to {access_level}"
                ),
                event="data_access_changed",
                subject_type="DataAccessGrant",
                subject_id=existing.id,
                actor=actor,
                properties={"old": {"access_level": previous},
                            "attributes": {"access_level": access_level},
                            "restored": was_binned},
            )
        elif was_binned:
            # Same level, but the row came back from the bin: a revoked grant
            # started granting again, which is a grant in every way that
            # matters. Until this branch the trail said the grant ended at the
            # revocation, while the access quietly resumed.
            activity_service.record(
                db,
                description=(
                    f"Restored {existing.grantee.email}'s {access_level} access to "
                    f"{existing.subject.email}'s records ({scope})"
                ),
                event="data_access_granted",
                subject_type="DataAccessGrant",
                subject_id=existing.id,
                actor=actor,
                properties={"attributes": {"access_level": access_level,
                                           "scope": scope},
                            "restored": True},
            )
        return existing

    grant = DataAccessGrant(
        grantee_id=grantee_id,
        subject_id=subject_id,
        scope=scope,
        access_level=access_level,
        granted_by=actor.id,
    )
    db.add(grant)
    db.commit()
    db.refresh(grant)

    activity_service.record(
        db,
        description=(
            f"Granted {grant.grantee.email} {access_level} access to "
            f"{grant.subject.email}'s records ({scope})"
        ),
        event="data_access_granted",
        subject_type="DataAccessGrant",
        subject_id=grant.id,
        actor=actor,
        properties={
            "grantee": grant.grantee.email,
            "subject": grant.subject.email,
            "scope": scope,
            "access_level": access_level,
        },
    )
    return grant


def delete_grant(db: Session, grant_id: str, actor: User) -> None:
    """Revoke a grant.

    No ownership check, matching the reference: any holder of
    `data-access-manage` may revoke any grant, including ones they did not
    create. Revoking is the safe direction — it can only ever narrow access — so
    a relationship requirement would add friction without closing anything.
    """
    grant = get_or_404(db, DataAccessGrant, grant_id, "Data access grant")

    description = (
        f"Revoked {grant.grantee.email}'s {grant.access_level} access to "
        f"{grant.subject.email}'s records ({grant.scope})"
    )
    properties = {
        "grantee": grant.grantee.email,
        "subject": grant.subject.email,
        "scope": grant.scope,
        "access_level": grant.access_level,
    }

    recycle_bin_service.soft_delete(grant)
    db.commit()

    # Recorded AFTER the delete, with a snapshot: once the row is gone, an entry
    # saying only "revoked grant #7" answers nothing later.
    activity_service.record(
        db,
        description=description,
        event="data_access_revoked",
        subject_type="DataAccessGrant",
        subject_id=grant_id,
        actor=actor,
        properties={"old": properties},
    )
