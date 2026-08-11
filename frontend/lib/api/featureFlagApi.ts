import axiosInstance from "./axiosInstance";

/**
 * Feature flags — staged rollout without a code change.
 *
 * Types are declared here rather than in `@/types` for the same reason the Data
 * Access client does it: `types/api.d.ts` is generated from `backend/openapi.json`
 * and is not hand-edited. When the OpenAPI export is next regenerated these
 * should be replaced by the generated `components["schemas"]["FeatureFlagResponse"]`
 * and friends (PM-42) — this is a staging post, not a second source of truth.
 */

export interface FeatureFlag {
  id: number;
  /** What the code checks. Changing it breaks every existing check. */
  key: string;
  name: string;
  description: string | null;
  enabled: boolean;
  /**
   * `null` and `[]` both mean "no restriction on this axis" — the API normalises
   * writes to `null`, but a row written by hand may hold either. Never branch on
   * which one it is; use `targets_everyone`.
   */
  target_roles: string[] | null;
  target_user_ids: string[] | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  /** Computed server-side so every client renders "Everyone" on the same rule. */
  targets_everyone: boolean;
}

export interface FeatureFlagPage {
  items: FeatureFlag[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
  /** From the same permission constant the write routes are guarded on. */
  can_manage: boolean;
}

export interface RoleOption {
  id: number;
  /** Targeting stores this, not the id. */
  name: string;
  display_name: string;
}

export interface UserOption {
  id: string;
  name: string;
  email: string;
}

export interface FeatureFlagOptions {
  roles: RoleOption[];
  /** ACTIVE users only. */
  users: UserOption[];
}

/**
 * Create and update share one body — the write is a full replace in both
 * directions, because a partial update of a target *set* has no honest meaning:
 * omitting `target_roles` would be indistinguishable from clearing it.
 */
export interface FeatureFlagPayload {
  key: string;
  name: string;
  description: string | null;
  enabled: boolean;
  target_roles: string[];
  target_user_ids: string[];
}

export interface ListFlagsParams {
  search?: string;
  enabled?: boolean;
  /** Allowlisted server-side: name, key, enabled, created_at, updated_at. */
  sort_by?: string;
  sort_order?: "asc" | "desc";
  page?: number;
  per_page?: number;
}

const BASE = "/settings/feature-flags";

export const featureFlagApi = {
  list: (params: ListFlagsParams) =>
    axiosInstance.get<FeatureFlagPage>(BASE, { params }),

  /** Targeting pickers. Fetched once on mount, not per keystroke. */
  options: () => axiosInstance.get<FeatureFlagOptions>(`${BASE}/options`),

  get: (id: number) => axiosInstance.get<FeatureFlag>(`${BASE}/${id}`),

  create: (data: FeatureFlagPayload) =>
    axiosInstance.post<FeatureFlag>(BASE, data),

  update: (id: number, data: FeatureFlagPayload) =>
    axiosInstance.put<FeatureFlag>(`${BASE}/${id}`, data),

  /**
   * Flips `enabled` and returns the updated record, so the caller patches the
   * row in place instead of refetching what the response already holds.
   */
  toggle: (id: number) => axiosInstance.post<FeatureFlag>(`${BASE}/${id}/toggle`, {}),

  remove: (id: number) =>
    axiosInstance.delete<{ message: string }>(`${BASE}/${id}`),
};

export default featureFlagApi;
