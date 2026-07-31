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

export const roleApi = {
  list: () => axiosInstance.get<Role[]>("/api/roles"),
  get: (id: number) => axiosInstance.get<Role>(`/api/roles/${id}`),
  create: (data: CreateRolePayload) => axiosInstance.post<Role>("/api/roles", data),
  update: (id: number, data: UpdateRolePayload) =>
    axiosInstance.patch<Role>(`/api/roles/${id}`, data),
  remove: (id: number) =>
    axiosInstance.delete<{ message: string }>(`/api/roles/${id}`),
};

export const permissionApi = {
  /** Grouped and ordered, ready to render as checkbox sections. */
  list: () => axiosInstance.get<PermissionGroup[]>("/api/permissions"),
};

export interface CreateInvitationPayload {
  email: string;
  role_id?: number | null;
  account_type?: AccountType;
  note?: string | null;
}

export const invitationApi = {
  list: (status?: Invitation["status"]) =>
    axiosInstance.get<Invitation[]>("/api/invitations", {
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
    }>("/api/invitations/preview", { params: { token } }),

  /** Response carries `accept_url` — no mail transport is configured, so send it manually. */
  create: (data: CreateInvitationPayload) =>
    axiosInstance.post<Invitation>("/api/invitations", data),

  createMany: (invitations: CreateInvitationPayload[]) =>
    axiosInstance.post<Invitation[]>("/api/invitations/bulk", { invitations }),

  /** Rotates the token, so the previous link stops working. */
  resend: (id: string) =>
    axiosInstance.post<Invitation>(`/api/invitations/${id}/resend`),

  cancel: (id: string) =>
    axiosInstance.delete<{ message: string }>(`/api/invitations/${id}`),
};
