import axiosInstance from "./axiosInstance";

/**
 * Global search — the box, and the registry that configures it.
 *
 * Types are declared here rather than in `@/types` for the same reason the other
 * new modules do it: `types/api.d.ts` is generated from `backend/openapi.json`
 * and is not hand-edited. Replace these with the generated schemas next time the
 * OpenAPI export is regenerated (PM-42).
 */

/** One record, already rendered server-side. */
export interface SearchHit {
  id: string;
  title: string;
  subtitle: string | null;
  /** An app-relative path. The API refuses a route template that is not one. */
  url: string;
  icon: string | null;
}

export interface SearchGroup {
  group: string;
  label: string;
  icon: string | null;
  items: SearchHit[];
}

export interface SearchResponse {
  q: string;
  groups: SearchGroup[];
  duration_ms: number;
}

/**
 * `ok` — usable. `degraded` — works, but some configuration was ignored.
 * `broken` — returns nothing at all. Computed server-side against the model
 * allowlist, so the screen cannot disagree with the search about it.
 */
export type EntityHealth = "ok" | "degraded" | "broken";

export interface SearchableEntity {
  id: number;
  /** A model NAME, resolved against an allowlist in code — never imported. */
  model_class: string;
  label: string;
  group: string;
  icon: string | null;
  fields: string[];
  display_template: string;
  subtitle_template: string | null;
  route_name: string;
  route_param_field: string;
  /** Required to search this type at all. Null means any signed-in user. */
  permission: string | null;
  enabled: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  health: EntityHealth;
  /** Why it is not `ok`. A colour alone does not tell anyone what to fix. */
  health_reasons: string[];
}

export interface SearchableEntityPage {
  items: SearchableEntity[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
  can_manage: boolean;
  groups: string[];
  /** The model names an admin may choose. Drives the form's dropdown. */
  available_models: string[];
}

export interface SearchableEntityPayload {
  model_class: string;
  label: string;
  group: string;
  icon: string | null;
  fields: string[];
  display_template: string;
  subtitle_template: string | null;
  route_name: string;
  route_param_field: string;
  permission: string | null;
  enabled: boolean;
  sort_order: number;
}

export interface ListEntitiesParams {
  search?: string;
  group?: string;
  enabled?: boolean;
  sort_by?: string;
  sort_order?: "asc" | "desc";
  page?: number;
  per_page?: number;
}

/** Below this the API returns no groups without touching the database. */
export const MIN_SEARCH_LENGTH = 2;

export const searchApi = {
  /**
   * The search box. Any signed-in user may call it; what comes back is decided
   * per entity by its permission plus row scoping.
   */
  query: (q: string, limit?: number) =>
    axiosInstance.get<SearchResponse>("/search", { params: { q, limit } }),
};

export const searchEntityApi = {
  list: (params: ListEntitiesParams) =>
    axiosInstance.get<SearchableEntityPage>("/settings/search", { params }),

  create: (data: SearchableEntityPayload) =>
    axiosInstance.post<SearchableEntity>("/settings/search", data),

  update: (id: number, data: SearchableEntityPayload) =>
    axiosInstance.put<SearchableEntity>(`/settings/search/${id}`, data),

  /** Include or exclude a type from every user's results. Returns the record. */
  toggle: (id: number) =>
    axiosInstance.post<SearchableEntity>(`/settings/search/${id}/toggle`, {}),

  remove: (id: number) =>
    axiosInstance.delete<{ message: string }>(`/settings/search/${id}`),
};

export default searchApi;
