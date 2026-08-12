import axiosInstance from "./axiosInstance";
import type { Paginated } from "@/types";

/**
 * The Platform API's governance surface (LeapDesk parity Module 10).
 *
 * **Not `credentialApi`, and the two must not be merged.** That one manages
 * secrets belonging to *other people*, encrypted so we can send them; this one
 * manages our own, hashed so nobody can read them back. They both contain the
 * word "API" and that is the whole of what they have in common.
 *
 * ⚠️ `issueToken` returns the only plaintext credential this application ever
 * produces. **Render it, offer copy, discard it on dismiss.** It must not reach
 * Redux, `localStorage`, or any logging.
 */

export interface ApiToken {
  id: string;
  name: string;
  /** `pmp_a1b2c3d4` — identifies the credential, is useless as one. */
  prefix: string;
  abilities: string[];
  expires_at: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface ApiConsumer {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  owner_name: string | null;
  owner_email: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  tokens: ApiToken[];
  /** Registered but holding no live token — it cannot call, and it is not disabled. */
  has_live_token: boolean;
}

export interface Ability {
  name: string;
  label: string;
  group: string;
  sensitivity: "low" | "medium" | "high";
  description: string;
}

export interface ConsumerPayload {
  name: string;
  slug: string;
  description?: string | null;
  owner_name?: string | null;
  owner_email: string;
  active?: boolean;
}

export interface IssuedToken {
  token: string;
  warning: string;
  detail: ApiToken;
}

export interface ConsumerUsage {
  total: number;
  rejected: number;
  last_called_at: string | null;
}

export interface ApiRequestEntry {
  id: number;
  method: string;
  path: string;
  status_code: number;
  outcome: string | null;
  token_prefix: string | null;
  ip: string | null;
  duration_ms: number | null;
  created_at: string;
}

export interface ListConsumersParams {
  search?: string;
  active?: boolean;
  has_tokens?: boolean;
  sort_by?: string;
  sort_order?: "asc" | "desc";
  page?: number;
  per_page?: number;
}

export const platformApi = {
  list: (params: ListConsumersParams = {}) =>
    axiosInstance.get<Paginated<ApiConsumer>>("/api-consumers", { params }),

  abilities: () => axiosInstance.get<Ability[]>("/api-consumers/abilities"),

  get: (id: string) => axiosInstance.get<ApiConsumer>(`/api-consumers/${id}`),

  create: (data: ConsumerPayload) =>
    axiosInstance.post<ApiConsumer>("/api-consumers", data),

  update: (id: string, data: Partial<ConsumerPayload>) =>
    axiosInstance.patch<ApiConsumer>(`/api-consumers/${id}`, data),

  /** The kill switch. Takes effect on the consumer's next call. */
  setActive: (id: string, active: boolean) =>
    axiosInstance.post<ApiConsumer>(`/api-consumers/${id}/toggle`, { active }),

  remove: (id: string) =>
    axiosInstance.delete<{ message: string }>(`/api-consumers/${id}`),

  issueToken: (
    id: string,
    data: { name: string; abilities: string[]; expires_in_days: number | null }
  ) => axiosInstance.post<IssuedToken>(`/api-consumers/${id}/tokens`, data),

  revokeToken: (id: string, tokenId: string) =>
    axiosInstance.delete<{ message: string }>(`/api-consumers/${id}/tokens/${tokenId}`),

  usage: (id: string) => axiosInstance.get<ConsumerUsage>(`/api-consumers/${id}/usage`),

  requests: (id: string) =>
    axiosInstance.get<ApiRequestEntry[]>(`/api-consumers/${id}/requests`),
};
