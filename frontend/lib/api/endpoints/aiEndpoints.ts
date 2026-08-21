import { api } from "@/lib/store/api";
import type {
  AssistantAvailability,
  AssistantSettings,
  ChatReply,
} from "@/lib/api/aiApi";

/**
 * The AI assistant — availability, the on/off setting, and asking it something.
 *
 * ## Availability is read by two components and was fetched twice
 *
 * The widget in the top bar asks whether the assistant is usable, and so does the
 * settings screen. Both are mounted on the same page, so opening the dashboard
 * made the same call twice. One cache entry now.
 *
 * ## `chat` is a mutation even though it only reads
 *
 * It takes a message and returns a reply, so nothing is stored from the client's
 * point of view — but it is a POST that costs money and must never be replayed or
 * served from cache. A query keyed on the message would do both: ask the same
 * question twice and the second one comes back instantly from the cache, which for
 * a language model is wrong (the answer is not a function of the question) and
 * hides a real cost. Mutations are fire-once by construction.
 *
 * Feedback is a mutation for the ordinary reason — it writes a row.
 */
export const aiEndpoints = api.injectEndpoints({
  endpoints: (build) => ({
    assistantAvailability: build.query<AssistantAvailability, void>({
      query: () => "/ai/availability",
      providesTags: [{ type: "Assistant", id: "AVAILABILITY" }],
    }),

    assistantSettings: build.query<AssistantSettings, void>({
      query: () => "/ai/settings",
      providesTags: [{ type: "Assistant", id: "SETTINGS" }],
    }),

    setAssistantEnabled: build.mutation<AssistantSettings, boolean>({
      query: (enabled) => ({ url: "/ai/settings", method: "PUT", body: { enabled } }),
      // Availability too: turning the assistant off is exactly what makes the
      // widget in the top bar stop offering itself, and that widget reads
      // availability rather than the setting.
      invalidatesTags: [
        { type: "Assistant", id: "SETTINGS" },
        { type: "Assistant", id: "AVAILABILITY" },
      ],
    }),

    askAssistant: build.mutation<
      ChatReply,
      { message: string; conversation_id?: string | null }
    >({
      query: ({ message, conversation_id }) => ({
        url: "/ai/chat",
        method: "POST",
        body: { message, ...(conversation_id ? { conversation_id } : {}) },
      }),
      // Nothing to invalidate: the reply is rendered directly by whoever asked,
      // and the conversation list is not currently read anywhere.
    }),

    sendAssistantFeedback: build.mutation<
      { id: string; helpful: boolean },
      { helpful: boolean; conversation_id?: string | null; comment?: string }
    >({
      query: ({ helpful, conversation_id, comment }) => ({
        url: "/ai/feedback",
        method: "POST",
        body: {
          helpful,
          ...(conversation_id ? { conversation_id } : {}),
          ...(comment ? { comment } : {}),
        },
      }),
    }),
  }),
});

export const {
  useAssistantAvailabilityQuery,
  useAssistantSettingsQuery,
  useSetAssistantEnabledMutation,
  useAskAssistantMutation,
  useSendAssistantFeedbackMutation,
} = aiEndpoints;
