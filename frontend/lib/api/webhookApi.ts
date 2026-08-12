import axiosInstance from "./axiosInstance";
import type { Paginated } from "@/types";

/**
 * Outbound webhooks (LeapDesk parity Module 14).
 *
 * ⚠️ `create` and `rotateSecret` return the signing secret in plaintext, once.
 * The receiver needs it to verify our HMAC, so unlike an API token it is
 * reproducible on our side — but it is still shown exactly once here. Render it,
 * offer copy, discard on dismiss.
 */

export interface WebhookEndpoint {
  id: string;
  api_consumer_id: string;
  name: string;
  url: string;
  events: string[];
  is_active: boolean;
  last_delivery_at: string | null;
  /** Consecutive failures. Any success resets it. */
  failure_count: number;
  /** Set when the circuit breaker tripped — as distinct from a person switching it off. */
  disabled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WebhookDelivery {
  id: string;
  event: string;
  status: "pending" | "delivered" | "failed";
  response_status: number | null;
  response_body: string | null;
  attempts: number;
  duration_ms: number | null;
  next_attempt_at: string | null;
  delivered_at: string | null;
  failed_at: string | null;
  created_at: string;
}

export interface WebhookEvent {
  name: string;
  description: string;
}

export interface WebhookCreated {
  secret: string;
  warning: string;
  endpoint: WebhookEndpoint;
}

export interface DeliverySummary {
  total: number;
  delivered: number;
  failed: number;
  pending: number;
}

export interface WebhookPayload {
  api_consumer_id: string;
  name: string;
  url: string;
  events: string[];
  is_active?: boolean;
}

export const webhookApi = {
  list: (params: {
    search?: string;
    is_active?: boolean;
    consumer_id?: string;
    sort_by?: string;
    sort_order?: "asc" | "desc";
    page?: number;
    per_page?: number;
  } = {}) => axiosInstance.get<Paginated<WebhookEndpoint>>("/webhooks", { params }),

  events: () => axiosInstance.get<WebhookEvent[]>("/webhooks/events"),

  create: (data: WebhookPayload) =>
    axiosInstance.post<WebhookCreated>("/webhooks", data),

  update: (id: string, data: Partial<WebhookPayload>) =>
    axiosInstance.patch<WebhookEndpoint>(`/webhooks/${id}`, data),

  rotateSecret: (id: string) =>
    axiosInstance.post<WebhookCreated>(`/webhooks/${id}/rotate-secret`),

  remove: (id: string) =>
    axiosInstance.delete<{ message: string }>(`/webhooks/${id}`),

  /** Reaches the endpoint whatever it subscribed to — "can we reach you at all". */
  test: (id: string) => axiosInstance.post<WebhookDelivery>(`/webhooks/${id}/test`),

  deliveries: (id: string) =>
    axiosInstance.get<WebhookDelivery[]>(`/webhooks/${id}/deliveries`),

  summary: (id: string) =>
    axiosInstance.get<DeliverySummary>(`/webhooks/${id}/summary`),

  /** The retry that works today — nothing sweeps for due retries automatically. */
  redeliver: (deliveryId: string) =>
    axiosInstance.post<WebhookDelivery>(`/webhooks/deliveries/${deliveryId}/redeliver`),
};
