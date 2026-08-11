"""Global search endpoints — the box, and the registry that configures it.

Two path families in one router so `main.py` takes a single `include_router`:

* `GET /search` — **any signed-in user.** There is no `search-view` permission,
  matching the reference: the box is part of the chrome, and what it may return
  is decided per entity by `searchable_entities.permission` plus row scoping,
  not by a gate on the endpoint.
* `/settings/search*` — the admin registry, gated `search-entity-manage`.

## Rate limiting

The reference throttles the search route at 60/min, and that matters here too:
each request runs one `ILIKE` per configured entity, so it is the cheapest way
in the app to make the database do work. **We have no throttle on this route**
— PM-26's limiter covers auth endpoints only — and adding one is not something
this module can do without touching `main.py`. Flagged in the handoff rather
than left silent; the caps in `search_service` bound the *size* of a response
but not the *rate* of requests.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from app.core.dependencies import (
    get_client_ip,
    get_current_user,
    get_db,
    require_permission,
)
from app.core.permissions import SEARCH_ENTITY_MANAGE
from app.core.query import page_count
from app.models.searchable_entity import SearchableEntity
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.schemas.search import (
    SearchableEntityPage,
    SearchableEntityResponse,
    SearchableEntityWriteRequest,
    SearchResponse,
)
from app.services import search_service

router = APIRouter(tags=["search"])


def _to_response(entity: SearchableEntity) -> SearchableEntityResponse:
    health, reasons = search_service.entity_health(entity)
    return SearchableEntityResponse(
        id=entity.id,
        model_class=entity.model_class,
        label=entity.label,
        group=entity.group,
        icon=entity.icon,
        fields=list(entity.fields or []),
        display_template=entity.display_template,
        subtitle_template=entity.subtitle_template,
        route_name=entity.route_name,
        route_param_field=entity.route_param_field,
        permission=entity.permission,
        enabled=entity.enabled,
        sort_order=entity.sort_order,
        created_at=entity.created_at,
        updated_at=entity.updated_at,
        health=health,
        health_reasons=reasons,
    )


# --- The search --------------------------------------------------------------


@router.get("/search", response_model=SearchResponse)
def global_search(
    request: Request,
    q: str = Query(default="", max_length=255),
    limit: int = Query(
        default=search_service.DEFAULT_PER_ENTITY,
        ge=1,
        le=search_service.MAX_PER_ENTITY,
        description="Results per entity group",
    ),
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> SearchResponse:
    """Grouped results across every entity the caller may search.

    A query shorter than two characters returns no groups without touching the
    database — the reference's rule, and a real one: one character matches most
    of a table and the result is noise.

    The IP comes from `get_client_ip`, which reads `X-Forwarded-For` **only**
    when a proxy is configured to be in front. Reading that header here directly
    would let a caller write any address they liked into `search_logs`.
    """
    groups, duration_ms = search_service.timed_search(
        db,
        actor,
        q,
        per_entity=limit,
        ip=get_client_ip(request),
    )
    return SearchResponse(q=q.strip(), groups=groups, duration_ms=duration_ms)


# --- The registry ------------------------------------------------------------


@router.get("/settings/search", response_model=SearchableEntityPage, tags=["search-entities"])
def list_searchable_entities(
    search: str | None = Query(default=None, description="Matches label, model, group, route or permission"),
    group: str | None = Query(default=None),
    enabled: bool | None = Query(default=None),
    sort_by: str = Query(default="sort_order"),
    sort_order: str = Query(default="asc", pattern="^(asc|desc)$"),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=25, ge=1, le=100),
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(SEARCH_ENTITY_MANAGE)),
) -> SearchableEntityPage:
    entities, total = search_service.list_entities(
        db,
        search_term=search,
        group=group,
        enabled=enabled,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        per_page=per_page,
    )
    return SearchableEntityPage(
        items=[_to_response(e) for e in entities],
        total=total,
        page=page,
        per_page=per_page,
        pages=page_count(total, per_page),
        can_manage=actor.has_permission(SEARCH_ENTITY_MANAGE),
        groups=search_service.list_groups(db),
        available_models=search_service.registered_model_names(),
    )


@router.post(
    "/settings/search",
    response_model=SearchableEntityResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["search-entities"],
)
def create_searchable_entity(
    payload: SearchableEntityWriteRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(SEARCH_ENTITY_MANAGE)),
) -> SearchableEntityResponse:
    entity = search_service.create_entity(db, payload.model_dump(), actor)
    return _to_response(entity)


@router.put(
    "/settings/search/{entity_id}",
    response_model=SearchableEntityResponse,
    tags=["search-entities"],
)
def update_searchable_entity(
    entity_id: int,
    payload: SearchableEntityWriteRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(SEARCH_ENTITY_MANAGE)),
) -> SearchableEntityResponse:
    entity = search_service.update_entity(db, entity_id, payload.model_dump(), actor)
    return _to_response(entity)


@router.post(
    "/settings/search/{entity_id}/toggle",
    response_model=SearchableEntityResponse,
    tags=["search-entities"],
)
def toggle_searchable_entity(
    entity_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(SEARCH_ENTITY_MANAGE)),
) -> SearchableEntityResponse:
    """Include or exclude a type from every user's search results."""
    return _to_response(search_service.toggle_entity(db, entity_id, actor))


@router.delete(
    "/settings/search/{entity_id}",
    response_model=MessageResponse,
    tags=["search-entities"],
)
def delete_searchable_entity(
    entity_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(SEARCH_ENTITY_MANAGE)),
) -> MessageResponse:
    search_service.delete_entity(db, entity_id, actor)
    return MessageResponse(message="Searchable entity deleted.")
