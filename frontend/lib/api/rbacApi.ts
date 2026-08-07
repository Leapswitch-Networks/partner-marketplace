import axiosInstance from "./axiosInstance";
import type { AccountType, Invitation, PermissionGroup, Role } from "@/types";

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

export const invitationApi = {
  list: (status?: Invitation["status"]) =>
    axiosInstance.get<Invitation[]>("/invitations", {
      params: status ? { status } : undefined,
    }),

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

  /** Response carries `accept_url` — no mail transport is configured, so send it manually. */
  create: (data: CreateInvitationPayload) =>
    axiosInstance.post<Invitation>("/invitations", data),

  createMany: (invitations: CreateInvitationPayload[]) =>
    axiosInstance.post<Invitation[]>("/invitations/bulk", { invitations }),

  /** Rotates the token, so the previous link stops working. */
  resend: (id: string) =>
    axiosInstance.post<Invitation>(`/invitations/${id}/resend`),

  cancel: (id: string) =>
    axiosInstance.delete<{ message: string }>(`/invitations/${id}`),
};
