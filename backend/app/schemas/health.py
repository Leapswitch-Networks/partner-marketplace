"""Wire contract for System Health (Module 18).

Panels are typed loosely on purpose. Each one is a different shape — a database
panel has a version, a queue panel has a reason — and forcing them into a common
`Panel` model would mean five optional fields, four of which are null in any given
panel. The frontend renders each by name, not generically.
"""

from typing import Any

from pydantic import BaseModel


class SystemHealthResponse(BaseModel):
    database: dict[str, Any]
    storage: dict[str, Any]
    errors: dict[str, Any]
    #: `configured: false` when no worker exists — **not** zeroed counters. A
    #: "0 pending / 0 failed" panel is indistinguishable from a healthy queue.
    queue: dict[str, Any]
    #: `probing_available: false` until Module 7 lands. Counts are real; the
    #: reachability tick is deliberately absent rather than unchecked-green.
    providers: dict[str, Any]


__all__ = ["SystemHealthResponse"]
