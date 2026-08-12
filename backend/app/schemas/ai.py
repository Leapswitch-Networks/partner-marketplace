"""Request and response shapes for the AI assistant.

Limits match the reference: a message is `required|max:4000`, a comment
`max:1000`, and a conversation id is exactly 36 characters. The length caps are
not decoration — an unbounded message is an unbounded bill, and the model's
context is finite whether or not we bound the input.
"""

from datetime import datetime

from pydantic import BaseModel, Field

#: The reference's `size:36` — a UUID with hyphens, and nothing else.
CONVERSATION_ID = Field(default=None, min_length=36, max_length=36)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    conversation_id: str | None = CONVERSATION_ID


class ChatResponse(BaseModel):
    reply: str
    conversation_id: str
    title: str | None
    #: Which tools ran, by name. Shown in the widget so an answer drawn from the
    #: database is visibly distinct from one composed without touching it — the
    #: single most useful thing a reader can know about an assistant's reply.
    tools_used: list[str] = Field(default_factory=list)
    #: Guardrail flags raised on this reply. Empty is the normal case.
    flags: list[str] = Field(default_factory=list)


class FeedbackRequest(BaseModel):
    conversation_id: str | None = CONVERSATION_ID
    helpful: bool
    comment: str | None = Field(default=None, max_length=1000)


class FeedbackResponse(BaseModel):
    id: str
    helpful: bool


class ConversationSummary(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    title: str | None
    created_at: datetime
    updated_at: datetime


class ConversationMessage(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    role: str
    content: str | None
    created_at: datetime


class AssistantAvailability(BaseModel):
    """The one question the widget asks, and the only one it is entitled to.

    Two booleans and nothing about the configuration — the model in use, whether
    a key is present and which read-only control is in force are all answers for
    an administrator, on `/ai/settings`.
    """

    available: bool
    can_use: bool


class AssistantSettings(BaseModel):
    """What the settings screen shows, and what the widget reads to decide whether
    to render at all."""

    enabled: bool
    has_api_key: bool
    model: str
    #: `enabled` AND a key present. The widget reads this one, never `enabled`.
    available: bool
    can_use: bool
    tools: list[str]
    #: True only when a dedicated SELECT-only database role is configured. False
    #: means the read-only *session guard* is the control in force — a real one,
    #: but a weaker one, and the screen says so rather than implying otherwise.
    readonly_dedicated_role: bool
    #: Proven by attempting a write, not asserted.
    readonly_guard_holds: bool


class SetAssistantEnabledRequest(BaseModel):
    enabled: bool
