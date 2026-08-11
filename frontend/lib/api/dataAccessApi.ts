import axiosInstance from "./axiosInstance";

/**
 * Data Access — delegated "who may see or manage whose records".
 *
 * ## Why the types are declared here and not in `@/types`
 *
 * `types/api.d.ts` is generated from `backend/openapi.json` and is not hand-edited,
 * and `types/index.ts` is shared surface owned elsewhere. These shapes are
 * consumed by exactly one module, so they live next to the client that produces
 * them. When the OpenAPI export is next regenerated these should be replaced by
 * the generated `components["schemas"]["DataAccessGrantResponse"]` and friends —
 * that is the house direction (PM-42), not a second source of truth to keep.
 *
 * ## The endpoint is `/data-access`, not `/roles/data-access`
 *
 * The reference mounts it under Roles and warns that the route must be declared
 * before `roles/{role}` or the wildcard swallows it. Ours is a top-level prefix,
 * so the ordering hazard does not exist. The grants are user-to-user; only the
 * *screen* belongs with Roles.
 */

/** One side of a grant. Mirrors the reference's `userLabel()`. */
export interface GrantParty {
  id: string;
  name: string;
  email: string;
}

export interface DataAccessGrant {
  id: string;
  grantee: GrantParty;
  subject: GrantParty;
  scope: string;
  /** Resolved server-side, so the table never renders a bare `*`. */
  scope_label: string;
  access_level: AccessLevel;
  /** Null once the granting account is deleted — the grant outlives them. */
  granted_by: string | null;
  created_at: string;
}

export type AccessLevel = "view" | "manage";

export interface DataAccessPage {
  items: DataAccessGrant[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
  /**
   * Computed by the API from the same permission constant the write routes are
   * guarded on. Preferred over a client-side `can("data-access-manage")` for
   * gating write controls: one authority, so the button and the guard cannot
   * drift apart.
   */
  can_manage: boolean;
}

export interface ScopeOption {
  value: string;
  label: string;
}

export interface DataAccessOptions {
  /** ACTIVE users only — `create_grant` refuses any other status. */
  users: GrantParty[];
  scopes: ScopeOption[];
}

export interface CreateGrantPayload {
  grantee_id: string;
  /** One grantee, many subjects. Each pair is upserted on `(grantee, subject, scope)`. */
  subject_ids: string[];
  scope: string;
  access_level: AccessLevel;
}

export interface CreateGrantResult {
  /** Pairs written **or updated** — the write is an upsert. */
  created: number;
  skipped: number;
  /** Self-grant pairs the batch stepped over. Surfaced, never dropped. */
  skipped_reasons: string[];
  message: string;
}

export interface ListGrantsParams {
  /** Matches either party's first name, last name, email, or full name. */
  search?: string;
  scope?: string;
  access_level?: AccessLevel;
  /** Allowlisted server-side: `scope`, `access_level`, `created_at`. */
  sort_by?: string;
  sort_order?: "asc" | "desc";
  page?: number;
  per_page?: number;
}

export const dataAccessApi = {
  list: (params: ListGrantsParams) =>
    axiosInstance.get<DataAccessPage>("/data-access", { params }),

  /** Pickers for the create form. Fetched once on mount, not per keystroke. */
  options: () => axiosInstance.get<DataAccessOptions>("/data-access/options"),

  create: (data: CreateGrantPayload) =>
    axiosInstance.post<CreateGrantResult>("/data-access", data),

  remove: (id: string) =>
    axiosInstance.delete<{ message: string }>(`/data-access/${id}`),
};

export default dataAccessApi;
