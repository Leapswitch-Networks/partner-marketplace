import axiosInstance from "./axiosInstance";
import type { CurrentUser } from "@/types";

/** Successful sign-in: a session now exists and the cookies are set. */
export interface LoginSuccess {
  message: string;
  user: CurrentUser;
  two_factor_required?: false;
}

/**
 * Password accepted, second factor outstanding. **No session and no cookie yet.**
 */
export interface TwoFactorRequired {
  two_factor_required: true;
  challenge_token: string;
  message: string;
  recovery_codes_remaining: number;
}

export type LoginResult = LoginSuccess | TwoFactorRequired;

/** Narrowing helper, so no caller has to remember which field to test. */
export function isTwoFactorRequired(result: LoginResult): result is TwoFactorRequired {
  return result.two_factor_required === true;
}

export interface TwoFactorStatus {
  enabled: boolean;
  /** A secret exists but was never confirmed. 2FA is NOT enforced in this state. */
  pending_confirmation: boolean;
  confirmed_at: string | null;
  recovery_codes_remaining: number;
}

export interface TwoFactorEnrolment {
  secret: string;
  /** Feed this to a QR renderer. The backend sends no image on purpose. */
  otpauth_uri: string;
  recovery_codes: string[];
  message: string;
}

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

  /**
   * Sign in. **Two possible shapes**, and the caller must branch on
   * `two_factor_required` rather than assuming a `user` is present.
   *
   * When the account has 2FA enabled the password step succeeds but no session is
   * created and no cookie is set — the response carries a short-lived
   * `challenge_token` to exchange at `twoFactorChallenge`.
   */
  login: (data: { email: string; password: string }) =>
    axiosInstance.post<LoginResult>("/api/auth/login", data),

  /** Exchange a challenge token plus a TOTP **or** a recovery code for a session. */
  twoFactorChallenge: (data: {
    challenge_token: string;
    code?: string;
    recovery_code?: string;
  }) =>
    axiosInstance.post<{ message: string; user: CurrentUser }>(
      "/api/auth/two-factor-challenge",
      data
    ),

  /** Re-prove the password. Required before enabling or disabling 2FA. */
  confirmPassword: (data: { password: string }) =>
    axiosInstance.post<{ message: string }>("/api/auth/me/confirm-password", data),

  twoFactorStatus: () =>
    axiosInstance.get<TwoFactorStatus>("/api/auth/me/two-factor"),

  /** Begin enrolment. Returns the secret and codes **once** — they are not retrievable. */
  enableTwoFactor: () =>
    axiosInstance.post<TwoFactorEnrolment>("/api/auth/me/two-factor"),

  /** Prove a code works. This is what actually turns 2FA on. */
  confirmTwoFactor: (data: { code: string }) =>
    axiosInstance.post<{ message: string }>("/api/auth/me/two-factor/confirm", data),

  disableTwoFactor: () =>
    axiosInstance.delete<{ message: string }>("/api/auth/me/two-factor"),

  regenerateRecoveryCodes: () =>
    axiosInstance.post<{ recovery_codes: string[]; message: string }>(
      "/api/auth/me/two-factor/recovery-codes"
    ),

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
