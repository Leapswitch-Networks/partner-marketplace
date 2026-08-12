"""The API catalogue (LeapDesk parity Module 15).

**A reader over the running application, not a second registry.** FastAPI already
serves `/docs` and `/openapi.json`, and `backend/openapi.json` is committed and
CI-checked; what none of them answer is *which permission gates this route*,
because our authorization is a dependency rather than an OpenAPI security scheme.
That is what these endpoints add.

Gated on `api-consumer-view` — the same permission as the Platform API and
webhooks, and for the same reason: this is documentation for whoever integrates
with us, and it is a map of every route in the application, which is not general
staff reading.
"""

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field

from app.core.dependencies import require_permission
from app.core.permissions import API_CONSUMER_VIEW
from app.models.user import User
from app.services import api_docs_service

router = APIRouter(prefix="/api-docs", tags=["api-docs"])


class OperationEntry(BaseModel):
    method: str
    path: str
    name: str
    summary: str
    tag: str
    #: More than one means the route accepts any of them.
    permissions: list[str] = Field(default_factory=list)
    requires_auth: bool
    #: Neither a permission nor an authentication dependency — reachable by
    #: anyone. True for a handful of routes on purpose; anywhere else it is a
    #: finding.
    is_public: bool


class CatalogueSummary(BaseModel):
    operations: int
    paths: int
    tags: int
    permission_gated: int
    #: Signed in, but no specific permission required.
    auth_only: int
    public: int
    #: Public routes that are **not** on the expected list — health checks and the
    #: doc endpoints. This is the number to read.
    unexpected_public: list[str]


class CatalogueResponse(BaseModel):
    summary: CatalogueSummary
    operations: list[OperationEntry]


@router.get("", response_model=CatalogueResponse)
def catalogue(
    request: Request,
    tag: str | None = Query(default=None, description="Restrict to one tag"),
    _actor: User = Depends(require_permission(API_CONSUMER_VIEW)),
) -> CatalogueResponse:
    """Every route the application serves, with the permission that gates it.

    Read from `request.app.routes` rather than from the committed document: the
    committed file can be a code change behind, where the route table is the
    thing actually serving requests.
    """
    operations = api_docs_service.build_catalogue(request.app)
    summary = api_docs_service.summarise(operations)

    if tag:
        operations = [op for op in operations if op.tag == tag]

    return CatalogueResponse(
        summary=CatalogueSummary(**summary),
        operations=[OperationEntry(**vars(op), is_public=op.is_public) for op in operations],
    )


@router.get("/permissions", response_model=dict[str, list[str]])
def permissions_in_use(
    request: Request,
    _actor: User = Depends(require_permission(API_CONSUMER_VIEW)),
) -> dict[str, list[str]]:
    """Permission → the routes it opens.

    The question an administrator actually asks before granting one: *what does
    this let someone do?* Answered from the routes, so it cannot drift from what
    the code enforces the way a written description does.
    """
    return api_docs_service.permissions_in_use(api_docs_service.build_catalogue(request.app))
