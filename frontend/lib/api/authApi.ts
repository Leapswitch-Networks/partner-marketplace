import axiosInstance from "./axiosInstance";
import type { CurrentUser } from "@/types";

/**
 * Auth endpoints.
 *
 * There is ONE login endpoint now — the backend unified `users` and
 * `admin_users`, so `adminLogin` / `whoami` / `adminMe` no longer exist. Roles
 * decide capability, not which table you authenticated against.
 */
export const authApi = {
  /** Partner self-registration. Does NOT sign you in — the account starts INACTIVE. */
  register: (data: {
    first_name: string;
    last_name: string;
    email: string;
    password: string;
    confirm_password: string;
    company_name?: string;
    personal_mobile_number?: string;
    personal_email?: string;
  }) => axiosInstance.post<{ message: string }>("/api/auth/register", data),

  login: (data: { email: string; password: string }) =>
    axiosInstance.post<{ message: string; user: CurrentUser }>("/api/auth/login", data),

  logout: () => axiosInstance.post<{ message: string }>("/api/auth/logout"),

  /** Identity plus resolved roles and permissions. */
  me: () => axiosInstance.get<CurrentUser>("/api/auth/me"),

  updateProfile: (data: {
    first_name?: string;
    last_name?: string;
    designation?: string | null;
    personal_mobile_number?: string | null;
    personal_email?: string | null;
    company_name?: string | null;
    timezone_preference?: string;
  }) => axiosInstance.patch<CurrentUser>("/api/auth/me", data),

  changePassword: (data: {
    current_password: string;
    password: string;
    confirm_password: string;
  }) => axiosInstance.post<{ message: string }>("/api/auth/me/change-password", data),

  forgotPassword: (data: { email: string }) =>
    axiosInstance.post<{ message: string }>("/api/auth/forgot-password", data),

  resetPassword: (data: { token: string; password: string; confirm_password: string }) =>
    axiosInstance.post<{ message: string }>("/api/auth/reset-password", data),

  /** Complete a partner invitation. Signs you in immediately. */
  acceptInvitation: (data: {
    token: string;
    first_name: string;
    last_name: string;
    password: string;
    confirm_password: string;
  }) =>
    axiosInstance.post<{ message: string; user: CurrentUser }>(
      "/api/auth/accept-invitation",
      data
    ),

  /**
   * Where to send the browser to begin Google SSO.
   *
   * Must be a full-page navigation, not an XHR — Google blocks cross-origin
   * AJAX on the consent screen. Use `window.location.href = url`.
   */
  googleAuthorizeUrl: (invitation?: string) =>
    axiosInstance.get<{ authorization_url: string }>("/api/auth/google/authorize", {
      params: invitation ? { invitation } : undefined,
    }),
};
