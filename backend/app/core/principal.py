"""Who is making a request, when "who" is not always a person.

**This is the design decision `LEAPDESK_PARITY_PLAN.md` § Module 10 asked to be
taken once rather than three times.** Three independent requirements in four days
have needed a caller that is not a `User` row:

| Where | The principal |
|---|---|
| `PARTNER_DIRECTORY_PLAN.md` | the **anonymous** visitor on a public directory |
| PM-5 / `MARKETPLACE_DOMAIN_PLAN.md` | a partner **organisation** as a tenant boundary |
| Module 10 | a **machine consumer** holding a token |

Everything in the stack is typed `actor: User` — `get_current_user`,
`require_permission`, every function in `data_access_service`, and
`activity_service.record`'s `actor`. A machine consumer has no user row, no role
and no permissions, **and it must never acquire them.**

**The shortcut this type exists to refuse** is a hidden service `User` per
integration. It works immediately and it puts machine identities into user lists,
RBAC screens and every `SELECT * FROM users`; one forgotten filter then turns an
integration into a login. LeapDesk avoids it by hanging tokens off `ApiConsumer`,
and has no equivalent of this type because it does not apply data scoping to its
API at all — so there was nothing to copy here, only to design.

**Anonymous is the most restrictive branch by construction**, not by convention.
`PARTNER_DIRECTORY_PLAN.md` warned that the obvious `if actor is None: return
stmt` would serve unfiltered rows to the internet; the machine case is the same
hazard in a different hat. Every predicate below therefore answers `False` for
anonymous without a caller having to remember to check.

## What this is not, yet

Nothing is *typed against* this union today. Retyping `get_current_user` and the
forty-odd `actor: User` signatures is a refactor of its own, and doing it in the
same change as a new module would bury one in the other. What exists here is the
seam and its semantics, used by the Platform API's token gate — so the next
caller adapts to a type that already has a considered answer for anonymous,
rather than inventing a fourth one.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

from app.models.user import User


@dataclass(frozen=True)
class UserPrincipal:
    """A signed-in person. The only principal that holds roles."""

    user: User

    kind: Literal["user"] = "user"

    @property
    def id(self) -> str:
        return self.user.id

    @property
    def label(self) -> str:
        return self.user.full_name or self.user.email

    def has_permission(self, permission: str) -> bool:
        return self.user.has_permission(permission)

    def has_ability(self, ability: str) -> bool:
        """People do not carry abilities; they carry permissions.

        False rather than delegating to `has_permission`: an ability names what a
        *token* may do, and quietly satisfying one with a human's permission
        would mean a machine-facing endpoint could be reached by a browser
        session — which is the confusion this whole type exists to prevent.
        """
        return False


@dataclass(frozen=True)
class MachinePrincipal:
    """A system calling with a token. No roles, no permissions, ever."""

    consumer_id: str
    consumer_slug: str
    token_id: str
    token_prefix: str
    abilities: frozenset[str] = field(default_factory=frozenset)

    kind: Literal["machine"] = "machine"

    @property
    def id(self) -> str:
        return self.consumer_id

    @property
    def label(self) -> str:
        return self.consumer_slug

    def has_permission(self, permission: str) -> bool:
        """**Always False, and never delegate this to an ability check.**

        A machine holds abilities, not permissions. Answering True here — for any
        input — would let a machine consumer through `require_permission`, which
        guards every administrative route in the application.
        """
        return False

    def has_ability(self, ability: str) -> bool:
        return ability in self.abilities


@dataclass(frozen=True)
class AnonymousPrincipal:
    """Nobody. The public internet.

    Both predicates answer False unconditionally, which is what makes this the
    most restrictive branch *by construction* rather than by every caller
    remembering to special-case it.
    """

    kind: Literal["anonymous"] = "anonymous"

    @property
    def id(self) -> str | None:
        return None

    @property
    def label(self) -> str:
        return "anonymous"

    def has_permission(self, permission: str) -> bool:
        return False

    def has_ability(self, ability: str) -> bool:
        return False


Principal = UserPrincipal | MachinePrincipal | AnonymousPrincipal

ANONYMOUS = AnonymousPrincipal()


def for_user(user: User | None) -> Principal:
    """Wrap an optional user. `None` becomes anonymous, never an empty user."""
    return UserPrincipal(user=user) if user is not None else ANONYMOUS


def is_machine(principal: Principal) -> bool:
    return principal.kind == "machine"


def is_human(principal: Principal) -> bool:
    return principal.kind == "user"
