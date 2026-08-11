"""Global search over admin-configured entity types.

Port of LeapDesk's `GlobalSearchService` + `GlobalSearchRegistry` (Module 8).
The feature is small; **the security is the module**, and it is unusual in one
specific way that governs every decision below:

> The rows in `searchable_entities` name a **model** and a **set of columns**,
> and an administrator can edit them from a web form.

So this file treats every string coming out of that table as hostile input, not
as configuration. Three layers, in the order the plan specifies:

## L1 — entity permission

`searchable_entities.permission` gates whether a type is searched **at all**.
`NULL` means any signed-in user. `User.has_permission` already returns True for
super admins, which reproduces the reference's `$isSuperAdmin` bypass without a
second code path.

**This layer is not sufficient on its own and must never be mistaken for
scoping.** Holding `user-view` does not mean seeing every user — see L3.

## L2 — model allowlist

`model_class` holds a **name** (`"User"`), resolved against `_REGISTRY`, a dict
literal in this file. A name that is not a key resolves to nothing and the type
is skipped.

**There is no `importlib`, no `__import__`, no `eval`, and no `getattr` on a
module anywhere in this module.** A row saying `model_class = "os"` or
`"app.core.config"` must resolve to nothing rather than import anything, and the
only way to guarantee that is for the lookup to be a dict membership test. The
reference states the same rule for Recycle Bin — *"a raw string from the request
is never resolved to a class name"* — and it binds harder here, because this
string arrives from a database row rather than from a request.

## L3 — field allowlist, and row scoping

`fields` is a JSON array of column names. Each is checked against the resolved
model's **mapped columns** and dropped if unknown; what reaches SQLAlchemy is a
`Column` object, never a name interpolated into SQL text.

And separately from all three: **results are row-scoped.** Each registry entry
carries the same visibility rule the module's own list endpoint applies, so
search cannot become a way to enumerate records a user cannot list.
"""

from __future__ import annotations

import logging
import re
import time
from collections.abc import Callable
from dataclasses import dataclass

from fastapi import HTTPException, status
from sqlalchemy import Select, inspect, or_, select
from sqlalchemy.orm import Session

from app.core.crud import get_or_404
from app.core.query import ListParams, ListSpec, run_list
from app.models.role import Role
from app.models.searchable_entity import SearchableEntity, SearchLog
from app.models.user import User
from app.services import activity_service, recycle_bin_service
logger = logging.getLogger("app.search")

EVENT_ENTITY_CREATED = "search_entity_created"
EVENT_ENTITY_UPDATED = "search_entity_updated"
EVENT_ENTITY_TOGGLED = "search_entity_toggled"
EVENT_ENTITY_DELETED = "search_entity_deleted"

_SUBJECT = "SearchableEntity"

#: Below this, a search is not run at all. The reference's rule, and a real one:
#: one character matches most of the table and the result is noise.
MIN_QUERY_LENGTH = 2

#: Per-entity cap the client may ask for.
DEFAULT_PER_ENTITY = 5
MAX_PER_ENTITY = 20

#: Hard ceiling across every group in one response, whatever the per-entity
#: limit and however many types are configured. A query matching everything must
#: not return everything — without this, adding entity types silently raises the
#: cost of a single request.
MAX_TOTAL_RESULTS = 50

#: Only these placeholders are recognised in a template. Matches the reference's
#: `/\{([a-zA-Z0-9_.]+)\}/`.
_TEMPLATE_TOKEN = re.compile(r"\{([a-zA-Z0-9_.]+)\}")


# --- L2: the model allowlist -------------------------------------------------


ScopeFn = Callable[[Select, Session, User], Select]


def _scope_users(stmt: Select, db: Session, actor: User) -> Select:
    """Row scoping for `User`, identical to `user_service.list_users`.

    An actor without admin access sees **only their own record**. That is the
    conservative default the users module already applies, and search has to
    apply the same one or it becomes a way to enumerate accounts that the list
    endpoint refuses to show.

    Deliberately re-stated here rather than imported: `list_users` builds a whole
    paginated query, and calling it would drag its filters and its `ListSpec`
    into a search path that needs neither. The rule is one line; the risk is that
    the two drift, so this comment names the file to change with it.
    """
    if not actor.has_admin_access:
        return stmt.where(User.id == actor.id)
    return stmt


def _scope_roles(stmt: Select, db: Session, actor: User) -> Select:
    """Row scoping for `Role` — none, and that is a decision rather than an omission.

    Roles are global reference data with no owner and no tenant: every role is
    visible to everyone who may list roles at all, which is what
    `rbac_service.list_roles` does today (it takes no actor). The `role-view`
    gate on the entity row is therefore the whole access rule for this type, and
    L1 is genuinely sufficient here in a way it is not for `User`.

    If roles ever become partner-scoped, this function is where that goes.
    """
    return stmt


@dataclass(frozen=True)
class RegisteredModel:
    """One model the search is permitted to touch.

    Membership of `_REGISTRY` is the entire authority for whether a
    `model_class` string is resolvable. Adding a key here is a code change and a
    review; adding a `searchable_entities` row is not.
    """

    model: type
    #: Applied to every search statement for this type. A model with no scoping
    #: rule must still declare one explicitly, so that "unscoped" is a decision
    #: someone wrote rather than a field nobody filled in.
    scope: ScopeFn


#: The allowlist. **`model_class` is looked up here and nowhere else.**
#:
#: The parity plan settles the initial registry as `User` and `Role` — LeapDesk's
#: Core group — with marketplace entities joining later, which is the
#: extensibility the config table buys.
#:
#: `Partner` is deliberately **absent**. It exists as a model, but there is no
#: tenant scoping yet (TECH_DEBT PM-5), so there is no rule that would stop one
#: partner's staff finding another partner's record through the search box.
#: Adding the row without the scoping is exactly the "type-gated but not
#: row-scoped" failure this module is supposed to prevent, so it waits for PM-5.
_REGISTRY: dict[str, RegisteredModel] = {
    "User": RegisteredModel(model=User, scope=_scope_users),
    "Role": RegisteredModel(model=Role, scope=_scope_roles),
}


def registered_model_names() -> list[str]:
    """The names an administrator may legally put in `model_class`.

    Exposed so the settings form can offer a dropdown rather than a free-text
    box. The API still validates against `_REGISTRY` on write — a form is a
    convenience, never the check.
    """
    return sorted(_REGISTRY)


def resolve_model(model_class: str) -> RegisteredModel | None:
    """L2. A dict lookup, and nothing else.

    Returns `None` for anything not on the allowlist — including `"os"`,
    `"app.core.config"`, a dotted path, or an empty string. Nothing is imported,
    and no attribute is read off a module.
    """
    return _REGISTRY.get(model_class)


# --- L3: the field allowlist -------------------------------------------------


#: Column names that may never be searched or rendered, whatever a registry row
#: says.
#:
#: **"Is it a real column" is necessary and not sufficient**, and that gap is not
#: theoretical here. `User` maps `password`, `password_reset_token`,
#: `password_otp`, `two_factor_secret` and `two_factor_recovery_codes`. With only
#: the mapped-column check, an administrator could set
#: `fields: ["password_reset_token"]` and turn the search box into an **oracle** —
#: paste a token, learn whose account it belongs to — or set
#: `display_template: "{two_factor_secret}"` and have the value printed into
#: results. Neither requires a code change, and neither looks wrong on the
#: settings screen.
#:
#: The reference has no equivalent check: its `fields` feed a Scout index, and
#: nobody indexed a credential, so the hole never opened. Ours is a deliberate
#: divergence rather than an oversight — matched by name, so a column added later
#: is covered without anyone remembering to extend a list.
_SENSITIVE_COLUMN = re.compile(
    r"password|passwd|secret|token|otp|recovery_code|api[_-]?key|hash|salt|signature|credential",
    re.IGNORECASE,
)


def is_sensitive_column(name: str) -> bool:
    """Is this column credential material that must never reach a search result?"""
    return bool(_SENSITIVE_COLUMN.search(name))


def mapped_column_names(model: type) -> set[str]:
    """Column names actually mapped on a model.

    `inspect(...).columns` reflects the mapping, so this cannot drift from the
    model the way a hand-kept list would.
    """
    return {c.key for c in inspect(model).mapper.columns}


def searchable_column_names(model: type) -> set[str]:
    """Mapped columns minus the sensitive ones — the real reachable set.

    Used by both the field allowlist and the template attribute dict, so the two
    cannot disagree about what a registry row is permitted to read.
    """
    return {name for name in mapped_column_names(model) if not is_sensitive_column(name)}


def allowed_fields(model: type, fields: list[str] | None) -> list[str]:
    """Drop every configured field that is unknown **or sensitive**.

    Dropped rather than rejected, matching the reference's tolerance for a
    registry row that has drifted from the schema: a renamed column should
    narrow the search, not 500 the search box for everyone. The settings screen
    surfaces the same information as a health warning, which is where an
    administrator can act on it.
    """
    if not fields:
        return []
    known = searchable_column_names(model)
    return [f for f in fields if f in known]


# --- Template rendering ------------------------------------------------------


def render_template(template: str, attrs: dict[str, object]) -> str:
    """Substitute `{field}` placeholders from a row's attributes.

    A placeholder naming something absent renders as **empty**, never as the
    literal `{field}` — a result reading "Jane {last_name}" looks like a broken
    product, and one reading "{first_name} {last_name}" looks like a broken
    database.

    Only keys present in `attrs` are substituted, and `attrs` is built from the
    model's mapped columns, so a template cannot reach a method, a relationship
    or a private attribute by naming it.
    """

    def replace(match: re.Match[str]) -> str:
        value = attrs.get(match.group(1))
        return "" if value is None else str(value)

    return _TEMPLATE_TOKEN.sub(replace, template).strip()


def _row_attrs(row: object, model: type) -> dict[str, object]:
    """A row as a plain dict of the columns a template may read.

    **Sensitive columns are excluded here, not just from `fields`.** The two are
    separate holes: `fields` decides what is *matched*, `display_template`
    decides what is *printed*, and a template naming `{two_factor_secret}` would
    disclose it directly without ever appearing in the search terms.

    Mapped, non-sensitive columns only. The reference renders from Eloquent's
    `toArray()`, which also exposes appended accessors; ours is deliberately
    narrower, because the template string is admin-editable and this is the
    boundary that decides what it can reach.
    """
    return {name: getattr(row, name, None) for name in searchable_column_names(model)}


def _build_url(entity: SearchableEntity, attrs: dict[str, object]) -> str | None:
    """Fill the route template's placeholder, or return None to drop the hit.

    The reference's `safeRoute` returns null for a route that does not resolve
    and the hit is skipped rather than the request failing. Ours cannot check
    that a Next.js path exists, so it checks the one thing it can: that the
    parameter field is a real column with a non-null value.
    """
    param_field = entity.route_param_field or "id"
    value = attrs.get(param_field)
    if value is None:
        return None
    url = entity.route_name.replace(f"{{{param_field}}}", str(value))
    # A template whose placeholder did not match leaves braces behind. That is a
    # misconfigured row, and a link to a literal `/dashboard/users/{id}` is worse
    # than no link.
    if "{" in url or "}" in url:
        return None
    return url


# --- The search itself -------------------------------------------------------


def enabled_entities(db: Session) -> list[SearchableEntity]:
    """Configured types, in the order the admin set."""
    return list(
        db.scalars(
            select(SearchableEntity)
            .where(SearchableEntity.deleted_at.is_(None))
            .where(SearchableEntity.enabled.is_(True))
            .order_by(SearchableEntity.sort_order.asc(), SearchableEntity.label.asc())
        )
    )


def search(
    db: Session, actor: User, query: str, per_entity: int = DEFAULT_PER_ENTITY
) -> list[dict]:
    """Grouped, permission-filtered, row-scoped results.

    Returns `[]` for a query under `MIN_QUERY_LENGTH`, before touching the
    database or the registry.
    """
    query = (query or "").strip()
    if len(query) < MIN_QUERY_LENGTH:
        return []

    per_entity = max(1, min(per_entity, MAX_PER_ENTITY))
    term = f"%{query.lower()}%"

    groups: list[dict] = []
    total = 0

    for entity in enabled_entities(db):
        if total >= MAX_TOTAL_RESULTS:
            break

        # --- L1: entity permission -------------------------------------------
        # `has_permission` returns True for super admins, which is the
        # reference's bypass without a second branch.
        if entity.permission and not actor.has_permission(entity.permission):
            continue

        # --- L2: model allowlist ---------------------------------------------
        registered = resolve_model(entity.model_class)
        if registered is None:
            # A row naming an unknown model is skipped, not fatal — and nothing
            # about the string was executed to find that out.
            logger.warning(
                "search: skipping entity %s — model_class %r is not on the allowlist",
                entity.id,
                entity.model_class,
            )
            continue

        model = registered.model

        # --- L3: field allowlist ---------------------------------------------
        fields = allowed_fields(model, entity.fields)
        if not fields:
            logger.warning(
                "search: skipping entity %s — no configured field exists on %s",
                entity.id,
                entity.model_class,
            )
            continue

        columns = [inspect(model).mapper.columns[name] for name in fields]

        stmt: Select = select(model).where(
            # Column objects, never names spliced into SQL text.
            or_(*(col.ilike(term) for col in columns))
        )

        # --- Row scoping ------------------------------------------------------
        # Separate from all three layers and not optional: L1 said the actor may
        # search this *type*; this says which *rows* of it they may see.
        stmt = registered.scope(stmt, db, actor)

        # `per_entity * 2` then trimmed, the reference's rule: hits dropped for a
        # missing URL must not silently shrink a group below its limit.
        remaining = MAX_TOTAL_RESULTS - total
        fetch = min(per_entity * 2, max(remaining * 2, 2))
        try:
            rows = list(db.scalars(stmt.limit(fetch)).unique())
        except Exception:  # noqa: BLE001 - one bad entity must not 500 the box
            logger.exception("search: query failed for entity %s", entity.id)
            continue

        items: list[dict] = []
        for row in rows:
            attrs = _row_attrs(row, model)
            url = _build_url(entity, attrs)
            if url is None:
                continue

            items.append(
                {
                    "id": str(attrs.get("id")),
                    "title": render_template(entity.display_template, attrs)
                    or str(attrs.get("id")),
                    "subtitle": (
                        render_template(entity.subtitle_template, attrs)
                        if entity.subtitle_template
                        else None
                    )
                    or None,
                    "url": url,
                    "icon": entity.icon,
                }
            )
            if len(items) >= per_entity or total + len(items) >= MAX_TOTAL_RESULTS:
                break

        if items:
            total += len(items)
            groups.append(
                {
                    "group": entity.group,
                    "label": entity.label,
                    "icon": entity.icon,
                    "items": items,
                }
            )

    return groups


def log_search(
    db: Session,
    *,
    user_id: str | None,
    q: str,
    result_count: int,
    duration_ms: int,
    ip: str | None,
) -> None:
    """Record one search. **Never raises.**

    The reference defers this until after the response is flushed so logging
    cannot add latency. We are synchronous with no terminating hook, so it runs
    inline — which makes "never raises" the load-bearing part: a failure to write
    a product-signal row must not turn a working search into a 500.

    `q` is truncated to the column width rather than allowed to raise on a long
    query, and `ip` comes from `get_client_ip`, never from a header this code
    reads itself.
    """
    try:
        db.add(
            SearchLog(
                user_id=user_id,
                q=q[:255],
                result_count=result_count,
                duration_ms=duration_ms,
                ip=ip,
            )
        )
        db.commit()
    except Exception:  # noqa: BLE001
        logger.exception("search: could not write search_log")
        db.rollback()


def timed_search(
    db: Session,
    actor: User,
    query: str,
    per_entity: int,
    ip: str | None,
) -> tuple[list[dict], int]:
    """Run a search, log it, and return `(groups, duration_ms)`."""
    started = time.perf_counter()
    groups = search(db, actor, query, per_entity)
    duration_ms = int((time.perf_counter() - started) * 1000)

    cleaned = (query or "").strip()
    if len(cleaned) >= MIN_QUERY_LENGTH:
        # A query too short to run is not a search and would only add noise to
        # the zero-result signal this table exists to provide.
        log_search(
            db,
            user_id=actor.id,
            q=cleaned,
            result_count=sum(len(g["items"]) for g in groups),
            duration_ms=duration_ms,
            ip=ip,
        )

    return groups, duration_ms


# --- Admin CRUD over the registry --------------------------------------------


def entity_health(entity: SearchableEntity) -> tuple[str, list[str]]:
    """How usable a configured row actually is, and why.

    Parity with the reference's `healthFor`, which checks that the class exists,
    uses the searchable trait and that the route resolves. Ours checks what our
    stack can check: that the model is on the allowlist, and that its configured
    fields exist.

    Returned as `(status, reasons)` so the screen can say *what* is wrong rather
    than only colouring a badge.
    """
    reasons: list[str] = []

    registered = resolve_model(entity.model_class)
    if registered is None:
        reasons.append(
            f"“{entity.model_class}” is not a searchable model. "
            f"Allowed: {', '.join(registered_model_names())}."
        )
        return "broken", reasons

    configured = list(entity.fields or [])
    usable = allowed_fields(registered.model, configured)
    dropped = [f for f in configured if f not in usable]

    # Sensitive fields are called out separately from merely-unknown ones. They
    # are not a typo: someone configured a credential column, and "ignored an
    # unknown field" would understate that.
    sensitive = [f for f in dropped if is_sensitive_column(f)]
    unknown = [f for f in dropped if f not in sensitive]

    if sensitive:
        reasons.append(
            f"Refused sensitive field(s): {', '.join(sensitive)}. "
            "Credential columns are never searchable or displayable."
        )
    if unknown:
        reasons.append(f"Ignored unknown field(s): {', '.join(unknown)}.")

    if not usable:
        reasons.append("No usable field remains on this model.")
        return "broken", reasons

    param_field = entity.route_param_field or "id"
    if param_field not in searchable_column_names(registered.model):
        reasons.append(f"Route parameter “{param_field}” is not a column — links will be dropped.")
        return "broken", reasons
    if f"{{{param_field}}}" not in entity.route_name:
        reasons.append(f"Route “{entity.route_name}” has no {{{param_field}}} placeholder.")
        return "broken", reasons

    return ("degraded" if reasons else "ok"), reasons


_LIST_SPEC = ListSpec(
    sortable={
        "sort_order": SearchableEntity.sort_order,
        "label": SearchableEntity.label,
        "group": SearchableEntity.group,
        "model_class": SearchableEntity.model_class,
        "enabled": SearchableEntity.enabled,
        "created_at": SearchableEntity.created_at,
    },
    default_sort="sort_order",
    default_order="asc",
    tiebreak=SearchableEntity.id,
    searchable=(
        SearchableEntity.label,
        SearchableEntity.model_class,
        SearchableEntity.group,
        SearchableEntity.route_name,
        SearchableEntity.permission,
    ),
)


def list_entities(
    db: Session,
    *,
    search_term: str | None = None,
    group: str | None = None,
    enabled: bool | None = None,
    sort_by: str = "sort_order",
    sort_order: str = "asc",
    page: int = 1,
    per_page: int = 25,
) -> tuple[list[SearchableEntity], int]:
    # Binned entities are not listed and are not searched.
    stmt: Select = select(SearchableEntity).where(SearchableEntity.deleted_at.is_(None))
    if group:
        stmt = stmt.where(SearchableEntity.group == group)
    if enabled is not None:
        stmt = stmt.where(SearchableEntity.enabled.is_(enabled))

    return run_list(
        db,
        stmt,
        _LIST_SPEC,
        ListParams(
            page=page,
            per_page=per_page,
            sort_by=sort_by,
            sort_order=sort_order,
            search=search_term,
        ),
    )


def list_groups(db: Session) -> list[str]:
    """Distinct group names, for the filter dropdown."""
    return [
        g
        for (g,) in db.execute(
            select(SearchableEntity.group).distinct().order_by(SearchableEntity.group)
        ).all()
    ]


def get_entity(db: Session, entity_id: int) -> SearchableEntity:
    return get_or_404(db, SearchableEntity, entity_id, "Searchable entity")


def _validate_writable(db: Session, model_class: str, exclude_id: int | None = None) -> None:
    """Refuse a write that would create an unusable or duplicate row.

    **`model_class` is validated against the allowlist on write, not only on
    read.** Rejecting it here means an administrator finds out immediately
    instead of saving a row that silently never returns results — and it keeps
    the table's contents a subset of what the code already permits, rather than
    relying solely on the read path to ignore the rest.

    It is defence in depth, not the defence: `resolve_model` is still the
    authority at search time, because a row can predate this check or be written
    straight to the database.
    """
    if resolve_model(model_class) is None:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"“{model_class}” is not a searchable model. "
            f"Allowed: {', '.join(registered_model_names())}.",
        )

    # NOT filtered on `deleted_at` — `model_class` is UNIQUE, so a binned row
    # still reserves it and a create must find it rather than hit the
    # constraint. Same reasoning as `auth_service.email_exists`.
    stmt = select(SearchableEntity).where(SearchableEntity.model_class == model_class)
    if exclude_id is not None:
        stmt = stmt.where(SearchableEntity.id != exclude_id)
    if db.scalar(stmt) is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"“{model_class}” is already configured.",
        )


def _snapshot(entity: SearchableEntity) -> dict:
    return {
        "model_class": entity.model_class,
        "label": entity.label,
        "group": entity.group,
        "icon": entity.icon,
        "fields": list(entity.fields or []),
        "display_template": entity.display_template,
        "subtitle_template": entity.subtitle_template,
        "route_name": entity.route_name,
        "route_param_field": entity.route_param_field,
        "permission": entity.permission,
        "enabled": entity.enabled,
        "sort_order": entity.sort_order,
    }


def create_entity(db: Session, data: dict, actor: User) -> SearchableEntity:
    _validate_writable(db, data["model_class"])

    entity = SearchableEntity(**data, created_by=actor.id, updated_by=actor.id)
    db.add(entity)
    db.commit()
    db.refresh(entity)

    activity_service.record(
        db,
        description=f"Searchable entity “{entity.label}” created",
        event=EVENT_ENTITY_CREATED,
        subject_type=_SUBJECT,
        subject_id=str(entity.id),
        actor=actor,
        properties={"attributes": _snapshot(entity)},
    )
    return entity


def update_entity(db: Session, entity_id: int, data: dict, actor: User) -> SearchableEntity:
    entity = get_entity(db, entity_id)
    before = _snapshot(entity)

    _validate_writable(db, data["model_class"], exclude_id=entity.id)

    for field, value in data.items():
        setattr(entity, field, value)
    entity.updated_by = actor.id

    db.commit()
    db.refresh(entity)

    after = _snapshot(entity)
    if before != after:
        activity_service.record(
            db,
            description=f"Searchable entity “{entity.label}” updated",
            event=EVENT_ENTITY_UPDATED,
            subject_type=_SUBJECT,
            subject_id=str(entity.id),
            actor=actor,
            # Old and new both, the house pattern — the question asked afterwards
            # is always "what was it before".
            properties={"attributes": after, "old": before},
        )
    return entity


def toggle_entity(db: Session, entity_id: int, actor: User) -> SearchableEntity:
    """Flip `enabled`.

    Its own route and its own event: disabling a type removes it from everyone's
    search results at once, which is a different act from editing its label.
    """
    entity = get_entity(db, entity_id)
    was = entity.enabled

    entity.enabled = not was
    entity.updated_by = actor.id
    db.commit()
    db.refresh(entity)

    activity_service.record(
        db,
        description=(
            f"“{entity.label}” {'included in' if entity.enabled else 'excluded from'} search"
        ),
        event=EVENT_ENTITY_TOGGLED,
        subject_type=_SUBJECT,
        subject_id=str(entity.id),
        actor=actor,
        properties={"attributes": {"enabled": entity.enabled}, "old": {"enabled": was}},
    )
    return entity


def delete_entity(db: Session, entity_id: int, actor: User) -> None:
    entity = get_entity(db, entity_id)
    snapshot = _snapshot(entity)
    label = entity.label

    recycle_bin_service.soft_delete(entity)
    db.commit()

    activity_service.record(
        db,
        description=f"Searchable entity “{label}” deleted",
        event=EVENT_ENTITY_DELETED,
        subject_type=_SUBJECT,
        subject_id=str(entity_id),
        actor=actor,
        properties={"old": snapshot},
    )
