import axiosInstance from "./axiosInstance";
import type { AccountType, Paginated, Invitation, InvitationCreated, PermissionGroup, Role } from "@/types";

/** Roles, the permission catalog, and invitations. */

export interface CreateRolePayload {
  name: string;
  display_name: string;
  description?: string | null;
  permission_ids?: number[];
}

export interface UpdateRolePayload {
  display_name?: string;
  description?: string | null;
  /** REPLACES the role's permissions when sent. Omit to leave them; `[]` clears them. */
  permission_ids?: number[];
}

export interface ClonePayload {
  name: string;
  display_name?: string | null;
  description?: string | null;
}

export interface NavSectionOption {
  key: string;
  label: string;
  collapsible: boolean;
}

export interface RoleUserItem {
  id: string;
  full_name: string;
  email: string;
  status: string;
  account_type: string;
}

export interface MatrixGroupCell {
  group_id: number;
  granted: number;
  total: number;
}

export interface MatrixRow {
  role_id: number;
  role_name: string;
  display_name: string;
  is_system: boolean;
  cells: MatrixGroupCell[];
}

export interface RoleMatrix {
  groups: PermissionGroup[];
  rows: MatrixRow[];
}

export const roleApi = {
  list: () => axiosInstance.get<Role[]>("/roles"),
  get: (id: number) => axiosInstance.get<Role>(`/roles/${id}`),
  create: (data: CreateRolePayload) => axiosInstance.post<Role>("/roles", data),
  update: (id: number, data: UpdateRolePayload) =>
    axiosInstance.patch<Role>(`/roles/${id}`, data),
  remove: (id: number) =>
    axiosInstance.delete<{ message: string }>(`/roles/${id}`),
  users: (id: number) => axiosInstance.get<RoleUserItem[]>(`/roles/${id}/users`),

  /**
   * Per-role sidebar preferences. `collapsible` is the stored value itself, not
   * a capability flag — it says whether that section renders collapsed for this
   * role. The response always carries the FULL catalog, so the UI never needs to
   * know the defaults.
   */
  navPreferences: (id: number) =>
    axiosInstance.get<{ sections: NavSectionOption[] }>(`/roles/${id}/nav-preferences`),
  setNavPreferences: (id: number, preferences: Record<string, { collapsible: boolean }>) =>
    axiosInstance.post<{ sections: NavSectionOption[] }>(
      `/roles/${id}/nav-preferences`,
      { preferences }
    ),
  clone: (id: number, data: ClonePayload) =>
    axiosInstance.post<Role>(`/roles/${id}/clone`, data),
};

export const matrixApi = {
  get: () => axiosInstance.get<RoleMatrix>("/roles/matrix"),
  setCell: (role_id: number, group_id: number, granted: boolean) =>
    axiosInstance.post<Role>("/roles/matrix/cell", { role_id, group_id, granted }),
};

export const permissionApi = {
  /** Grouped and ordered, ready to render as checkbox sections. */
  list: () => axiosInstance.get<PermissionGroup[]>("/permissions"),
};

export interface CreateInvitationPayload {
  email: string;
  role_id?: number | null;
  account_type?: AccountType;
  note?: string | null;
}

export interface ActivityEntry {
  id: number;
  log_name: string | null;
  description: string;
  event: string | null;
  subject_type: string | null;
  subject_id: string | null;
  causer_id: string | null;
  /** Resolved name for `causer_id`. Null means an unauthenticated actor. */
  causer_name: string | null;
  properties: Record<string, unknown> | null;
  batch_uuid: string | null;
  created_at: string;
}

export interface ActivityFilters {
  log_name?: string;
  event?: string;
  subject_type?: string;
  causer_id?: string;
  search?: string;
  page?: number;
  per_page?: number;
}

/**
 * The audit trail (PM-32). **Read-only — there is no write method here, and none
 * on the server either.** An audit trail a privileged user can edit is not
 * evidence of anything.
 */
export const activityApi = {
  list: (params: ActivityFilters = {}) =>
    axiosInstance.get<{
      items: ActivityEntry[];
      total: number;
      page: number;
      per_page: number;
      pages: number;
    }>("/activity", { params }),

  /** Event names present in the data, for the filter dropdown. */
  events: () => axiosInstance.get<string[]>("/activity/events"),
};

export interface ListInvitationsParams {
  status?: Invitation["status"];
  account_type?: AccountType;
  /** Matches email or note. */
  search?: string;
  sort_by?: string;
  sort_order?: "asc" | "desc";
  page?: number;
  per_page?: number;
}

export const invitationApi = {
  /** Returns the shared `Page` envelope, as of the 2026-08-07 pagination change. */
  list: (params: ListInvitationsParams = {}) =>
    axiosInstance.get<Paginated<Invitation>>("/invitations", { params }),

  /**
   * Unauthenticated — the invitee has a token but no account yet.
   * Used by the acceptance page before the user commits.
   */
  preview: (token: string) =>
    axiosInstance.get<{
      email: string;
      role_name: string | null;
      account_type: AccountType;
      expires_at: string;
      requires_google: boolean;
    }>("/invitations/preview", { params: { token } }),

  /**
   * `accept_url` comes back only when no email was delivered — check
   * `email_sent` to tell "we sent it" from "send this yourself". The older
   * comment here said no mail transport was configured; that stopped being true
   * with PM-27.
   */
  create: (data: CreateInvitationPayload) =>
    axiosInstance.post<InvitationCreated>("/invitations", data),

  createMany: (invitations: CreateInvitationPayload[]) =>
    axiosInstance.post<InvitationCreated[]>("/invitations/bulk", { invitations }),

  /** Rotates the token, so the previous link stops working. */
  /** Counts by status. Own endpoint — the list is paginated, so page rows would undercount. */
  stats: () =>
    axiosInstance.get<{ pending: number; accepted: number; expired: number; cancelled: number }>(
      "/invitations/stats"
    ),

  /**
   * Rotates the token and extends the expiry. 429 if resent within 60 seconds,
   * which is a per-invitation cooldown distinct from the per-IP rate limit.
   */
  resend: (id: string) =>
    axiosInstance.post<InvitationCreated>(`/invitations/${id}/resend`),

  cancel: (id: string) =>
    axiosInstance.delete<{ message: string }>(`/invitations/${id}`),
};
