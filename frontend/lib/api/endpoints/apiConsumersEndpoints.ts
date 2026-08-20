import { api } from "@/lib/store/api";
import type {
  Ability,
  ApiConsumer,
  ApiRequestEntry,
  ConsumerPayload,
  ConsumerUsage,
  IssuedToken,
  ListConsumersParams,
} from "@/lib/api/platformApi";
import type { Paginated } from "@/types";

/**
 * The Platform API's governance surface as RTK Query endpoints — PM-41 § 4.5.
 *
 * ⚠️ **`issueToken` returns the only plaintext credential this application ever
 * produces.** It is a mutation and therefore uncached, which is the property that
 * matters here: render it, offer copy, discard on dismiss. It must not reach a
 * cache entry, `localStorage`, or any logging. Do not be tempted to add a query
 * that reads a token back — there is no such endpoint, by design, because the
 * server keeps only a hash.
 *
 * ## Why a token write invalidates the consumer *and* the list
 *
 * `has_live_token` is a column on the index — "registered but cannot call" is a
 * state worth seeing — and it is computed from the tokens. So issuing or revoking
 * a token changes a field on the parent row, which is easy to miss: the token
 * lives in a modal two levels down from the table it silently changes.
 */
export const apiConsumersEndpoints = api.injectEndpoints({
  endpoints: (build) => ({
    listApiConsumers: build.query<Paginated<ApiConsumer>, ListConsumersParams | void>({
      query: (params) => ({ url: "/api-consumers", params: params ?? {} }),
      providesTags: (result) =>
        result
          ? [
              ...result.items.map((c) => ({ type: "ApiConsumer" as const, id: c.id })),
              { type: "ApiConsumer" as const, id: "LIST" },
            ]
          : [{ type: "ApiConsumer" as const, id: "LIST" }],
    }),

    /** The ability catalogue. Server-side constant, so untagged — see `webhookEvents`. */
    apiAbilities: build.query<Ability[], void>({
      query: () => "/api-consumers/abilities",
    }),

    getApiConsumer: build.query<ApiConsumer, string>({
      query: (id) => `/api-consumers/${id}`,
      providesTags: (_result, _error, id) => [{ type: "ApiConsumer", id }],
    }),

    createApiConsumer: build.mutation<ApiConsumer, ConsumerPayload>({
      query: (body) => ({ url: "/api-consumers", method: "POST", body }),
      invalidatesTags: [{ type: "ApiConsumer", id: "LIST" }],
    }),

    updateApiConsumer: build.mutation<
      ApiConsumer,
      { id: string; data: Partial<ConsumerPayload> }
    >({
      query: ({ id, data }) => ({
        url: `/api-consumers/${id}`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: "ApiConsumer", id },
        { type: "ApiConsumer", id: "LIST" },
      ],
    }),

    /** The kill switch. Takes effect on the consumer's next call. */
    setApiConsumerActive: build.mutation<ApiConsumer, { id: string; active: boolean }>({
      query: ({ id, active }) => ({
        url: `/api-consumers/${id}/toggle`,
        method: "POST",
        body: { active },
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: "ApiConsumer", id },
        { type: "ApiConsumer", id: "LIST" },
      ],
    }),

    deleteApiConsumer: build.mutation<{ message: string }, string>({
      query: (id) => ({ url: `/api-consumers/${id}`, method: "DELETE" }),
      invalidatesTags: [
        { type: "ApiConsumer", id: "LIST" },
        // A consumer owns its webhooks, so removing it removes those too.
        { type: "Webhook", id: "LIST" },
      ],
    }),

    issueApiToken: build.mutation<
      IssuedToken,
      { id: string; name: string; abilities: string[]; expires_in_days: number | null }
    >({
      query: ({ id, ...body }) => ({
        url: `/api-consumers/${id}/tokens`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: "ApiConsumer", id },
        // `has_live_token` is an index column computed from this.
        { type: "ApiConsumer", id: "LIST" },
      ],
    }),

    revokeApiToken: build.mutation<{ message: string }, { id: string; tokenId: string }>({
      query: ({ id, tokenId }) => ({
        url: `/api-consumers/${id}/tokens/${tokenId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: "ApiConsumer", id },
        { type: "ApiConsumer", id: "LIST" },
      ],
    }),

    apiConsumerUsage: build.query<ConsumerUsage, string>({
      query: (id) => `/api-consumers/${id}/usage`,
      providesTags: (_result, _error, id) => [{ type: "ApiConsumer", id: `${id}-usage` }],
    }),

    apiConsumerRequests: build.query<ApiRequestEntry[], string>({
      query: (id) => `/api-consumers/${id}/requests`,
      providesTags: (_result, _error, id) => [{ type: "ApiConsumer", id: `${id}-requests` }],
    }),
  }),
});

export const {
  useListApiConsumersQuery,
  useApiAbilitiesQuery,
  useGetApiConsumerQuery,
  useCreateApiConsumerMutation,
  useUpdateApiConsumerMutation,
  useSetApiConsumerActiveMutation,
  useDeleteApiConsumerMutation,
  useIssueApiTokenMutation,
  useRevokeApiTokenMutation,
  useApiConsumerUsageQuery,
  useApiConsumerRequestsQuery,
} = apiConsumersEndpoints;
