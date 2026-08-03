import axiosInstance from "./axiosInstance";
import type { AccountType, ManagedUser, Paginated, UserStatus } from "@/types";

/**
 * User administration.
 *
 * Repointed from the removed `/api/admin/*` routes to `/api/users`, which are
 * permission-gated (`user-view` / `user-create` / `user-update` / `user-delete`
 * / `user-approve`) rather than merely authenticated.
 */

export interface ListUsersParams {
  search?: string;
  status?: UserStatus;
  account_type?: AccountType;
  role_id?: number;
  sort_by?: string;
  sort_order?: "asc" | "desc";
  page?: number;
  per_page?: number;
}

export interface CreateUserPayload {
  first_name: string;
  last_name: string;
  email: string;
  /** Omit for an SSO-only staff account — the account then has no password. */
  password?: string;
  account_type?: AccountType;
  status?: UserStatus;
  role_ids?: number[];
  designation?: string | null;
  employee_id?: string | null;
  personal_mobile_number?: string | null;
  personal_email?: string | null;
  company_name?: string | null;
  timezone_preference?: string;
}

/** Partial — only the fields you send are applied. */
export type UpdateUserPayload = Partial<CreateUserPayload>;

export interface BulkActionResult {
  requested: number;
  affected: number;
  skipped: number;
  /** Why each skipped row was skipped — surface these, don't swallow them. */
  skipped_reasons: string[];
  message: string;
}

export const adminApi = {
  listUsers: (params: ListUsersParams = {}) =>
    axiosInstance.get<Paginated<ManagedUser>>("/api/users", { params }),

  getUser: (id: string) => axiosInstance.get<ManagedUser>(`/api/users/${id}`),

  createUser: (data: CreateUserPayload) =>
    axiosInstance.post<ManagedUser>("/api/users", data),

  updateUser: (id: string, data: UpdateUserPayload) =>
    axiosInstance.patch<ManagedUser>(`/api/users/${id}`, data),

  deleteUser: (id: string) =>
    axiosInstance.delete<{ message: string }>(`/api/users/${id}`),

  /** Activate a pending account — the gate Google SSO does not open. */
  approveUser: (id: string) =>
    axiosInstance.post<ManagedUser>(`/api/users/${id}/approve`),

  toggleStatus: (id: string) =>
    axiosInstance.post<ManagedUser>(`/api/users/${id}/toggle-status`),

  /** Clear a failed-login lockout without waiting for it to lapse. */
  unlockUser: (id: string) =>
    axiosInstance.post<ManagedUser>(`/api/users/${id}/unlock`),

  bulkDelete: (user_ids: string[]) =>
    axiosInstance.post<BulkActionResult>("/api/users/bulk-delete", { user_ids }),

  bulkStatus: (user_ids: string[], status: UserStatus) =>
    axiosInstance.post<BulkActionResult>("/api/users/bulk-status", { user_ids, status }),
};
