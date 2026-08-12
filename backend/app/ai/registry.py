"""Which tools a given user's assistant is given.

The reference's `ToolRegistry`: `register(factory, gate)` where the gate is a
permission name or `None` for everyone, and `toolsFor(user)` resolves the set at
prompt time. Ported with one structural difference — ours builds the tool list
per request rather than holding a container-wide singleton, because our tools
close over the request's session and actor.

**The gate is the authorization, and it is applied here rather than inside the
tool.** A tool the user may not use is never described to the model, so the model
cannot decide to call it, cannot mention it, and cannot tell the user it exists.
That is why the system prompt can honestly say "you only hold the tools their
role grants" — a refusal the model *narrates* would be a refusal the model could
also be argued out of.

Note what this does **not** gate: `locate_data` is available to everyone who may
use the assistant at all, because Global Search applies its own three permission
layers and row scoping to every result. Gating it again here would be a second
opinion about the same question, and the two would eventually disagree.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from sqlalchemy.orm import Session

from app.ai import tools
from app.core.permissions import AI_ASSISTANT_QUERY_DATABASE
from app.models.user import User


@dataclass(frozen=True)
class ToolSpec:
    """One tool: how to call it, how to describe it, and who may have it."""

    name: str
    description: str
    input_schema: dict[str, Any]
    #: Built per request so it can close over the session and the actor.
    factory: Callable[[Session, User], Callable[..., str]]
    #: A permission name, or None for anyone who may use the assistant.
    gate: str | None = None


SPECS: tuple[ToolSpec, ...] = (
    ToolSpec(
        name="describe_schema",
        description=tools.DESCRIBE_SCHEMA_DESCRIPTION,
        input_schema=tools.DESCRIBE_SCHEMA_SCHEMA,
        factory=lambda _db, _actor: tools.describe_schema,
        gate=AI_ASSISTANT_QUERY_DATABASE,
    ),
    ToolSpec(
        name="database_query",
        description=tools.DATABASE_QUERY_DESCRIPTION,
        input_schema=tools.DATABASE_QUERY_SCHEMA,
        factory=lambda _db, _actor: tools.database_query,
        gate=AI_ASSISTANT_QUERY_DATABASE,
    ),
    ToolSpec(
        name="locate_data",
        description=tools.LOCATE_DATA_DESCRIPTION,
        input_schema=tools.LOCATE_DATA_SCHEMA,
        # Bound to the caller: Global Search decides what this user may see.
        factory=lambda db, actor: (
            lambda query, limit=None: tools.locate_data(db, actor, query, limit)
        ),
        gate=None,
    ),
)


def specs_for(actor: User) -> list[ToolSpec]:
    """The tool specs this user may be given, in declaration order."""
    return [
        spec
        for spec in SPECS
        if spec.gate is None or actor.has_permission(spec.gate)
    ]


def callables_for(db: Session, actor: User) -> dict[str, Callable[..., str]]:
    """Name → bound callable, for dispatching a tool call the model made.

    Built from the same filtered list as the descriptions, so a name the model
    could not have been told about has no entry here either. A tool call for an
    unknown name is therefore an error rather than a lookup that happens to work.
    """
    return {spec.name: spec.factory(db, actor) for spec in specs_for(actor)}
