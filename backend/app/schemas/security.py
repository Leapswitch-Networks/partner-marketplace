"""Wire contracts for the Security screen (Module 12).

Reuses `SettingResponse` for the controls themselves — they are the same rows
Configuration serves, filtered to one namespace, and giving them a second
response model would mean two shapes to keep in step for no gain.
"""

from datetime import datetime

from pydantic import BaseModel

from app.schemas.setting import SettingResponse


class SecurityAuditRow(BaseModel):
    """One line of the audit panel.

    A flattened activity-log row, not the full `ActivityEntry`: this panel shows
    what happened and who did it, and the `properties` blob — before/after diffs,
    IPs, stack context — is what the Activity Log is for. Sending it here would
    put a payload on screen with nothing to render it.
    """

    id: int
    description: str
    event: str | None
    log_name: str
    #: Display name, or the literal `"system"` for automation. Never null —
    #: an empty cell reads as missing data rather than as "no human did this".
    causer: str
    created_at: datetime


class SecurityOverviewResponse(BaseModel):
    """The whole screen in one request.

    Controls and audit together rather than two endpoints, because the page is
    useless with either half missing and two requests would let it render half a
    screen while the other is still in flight.
    """

    #: Ordered `group → label`. The client groups into tabs while preserving
    #: this order — see the note on the endpoint about why it is not pre-grouped.
    items: list[SettingResponse]
    audit: list[SecurityAuditRow]


__all__ = ["SecurityAuditRow", "SecurityOverviewResponse"]
