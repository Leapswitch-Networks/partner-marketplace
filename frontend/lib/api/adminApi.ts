import axiosInstance from "./axiosInstance";
import type {
  AccountType,
  ManagedUser,
  ManagedUserDetail,
  Paginated,
  UserStatus,
} from "@/types";

/**
 * User administration.
 *
 * Repointed from the removed `/admin/*` routes to `/users`, which are
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

export interface SendUserEmailPayload {
  subject: string;
  message: string;
  bcc_sender?: boolean;
}

export interface SendUserEmailResult {
  sent: boolean;
  message: string;
}

export const adminApi = {
  listUsers: (params: ListUsersParams = {}) =>
    axiosInstance.get<Paginated<ManagedUser>>("/users", { params }),

  // UserDetailResponse, not UserListItem — see the note on ManagedUserDetail.
  getUser: (id: string) => axiosInstance.get<ManagedUserDetail>(`/users/${id}`),

  createUser: (data: CreateUserPayload) =>
    axiosInstance.post<ManagedUser>("/users", data),

  updateUser: (id: string, data: UpdateUserPayload) =>
    axiosInstance.patch<ManagedUser>(`/users/${id}`, data),

  deleteUser: (id: string) =>
    axiosInstance.delete<{ message: string }>(`/users/${id}`),

  /** Activate a pending account — the gate Google SSO does not open. */
  approveUser: (id: string) =>
    axiosInstance.post<ManagedUser>(`/users/${id}/approve`),

  toggleStatus: (id: string) =>
    axiosInstance.post<ManagedUser>(`/users/${id}/toggle-status`),

  /** Clear a failed-login lockout without waiting for it to lapse. */
  unlockUser: (id: string) =>
    axiosInstance.post<ManagedUser>(`/users/${id}/unlock`),

  /**
   * Clear a user's 2FA enrolment so they can sign in and set it up again.
   *
   * The support path for a lost phone with no recovery codes left. Also revokes
   * every session the account has, server-side — if the phone was stolen rather
   * than lost, clearing only the secret would strip the second factor and leave
   * the attacker signed in.
   */
  /** Ad-hoc message to a user. 200 with `sent: false` means delivery failed. */
  sendEmail: (id: string, data: SendUserEmailPayload) =>
    axiosInstance.post<SendUserEmailResult>(`/users/${id}/email`, data),

  resetTwoFactor: (id: string) =>
    axiosInstance.post<ManagedUser>(`/users/${id}/reset-two-factor`),

  bulkDelete: (user_ids: string[]) =>
    axiosInstance.post<BulkActionResult>("/users/bulk-delete", { user_ids }),

  bulkStatus: (user_ids: string[], status: UserStatus) =>
    axiosInstance.post<BulkActionResult>("/users/bulk-status", { user_ids, status }),
};
