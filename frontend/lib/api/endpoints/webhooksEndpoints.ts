import { api } from "@/lib/store/api";
import type {
  WebhookCreated,
  WebhookDelivery,
  WebhookEndpoint,
  WebhookEvent,
  WebhookPayload,
} from "@/lib/api/webhookApi";
import type { Paginated } from "@/types";

/**
 * Outbound webhooks as RTK Query endpoints — PM-41 § 4.5.
 *
 * ⚠️ `createWebhook` and `rotateWebhookSecret` return the signing secret in
 * plaintext, once. It is deliberately **not** cached under its own tag: the
 * caller renders it, offers copy, and discards it on dismiss. Giving it a cache
 * entry would leave a live credential sitting in the Redux store — and in the
 * devtools — for the rest of the session.
 *
 * ## The delivery sub-resource
 *
 * A webhook's deliveries are tagged `{ type: "Webhook", id: "<id>-deliveries" }`
 * rather than under the endpoint's own id. They are a separate, much longer read
 * that the index never needs, so a plain row refresh should not drag the history
 * along with it — but `test` and `redeliver` do change both, and each invalidates
 * both explicitly.
 *
 * `redeliver` therefore takes the endpoint id alongside the delivery id, even
 * though the URL needs only the delivery. Without it the mutation could not name
 * the history it just changed, and the modal would show a replayed delivery with
 * its old status — the stale-read-with-no-error case again.
 */
export const webhooksEndpoints = api.injectEndpoints({
  endpoints: (build) => ({
    listWebhooks: build.query<
      Paginated<WebhookEndpoint>,
      {
        search?: string;
        is_active?: boolean;
        consumer_id?: string;
        sort_by?: string;
        sort_order?: "asc" | "desc";
        page?: number;
        per_page?: number;
      } | void
    >({
      query: (params) => ({ url: "/webhooks", params: params ?? {} }),
      providesTags: (result) =>
        result
          ? [
              ...result.items.map((w) => ({ type: "Webhook" as const, id: w.id })),
              { type: "Webhook" as const, id: "LIST" },
            ]
          : [{ type: "Webhook" as const, id: "LIST" }],
    }),

    /**
     * The subscribable event catalogue. Untagged on purpose — it is a build-time
     * constant on the server, so nothing this client does can invalidate it, and
     * the cache entry is what stops every mount refetching it.
     */
    webhookEvents: build.query<WebhookEvent[], void>({
      query: () => "/webhooks/events",
    }),

    createWebhook: build.mutation<WebhookCreated, WebhookPayload>({
      query: (body) => ({ url: "/webhooks", method: "POST", body }),
      invalidatesTags: [{ type: "Webhook", id: "LIST" }],
    }),

    updateWebhook: build.mutation<
      WebhookEndpoint,
      { id: string; data: Partial<WebhookPayload> }
    >({
      query: ({ id, data }) => ({ url: `/webhooks/${id}`, method: "PATCH", body: data }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Webhook", id },
        { type: "Webhook", id: "LIST" },
      ],
    }),

    rotateWebhookSecret: build.mutation<WebhookCreated, string>({
      query: (id) => ({ url: `/webhooks/${id}/rotate-secret`, method: "POST" }),
      invalidatesTags: (_r, _e, id) => [
        { type: "Webhook", id },
        { type: "Webhook", id: "LIST" },
      ],
    }),

    deleteWebhook: build.mutation<{ message: string }, string>({
      query: (id) => ({ url: `/webhooks/${id}`, method: "DELETE" }),
      invalidatesTags: [{ type: "Webhook", id: "LIST" }],
    }),

    /** Reaches the endpoint whatever it subscribed to — "can we reach you at all". */
    testWebhook: build.mutation<WebhookDelivery, string>({
      query: (id) => ({ url: `/webhooks/${id}/test`, method: "POST" }),
      // A test moves `last_delivery_at` and can reset or raise `failure_count`,
      // both of which are columns on the index — and it appends to the history.
      invalidatesTags: (_r, _e, id) => [
        { type: "Webhook", id },
        { type: "Webhook", id: `${id}-deliveries` },
        { type: "Webhook", id: "LIST" },
      ],
    }),

    webhookDeliveries: build.query<WebhookDelivery[], string>({
      query: (id) => `/webhooks/${id}/deliveries`,
      providesTags: (_result, _error, id) => [{ type: "Webhook", id: `${id}-deliveries` }],
    }),

    /** The retry that works today — nothing sweeps for due retries automatically. */
    redeliverWebhook: build.mutation<
      WebhookDelivery,
      { deliveryId: string; endpointId: string }
    >({
      query: ({ deliveryId }) => ({
        url: `/webhooks/deliveries/${deliveryId}/redeliver`,
        method: "POST",
      }),
      invalidatesTags: (_r, _e, { endpointId }) => [
        { type: "Webhook", id: endpointId },
        { type: "Webhook", id: `${endpointId}-deliveries` },
        { type: "Webhook", id: "LIST" },
      ],
    }),
  }),
});

export const {
  useListWebhooksQuery,
  useWebhookEventsQuery,
  useCreateWebhookMutation,
  useUpdateWebhookMutation,
  useRotateWebhookSecretMutation,
  useDeleteWebhookMutation,
  useTestWebhookMutation,
  useWebhookDeliveriesQuery,
  useRedeliverWebhookMutation,
} = webhooksEndpoints;
