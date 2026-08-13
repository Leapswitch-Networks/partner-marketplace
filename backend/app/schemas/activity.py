"""Wire contracts for the activity-log index (TECH_DEBT PM-32).

Split out of `app.api.activity`, which grew this alongside the router before
`Page[T]` existed. `PaginatedActivity` moved here — and `ActivityEntry` with
it, since the envelope's item type has to live somewhere the router can still
import from without a cycle.
"""

from datetime import datetime

from pydantic import BaseModel

from app.schemas.common import Page


class ActivityEntry(BaseModel):
    id: int
    log_name: str | None
    #: `log_name` as a person reads it — 'auth' is 'Authentication' on screen.
    #: Resolved here rather than in the client so the label cannot differ between
    #: the table, the filter dropdown and the CSV.
    module_label: str
    description: str
    event: str | None
    subject_type: str | None
    subject_id: str | None
    #: Where to click through to, or None when the record has no page. The client
    #: must not build this itself: it would need a copy of the route map, and a
    #: renamed route would then produce a link to nowhere rather than no link.
    subject_url: str | None
    causer_id: str | None
    #: Resolved display name for `causer_id`, or None for an unauthenticated
    #: actor. Sent alongside the id because the id alone means nothing on screen,
    #: and resolving it per row in the client would be N requests per page.
    causer_name: str | None
    properties: dict | None
    batch_uuid: str | None
    created_at: datetime


class PaginatedActivity(Page[ActivityEntry]):
    """The standard page envelope. Kept as its own name — `PaginatedActivity`,
    not `Page[ActivityEntry]` — so the OpenAPI schema name and the generated
    frontend types it feeds don't move.
    """
