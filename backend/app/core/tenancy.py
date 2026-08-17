"""What the core needs to know about an organisation — and nothing more.

`CORE_EXTRACTION_PLAN.md` phase 2. `core/dependencies.py` enforces the
organisation gate on **every authenticated request**, and to do that it needs
exactly one fact: is the caller's organisation active. It previously got that by
reading `user.partner.status`, which put the partner directory's model name in
the middle of the platform's auth guard.

This module is the contract instead. The core depends on the *shape*; the domain
supplies something with that shape. `app/models/partner.py` satisfies it without
importing anything from here — that is what a `Protocol` is for.

## Why the statuses live here rather than on the domain model

The gate has to branch on them: PENDING and SUSPENDED produce different messages,
because "we have not activated you yet" and "we switched you off" are different
things to read at a login screen. A core guard branching on values the core does
not define would be a rule split across two files, which is how the two come to
disagree. So the *vocabulary* is the core's and the *table* is the domain's.

Three states, and PENDING is refused as firmly as SUSPENDED: an organisation
nobody has activated must not have working logins, or onboarding would grant
access before approval — the same gate `users.status` applies one level down.
"""

from __future__ import annotations

from typing import Protocol, runtime_checkable

#: Not yet activated. Refused — onboarding does not grant login.
ORG_STATUS_PENDING = "PENDING"
#: The only status whose members may sign in.
ORG_STATUS_ACTIVE = "ACTIVE"
#: Activated and then switched off. Refused, and existing sessions are revoked.
ORG_STATUS_SUSPENDED = "SUSPENDED"

ORG_STATUSES: frozenset[str] = frozenset(
    {ORG_STATUS_PENDING, ORG_STATUS_ACTIVE, ORG_STATUS_SUSPENDED}
)


@runtime_checkable
class Organisation(Protocol):
    """The tenant boundary, as the core sees it.

    Deliberately tiny. Anything the core could read here is something a second
    project's organisation model would be obliged to provide, so the rule is:
    add a member only when a *core* guard genuinely needs it. Everything else —
    a partner's tier, verification level, listing flag — belongs to the domain
    and is reached through the domain's own model.

    `id` is present because scoping compares it; `status` because the auth guard
    branches on it. That is the whole contract.
    """

    @property
    def id(self) -> str: ...

    @property
    def status(self) -> str: ...


def is_active(organisation: Organisation | None) -> bool:
    """True when the organisation permits its members to sign in.

    `None` is **True**, and the asymmetry is deliberate: `organisation_id IS
    NULL` means an internal, first-party account with no organisation to gate.
    Answering False would lock out every staff member the moment this function
    was wired in.
    """
    return organisation is None or organisation.status == ORG_STATUS_ACTIVE


__all__ = [
    "ORG_STATUS_PENDING",
    "ORG_STATUS_ACTIVE",
    "ORG_STATUS_SUSPENDED",
    "ORG_STATUSES",
    "Organisation",
    "is_active",
]
