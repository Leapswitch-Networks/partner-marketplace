"""The Anthropic call, and everything about it that is not portable from the reference.

The reference drives this through `Laravel\\Ai`'s `Agent`/`HasTools` contracts and
pins `claude-sonnet-4-6`. Neither transfers, so this is written against the
installed Python SDK — **checked against the installed tree, not from memory**,
per root `AGENTS.md`: `anthropic==0.121.0`, which has `beta_tool` and
`client.beta.messages.tool_runner`.

`tool_runner` drives the tool loop itself: it calls the model, runs any tool the
model asked for, feeds the result back, and repeats until the model stops asking.
That removes the hand-written `while stop_reason == "tool_use"` loop, which is
the part of an agent integration that is easy to get subtly wrong — a missed
`tool_result` block is an infinite loop.

**Four decisions that differ from a naive port:**

* **`stop_reason == "refusal"` is checked before the content is read.** A refusal
  carries no assistant text, so reading `content[0].text` first turns a policy
  decline into an `IndexError` — a 500 where the honest answer is "the model
  declined".
* **No `temperature`, no `top_p`, no `budget_tokens`.** All three are rejected by
  the current models; `thinking={"type": "adaptive"}` and
  `output_config={"effort": ...}` are the supported controls.
* **One application-level retry, not two.** The SDK already retries 429s and 5xx
  with backoff. The reference's `retry(2, …, 250)` on top of that would be up to
  six attempts at a request that costs money each time.
* **`max_iterations` is capped.** A model that keeps calling tools is a model in a
  loop, and each iteration is a paid request. The reference has no equivalent
  because `Laravel\\Ai` bounds it internally.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy.orm import Session

from app.ai import prompt as prompt_builder, registry
from app.models.user import User

logger = logging.getLogger("app.ai.client")

#: Falls back to the value seeded on the `anthropic` provider row, which is where
#: an administrator changes it without a deploy — the reference's rule and a good
#: one. **Not `claude-opus-5`**, which `LEAPDESK_PARITY_PLAN.md` names: the
#: provider row shipped with this value on 2026-08-11 and silently promoting an
#: install to a model that costs several times more is not a change to make on
#: someone's behalf. The row is one edit away for anyone who wants it.
DEFAULT_MODEL = "claude-sonnet-5"

MAX_TOKENS = 4096

#: Each iteration is a paid round trip. Six is enough for discover-then-read-then
#: -refine, which is the deepest sequence the prompt asks for.
MAX_ITERATIONS = 6

#: Re-serves a policy decline rather than surfacing it, per the plan's note.
FALLBACK_BETA = "server-side-fallback-2026-07-01"


class AssistantUnavailable(RuntimeError):
    """The model could not be reached, or refused. Surfaces as a 502."""


@dataclass
class AssistantReply:
    """What one exchange produced, before the output guard sees it."""

    text: str
    tool_calls: list[dict[str, Any]] = field(default_factory=list)
    usage: dict[str, Any] | None = None
    stop_reason: str | None = None
    model: str | None = None


def _build_tools(db: Session, actor: User) -> list[Any]:
    """Wrap this user's permitted tools as SDK tool objects.

    Built per request because the callables close over the session and the actor
    — see `registry`. The filtered list is the authorization: a tool the user may
    not use is never described to the model.
    """
    import anthropic

    bound = registry.callables_for(db, actor)
    return [
        anthropic.beta_tool(
            bound[spec.name],
            name=spec.name,
            description=spec.description,
            input_schema=spec.input_schema,
        )
        for spec in registry.specs_for(actor)
    ]


def ask(
    db: Session,
    actor: User,
    *,
    api_key: str,
    model: str | None,
    history: list[dict[str, Any]],
    message: str,
) -> AssistantReply:
    """Run one exchange. Raises `AssistantUnavailable` on anything unusable.

    `history` is the prior turns in Anthropic message shape, oldest first. The
    system prompt is not part of it — it is rebuilt here from the caller's current
    permissions, so a role change takes effect on the next message rather than on
    the next conversation.
    """
    import anthropic

    client = anthropic.Anthropic(api_key=api_key, max_retries=2)
    tools = _build_tools(db, actor)
    messages = [*history, {"role": "user", "content": message}]

    try:
        runner = client.beta.messages.tool_runner(
            model=model or DEFAULT_MODEL,
            max_tokens=MAX_TOKENS,
            system=prompt_builder.build(actor),
            messages=messages,
            tools=tools,
            max_iterations=MAX_ITERATIONS,
            # Adaptive rather than a token budget: `budget_tokens` is rejected by
            # the current models, and a fixed budget is the wrong shape anyway —
            # "who is the newest partner" and "summarise last month" do not want
            # the same amount of thinking.
            thinking={"type": "adaptive"},
            output_config={"effort": "high"},
            fallbacks="default",
            betas=[FALLBACK_BETA],
        )
        final = runner.until_done()
    except Exception as exc:  # noqa: BLE001 - every failure here is one 502
        # The message is logged, never returned: an API error can quote the
        # request, and the request contains the user's question and our prompt.
        logger.error(
            "assistant call failed: %s: %s", type(exc).__name__, exc,
            extra={"user_id": actor.id},
        )
        raise AssistantUnavailable(str(exc)) from exc

    # BEFORE reading content — a refusal has none.
    if getattr(final, "stop_reason", None) == "refusal":
        logger.warning("assistant declined the request", extra={"user_id": actor.id})
        raise AssistantUnavailable("The model declined to answer that.")

    text_parts: list[str] = []
    tool_calls: list[dict[str, Any]] = []
    for block in getattr(final, "content", []) or []:
        block_type = getattr(block, "type", None)
        if block_type == "text":
            text_parts.append(getattr(block, "text", "") or "")
        elif block_type == "tool_use":
            # Recorded for the trail: which tool, with what arguments. The
            # *result* is not stored here — it can be thousands of rows, and the
            # answer composed from it is what anyone reviewing this needs.
            tool_calls.append(
                {"name": getattr(block, "name", None), "input": getattr(block, "input", None)}
            )

    usage = getattr(final, "usage", None)
    return AssistantReply(
        text="\n".join(part for part in text_parts if part).strip(),
        tool_calls=tool_calls,
        usage=usage.model_dump() if hasattr(usage, "model_dump") else None,
        stop_reason=getattr(final, "stop_reason", None),
        model=getattr(final, "model", None),
    )
