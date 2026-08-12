"""AI assistant endpoints (LeapDesk parity Module 9).

Two gates on every chat request, in the reference's order and with its wording:
the integration must be enabled with a key behind it, and the caller must hold
`ai-assistant-use`. They are separate because they fail for different reasons and
a user can act on only one of them — "it is switched off" is for an administrator,
"your role does not have access" is for whoever grants roles.

The settings routes are gated on `api-credential-view`, matching the reference:
the toggle writes a field on the Anthropic credential, so the permission to flip
it is the permission to manage credentials, not a new one.

**Throttling is not declared here.** `core/rate_limit.py` matches these paths by
shape and gives them their own bucket, the same way it handles the outbound-mail
routes — see `SENSITIVE_PATH_SHAPES`.
"""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_permission
from app.core.permissions import AI_ASSISTANT_USE, API_CREDENTIAL_VIEW
from app.models.user import User
from app.schemas.ai import (
    AssistantAvailability,
    AssistantSettings,
    ChatRequest,
    ChatResponse,
    ConversationMessage,
    ConversationSummary,
    FeedbackRequest,
    FeedbackResponse,
    SetAssistantEnabledRequest,
)
from app.schemas.auth import MessageResponse
from app.services import ai_service

router = APIRouter(prefix="/ai", tags=["ai-assistant"])


@router.post("/chat", response_model=ChatResponse)
def chat(
    data: ChatRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(AI_ASSISTANT_USE)),
) -> ChatResponse:
    """Ask the assistant one question.

    Returns **403** when the integration is off — the same status the reference
    uses, and correct: the request was well-formed and authenticated, and the
    thing being refused is the feature. **502** when the model could not be
    reached or declined; the question is already saved to the thread by then, so
    a retry does not lose it.
    """
    return ChatResponse(**ai_service.chat(db, actor, data.message, data.conversation_id))


@router.post("/feedback", response_model=FeedbackResponse, status_code=status.HTTP_201_CREATED)
def feedback(
    data: FeedbackRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(AI_ASSISTANT_USE)),
) -> FeedbackResponse:
    """Record 👍/👎 on a reply."""
    record = ai_service.record_feedback(
        db,
        actor,
        conversation_id=data.conversation_id,
        helpful=data.helpful,
        comment=data.comment,
    )
    return FeedbackResponse(id=record.id, helpful=record.helpful)


@router.get("/conversations", response_model=list[ConversationSummary])
def list_conversations(
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(AI_ASSISTANT_USE)),
) -> list[ConversationSummary]:
    """This caller's threads, most recently used first. **Only ever their own.**"""
    return [
        ConversationSummary.model_validate(row)
        for row in ai_service.list_conversations(db, actor)
    ]


@router.get("/conversations/{conversation_id}", response_model=list[ConversationMessage])
def conversation_messages(
    conversation_id: str,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(AI_ASSISTANT_USE)),
) -> list[ConversationMessage]:
    """One thread's messages. 404 for a thread belonging to someone else — see
    `ai_service._conversation_for` for why that is a 404 and not a 403."""
    return [
        ConversationMessage.model_validate(row)
        for row in ai_service.get_messages(db, actor, conversation_id)
    ]


@router.delete("/conversations/{conversation_id}", response_model=MessageResponse)
def delete_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(AI_ASSISTANT_USE)),
) -> MessageResponse:
    ai_service.delete_conversation(db, actor, conversation_id)
    return MessageResponse(message="Conversation deleted")


@router.get("/availability", response_model=AssistantAvailability)
def availability(
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(AI_ASSISTANT_USE)),
) -> AssistantAvailability:
    """Whether the widget should render at all.

    Split from `/ai/settings` deliberately. The settings route is gated on
    `api-credential-view` because it reports the integration's configuration; the
    widget needs one boolean and is used by people who hold no credential
    permission at all. Pointing the widget at the admin route would have meant
    either a 403 on every page load for ordinary users, or loosening the gate on
    a route that reports what is configured.
    """
    return AssistantAvailability(
        available=ai_service.is_enabled(db),
        can_use=True,  # the dependency above already established it
    )


# --- Settings ---------------------------------------------------------------


@router.get("/settings", response_model=AssistantSettings)
def get_settings(
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(API_CREDENTIAL_VIEW)),
) -> AssistantSettings:
    """The state of the integration, including which read-only control is in force."""
    return AssistantSettings(**ai_service.settings_state(db, actor))


@router.put("/settings", response_model=AssistantSettings)
def set_settings(
    data: SetAssistantEnabledRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(API_CREDENTIAL_VIEW)),
) -> AssistantSettings:
    """Turn the assistant on or off.

    **Refuses to enable with no API key present** (422), matching the reference:
    an enabled assistant with no key is visible, inviting and broken.
    """
    return AssistantSettings(**ai_service.set_enabled(db, data.enabled, actor))
