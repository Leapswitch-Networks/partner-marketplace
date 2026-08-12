import axiosInstance from "./axiosInstance";

/**
 * The AI assistant (LeapDesk parity Module 9).
 *
 * **Two endpoints answer "is it on", and which one you call depends on who you
 * are.** `availability` is for the widget — two booleans, needs only
 * `ai-assistant-use`. `settings` reports the integration's configuration and
 * needs `api-credential-view`. Calling the second from the widget would 403 for
 * every ordinary user.
 */

export interface AssistantAvailability {
  available: boolean;
  can_use: boolean;
}

export interface AssistantSettings {
  enabled: boolean;
  has_api_key: boolean;
  model: string;
  /** `enabled` AND a key present. This is the one that decides anything. */
  available: boolean;
  can_use: boolean;
  tools: string[];
  /** True only when a dedicated SELECT-only database role is configured. */
  readonly_dedicated_role: boolean;
  /** Proven by attempting a write on each request, not asserted. */
  readonly_guard_holds: boolean;
}

export interface ChatReply {
  reply: string;
  conversation_id: string;
  title: string | null;
  /** Which tools ran. Empty means the answer touched no data. */
  tools_used: string[];
  flags: string[];
}

export interface ConversationSummary {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConversationMessage {
  id: string;
  role: string;
  content: string | null;
  created_at: string;
}

export const aiApi = {
  availability: () => axiosInstance.get<AssistantAvailability>("/ai/availability"),

  chat: (message: string, conversation_id?: string | null) =>
    axiosInstance.post<ChatReply>("/ai/chat", {
      message,
      ...(conversation_id ? { conversation_id } : {}),
    }),

  feedback: (helpful: boolean, conversation_id?: string | null, comment?: string) =>
    axiosInstance.post<{ id: string; helpful: boolean }>("/ai/feedback", {
      helpful,
      ...(conversation_id ? { conversation_id } : {}),
      ...(comment ? { comment } : {}),
    }),

  conversations: () => axiosInstance.get<ConversationSummary[]>("/ai/conversations"),

  messages: (id: string) =>
    axiosInstance.get<ConversationMessage[]>(`/ai/conversations/${id}`),

  deleteConversation: (id: string) =>
    axiosInstance.delete<{ message: string }>(`/ai/conversations/${id}`),

  settings: () => axiosInstance.get<AssistantSettings>("/ai/settings"),

  setEnabled: (enabled: boolean) =>
    axiosInstance.put<AssistantSettings>("/ai/settings", { enabled }),
};
