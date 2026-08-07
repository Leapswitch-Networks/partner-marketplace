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

export interface SessionInfo {
  id: string;
  ip_address: string | null;
  /** Untrusted self-reported text. Display only — never drive a decision on it. */
  user_agent: string | null;
  created_at: string;
  last_seen_at: string;
  /** The session making the request. The UI labels it instead of offering sign-out. */
  is_current: boolean;
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
  }) => axiosInstance.post<{ message: string }>("/auth/register", data),

  /**
   * Sign in. **Two possible shapes**, and the caller must branch on
   * `two_factor_required` rather than assuming a `user` is present.
   *
   * When the account has 2FA enabled the password step succeeds but no session is
   * created and no cookie is set — the response carries a short-lived
   * `challenge_token` to exchange at `twoFactorChallenge`.
   */
  login: (data: { email: string; password: string; remember_me?: boolean }) =>
    axiosInstance.post<LoginResult>("/auth/login", data),

  /** Exchange a challenge token plus a TOTP **or** a recovery code for a session. */
  twoFactorChallenge: (data: {
    challenge_token: string;
    code?: string;
    recovery_code?: string;
    /** Carried from the sign-in form — the session is created here, not at /login. */
    remember_me?: boolean;
  }) =>
    axiosInstance.post<{ message: string; user: CurrentUser }>(
      "/auth/two-factor-challenge",
      data
    ),

  /** Re-prove the password. Required before enabling or disabling 2FA. */
  confirmPassword: (data: { password: string }) =>
    axiosInstance.post<{ message: string }>("/auth/me/confirm-password", data),

  /** The caller's own live sessions, newest activity first. */
  listSessions: () => axiosInstance.get<SessionInfo[]>("/auth/me/sessions"),

  /** End one of your own sessions. 404 if the id is not yours. */
  revokeSession: (id: string) =>
    axiosInstance.delete<{ message: string }>(`/auth/me/sessions/${id}`),

  /** End every session except the current one. */
  revokeOtherSessions: () =>
    axiosInstance.post<{ message: string }>("/auth/me/sessions/revoke-others"),

  twoFactorStatus: () =>
    axiosInstance.get<TwoFactorStatus>("/auth/me/two-factor"),

  /** Begin enrolment. Returns the secret and codes **once** — they are not retrievable. */
  enableTwoFactor: () =>
    axiosInstance.post<TwoFactorEnrolment>("/auth/me/two-factor"),

  /** Prove a code works. This is what actually turns 2FA on. */
  confirmTwoFactor: (data: { code: string }) =>
    axiosInstance.post<{ message: string }>("/auth/me/two-factor/confirm", data),

  disableTwoFactor: () =>
    axiosInstance.delete<{ message: string }>("/auth/me/two-factor"),

  regenerateRecoveryCodes: () =>
    axiosInstance.post<{ recovery_codes: string[]; message: string }>(
      "/auth/me/two-factor/recovery-codes"
    ),

  logout: () => axiosInstance.post<{ message: string }>("/auth/logout"),

  /** Identity plus resolved roles and permissions. */
  me: () => axiosInstance.get<CurrentUser>("/auth/me"),

  updateProfile: (data: {
    first_name?: string;
    last_name?: string;
    designation?: string | null;
    employee_id?: string | null;
    personal_mobile_number?: string | null;
    personal_email?: string | null;
    company_name?: string | null;
    timezone_preference?: string;
  }) => axiosInstance.patch<CurrentUser>("/auth/me", data),

  /**
   * `current_password` is omitted only when the user has verified an OTP —
   * `password_otp_grace` on the current user says whether that is the case. The
   * server re-checks regardless, so omitting it without grace is a 400.
   */
  changePassword: (data: {
    current_password?: string;
    password: string;
    confirm_password: string;
  }) => axiosInstance.post<{ message: string }>("/auth/me/change-password", data),

  /**
   * Email a 6-digit code to the signed-in user's own address so they can change
   * their password without knowing the current one. 429 while the 60-second
   * cooldown is in force.
   */
  sendPasswordOtp: () =>
    axiosInstance.post<{ message: string }>("/auth/me/password-otp/send"),

  /**
   * Verify the code. Returns the refreshed user so `password_otp_grace` is
   * picked up in the same round trip.
   */
  verifyPasswordOtp: (data: { otp: string }) =>
    axiosInstance.post<CurrentUser>("/auth/me/password-otp/verify", data),

  forgotPassword: (data: { email: string }) =>
    axiosInstance.post<{ message: string }>("/auth/forgot-password", data),

  /** Confirm an address from an emailed link. Idempotent — a second click is fine. */
  verifyEmail: (data: { token: string }) =>
    axiosInstance.post<{ message: string }>("/auth/verify-email", data),

  /**
   * Request a fresh verification link.
   *
   * Answers identically whether the address exists, is already verified, or the
   * send failed — so the UI must not try to report which happened.
   */
  resendVerification: (data: { email: string }) =>
    axiosInstance.post<{ message: string }>("/auth/resend-verification", data),

  resetPassword: (data: { token: string; password: string; confirm_password: string }) =>
    axiosInstance.post<{ message: string }>("/auth/reset-password", data),

  /** Complete a partner invitation. Signs you in immediately. */
  acceptInvitation: (data: {
    token: string;
    first_name: string;
    last_name: string;
    password: string;
    confirm_password: string;
  }) =>
    axiosInstance.post<{ message: string; user: CurrentUser }>(
      "/auth/accept-invitation",
      data
    ),

  /**
   * Where to send the browser to begin Google SSO.
   *
   * Must be a full-page navigation, not an XHR — Google blocks cross-origin
   * AJAX on the consent screen. Use `window.location.href = url`.
   */
  googleAuthorizeUrl: (invitation?: string) =>
    axiosInstance.get<{ authorization_url: string }>("/auth/google/authorize", {
      params: invitation ? { invitation } : undefined,
    }),
};
