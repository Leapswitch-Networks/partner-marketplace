"""Orchestration and memory for the AI assistant (LeapDesk parity Module 9).

Holds the four things the reference splits across `AiChatController`,
`LeapDeskAssistant`'s `RemembersConversations` trait and
`AiAssistantSettingsController`: whether the assistant is on, what it has been
asked before, what it answered, and what people thought of the answer.

**The gate is checked here, not only at the route.** "Is the assistant enabled"
is a question about the Anthropic credential row, and the settings screen, the
chat endpoint and the widget's visibility all have to answer it the same way —
the reference makes exactly this point, which is why flipping the flag shows or
hides the widget app-wide at once.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.ai import client, guard, registry
from app.models.ai_conversation import (
    ROLE_ASSISTANT,
    ROLE_USER,
    AgentConversation,
    AgentConversationMessage,
    AiMessageFeedback,
)
from app.models.api_credential import ApiCredential, ApiServiceProvider
from app.models.user import User
from app.services import activity_service, credential_service

logger = logging.getLogger("app.ai")

PROVIDER_SLUG = "anthropic"
FIELD_API_KEY = "api_key"
FIELD_MODEL = "default_model"
FIELD_ENABLED = "enabled"

AGENT_NAME = "partner-marketplace-assistant"

#: How many prior turns are replayed to the model. Every one of them is re-sent
#: and re-billed on each message, so an unbounded thread gets slower and more
#: expensive with every question. Twenty is roughly ten exchanges — past that,
#: starting a new conversation is the better answer and the UI offers it.
HISTORY_TURNS = 20

#: A thread's title, taken from its first question. Long enough to tell two
#: threads apart in a list, short enough not to wrap.
TITLE_LENGTH = 80

DISABLED_MESSAGE = (
    "The AI assistant is not enabled. Configure Anthropic in API Credentials."
)
FORBIDDEN_MESSAGE = "Your role does not have access to the AI assistant."
UNAVAILABLE_MESSAGE = "The assistant could not respond right now. Please try again."
NO_KEY_MESSAGE = (
    "Add an Anthropic API key in API Credentials before enabling the assistant."
)


# --- The gate ---------------------------------------------------------------


def _truthy(value: Any) -> bool:
    """Credential values are stored as text; `enabled` arrives as "1" or "0"."""
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def _credential_values(db: Session) -> dict[str, str]:
    values = credential_service.resolve(db, PROVIDER_SLUG)
    return values if isinstance(values, dict) else {}


def is_enabled(db: Session) -> bool:
    """On only when the integration is enabled **and** a key is present.

    Both halves, matching the reference: an enabled flag with no key behind it is
    an assistant that fails on the first question, which is worse than one that
    says plainly it is off.
    """
    values = _credential_values(db)
    return _truthy(values.get(FIELD_ENABLED)) and bool(values.get(FIELD_API_KEY))


def settings_state(db: Session, actor: User) -> dict[str, Any]:
    """What the settings screen and the widget both read."""
    from app.db import readonly

    values = _credential_values(db)
    return {
        "enabled": _truthy(values.get(FIELD_ENABLED)),
        "has_api_key": bool(values.get(FIELD_API_KEY)),
        "model": values.get(FIELD_MODEL) or client.DEFAULT_MODEL,
        "available": is_enabled(db),
        "can_use": actor.has_permission("ai-assistant-use"),
        # The tools *this* caller would be given. Shown so an administrator can
        # see that the permission split is real rather than described.
        "tools": [spec.name for spec in registry.specs_for(actor)],
        # Named honestly: the strong control is a dedicated SELECT-only role, and
        # this says which one is actually in force. See `db/readonly.py`.
        "readonly_dedicated_role": readonly.using_dedicated_role(),
        "readonly_guard_holds": readonly.assert_read_only(),
    }


def set_enabled(db: Session, enabled: bool, actor: User) -> dict[str, Any]:
    """Flip the integration on or off. **Refuses to enable without a key.**

    The reference's rule, and the reason for it is the same as `is_enabled`'s:
    enabling without a key produces an assistant that is visible, inviting, and
    broken.
    """
    values = _credential_values(db)
    if enabled and not values.get(FIELD_API_KEY):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, NO_KEY_MESSAGE)

    credential = db.scalar(
        select(ApiCredential)
        .join(ApiServiceProvider, ApiCredential.provider_id == ApiServiceProvider.id)
        .where(ApiServiceProvider.slug == PROVIDER_SLUG)
        .where(ApiCredential.is_active.is_(True))
    )
    if credential is None:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "No Anthropic credential is configured. Add one in API Credentials first.",
        )

    # Through `update_credential` rather than writing the value row directly, so
    # the flip is encrypted-aware, audited and validated by the one function that
    # owns those rules. Its other fields are echoed back unchanged because it
    # takes a whole record; `_apply_field_values` skips any key not supplied, so
    # sending only `enabled` cannot disturb the API key.
    credential_service.update_credential(
        db,
        credential.id,
        {
            "environment": credential.environment,
            "name": credential.name,
            "is_active": credential.is_active,
            "notes": credential.notes,
            "field_values": {FIELD_ENABLED: "1" if enabled else "0"},
        },
        actor,
    )

    activity_service.record(
        db,
        actor=actor,
        subject_type="ApiCredential",
        subject_id=str(credential.id),
        event="ai_assistant_toggled",
        description=f"{actor.full_name} turned the AI assistant {'on' if enabled else 'off'}",
        properties={"enabled": enabled},
    )
    return settings_state(db, actor)


# --- Conversations ----------------------------------------------------------


def _conversation_for(db: Session, actor: User, conversation_id: str | None) -> AgentConversation:
    """Continue a thread, or start one.

    **A thread belongs to the person who started it.** Continuing someone else's
    is a 404 rather than a 403: confirming that a conversation id exists would
    itself say something about what other people have been asking.
    """
    if conversation_id:
        conversation = db.get(AgentConversation, conversation_id)
        if conversation is None or conversation.user_id != actor.id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found")
        return conversation

    conversation = AgentConversation(user_id=actor.id)
    db.add(conversation)
    db.flush()
    return conversation


def _history(db: Session, conversation: AgentConversation) -> list[dict[str, str]]:
    """Prior turns in Anthropic shape, oldest first, capped.

    Only `user` and `assistant` turns are replayed. Tool results are stored for
    the audit trail but not re-sent: the model does not need last week's rows to
    answer today's question, and re-sending them is the fastest way to fill a
    context window with data nobody asked for twice.
    """
    rows = list(
        db.scalars(
            select(AgentConversationMessage)
            .where(AgentConversationMessage.conversation_id == conversation.id)
            .where(AgentConversationMessage.role.in_([ROLE_USER, ROLE_ASSISTANT]))
            .order_by(AgentConversationMessage.created_at.desc())
            .limit(HISTORY_TURNS)
        )
    )
    rows.reverse()
    return [{"role": row.role, "content": row.content or ""} for row in rows if row.content]


def list_conversations(db: Session, actor: User, limit: int = 20) -> list[AgentConversation]:
    return list(
        db.scalars(
            select(AgentConversation)
            .where(AgentConversation.user_id == actor.id)
            .order_by(AgentConversation.updated_at.desc())
            .limit(limit)
        )
    )


def get_messages(db: Session, actor: User, conversation_id: str) -> list[AgentConversationMessage]:
    conversation = _conversation_for(db, actor, conversation_id)
    return list(
        db.scalars(
            select(AgentConversationMessage)
            .where(AgentConversationMessage.conversation_id == conversation.id)
            .where(AgentConversationMessage.role.in_([ROLE_USER, ROLE_ASSISTANT]))
            .order_by(AgentConversationMessage.created_at)
        )
    )


def delete_conversation(db: Session, actor: User, conversation_id: str) -> None:
    conversation = _conversation_for(db, actor, conversation_id)
    # Counted before the delete cascades the messages away. Metadata only, no
    # content: conversations are deliberately unreadable to other users (see the
    # registry's denylist note), and an audit row is admin-visible — copying the
    # transcript into it would reopen the hole the denylist closes.
    message_count = db.scalar(
        select(func.count())
        .select_from(AgentConversationMessage)
        .where(AgentConversationMessage.conversation_id == conversation.id)
    )
    started_at = conversation.created_at
    db.delete(conversation)
    db.commit()
    activity_service.record(
        db,
        description=f"{actor.email} deleted an assistant conversation",
        event="deleted",
        subject_type="AgentConversation",
        subject_id=conversation_id,
        actor=actor,
        properties={
            "message_count": message_count,
            "started_at": started_at.isoformat() if started_at else None,
        },
    )


# --- The exchange -----------------------------------------------------------


def chat(
    db: Session, actor: User, message: str, conversation_id: str | None = None
) -> dict[str, Any]:
    """One question, one answer. Returns the reply and the thread it belongs to.

    Ordering matters here and is not obvious: the **user's** message is persisted
    before the model is called. If the call then fails, the question is still in
    the thread — which is what someone re-opening the widget expects to see, and
    it means a failed exchange is visible rather than silently discarded.
    """
    if not is_enabled(db):
        raise HTTPException(status.HTTP_403_FORBIDDEN, DISABLED_MESSAGE)

    values = _credential_values(db)
    conversation = _conversation_for(db, actor, conversation_id)
    history = _history(db, conversation)

    if not conversation.title:
        conversation.title = message.strip()[:TITLE_LENGTH]

    db.add(
        AgentConversationMessage(
            conversation_id=conversation.id,
            user_id=actor.id,
            agent=AGENT_NAME,
            role=ROLE_USER,
            content=message,
        )
    )
    db.commit()

    try:
        reply = client.ask(
            db,
            actor,
            api_key=values[FIELD_API_KEY],
            model=values.get(FIELD_MODEL),
            history=history,
            message=message,
        )
    except client.AssistantUnavailable as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, UNAVAILABLE_MESSAGE) from exc

    text, flags = guard.sanitize(reply.text)
    if flags:
        # Warned, not thrown: the reply has already been cleaned, and the flag is
        # a signal about the *prompt or the data*, which is worth investigating
        # without denying the user their answer.
        logger.warning(
            "assistant reply raised guardrail flags",
            extra={"user_id": actor.id, "flags": flags},
        )

    db.add(
        AgentConversationMessage(
            conversation_id=conversation.id,
            user_id=actor.id,
            agent=AGENT_NAME,
            role=ROLE_ASSISTANT,
            content=text,
            tool_calls=reply.tool_calls or None,
            usage=reply.usage,
            meta={
                "model": reply.model,
                "stop_reason": reply.stop_reason,
                "guard_flags": flags,
            },
        )
    )
    db.commit()

    return {
        "reply": text,
        "conversation_id": conversation.id,
        "title": conversation.title,
        "tools_used": [call["name"] for call in reply.tool_calls],
        "flags": flags,
    }


def record_feedback(
    db: Session,
    actor: User,
    *,
    conversation_id: str | None,
    helpful: bool,
    comment: str | None,
) -> AiMessageFeedback:
    """👍/👎 on a reply. The only quality signal the assistant has."""
    feedback = AiMessageFeedback(
        conversation_id=conversation_id,
        user_id=actor.id,
        helpful=helpful,
        comment=(comment or "").strip() or None,
    )
    db.add(feedback)
    db.commit()
    db.refresh(feedback)
    return feedback
