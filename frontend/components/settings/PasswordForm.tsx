"use client";

import { useState, useRef } from "react";
import useAppSelector from "@/lib/hooks/useAppSelector";
import useAppDispatch from "@/lib/hooks/useAppDispatch";
import { setUser } from "@/lib/store/authSlice";
import { authApi } from "@/lib/api/authApi";
import { extractApiError } from "@/lib/utils/apiError";

const FIELD_CLASS =
  "block w-full rounded-[5px] border-2 border-surface-border bg-white px-3.5 py-2.5 pr-11 text-sm text-gray-900 placeholder-gray-400 shadow-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 dark:border-night-border dark:bg-night-card dark:text-gray-100 dark:placeholder-gray-500";

const LABEL_CLASS =
  "mb-1.5 block text-xs font-semibold text-gray-700 dark:text-gray-300";

function RevealButton({ shown, onClick }: { shown: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      aria-label={shown ? "Hide password" : "Show password"}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-600 dark:hover:text-gray-300">
      {shown ? (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
        </svg>
      ) : (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      )}
    </button>
  );
}

/**
 * Change-password, with LeapDesk's inline OTP recovery.
 *
 * The whole point of the OTP block is the case where the user *cannot* fill in
 * "current password" — a Google-only account, or a partner who has only ever
 * signed in through a recovery flow. So the current-password field disappears
 * entirely once ownership is proved, rather than being left visible and optional.
 *
 * `password_otp_grace` comes from the server on every identity fetch, so the state
 * survives a reload — LeapDesk gets the same effect from a session-backed Inertia
 * prop. Tracking it in local state alone would silently reset the form's shape on
 * refresh while the server still honoured the grace.
 */
export default function PasswordForm() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const grace = user?.password_otp_grace ?? false;
  const isSsoOnly = user?.auth_provider === "google";

  const newPasswordRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({ current_password: "", password: "", confirm_password: "" });
  const [show, setShow] = useState({ current: false, next: false, confirm: false });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [otpOpen, setOtpOpen] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSendOtp = async () => {
    setOtpBusy(true);
    setOtpError(null);
    setNotice(null);
    try {
      const res = await authApi.sendPasswordOtp();
      setOtpSent(true);
      setNotice(res.data.message);
    } catch (err) {
      setOtpError(extractApiError(err, "Could not send the code. Try again shortly."));
    } finally {
      setOtpBusy(false);
    }
  };

  const handleVerifyOtp = async () => {
    setOtpBusy(true);
    setOtpError(null);
    try {
      // Returns the refreshed identity, so `password_otp_grace` lands in the store
      // in the same round trip and the effect above fires.
      const res = await authApi.verifyPasswordOtp({ otp });
      dispatch(setUser(res.data));
      setOtp("");
      setNotice("Verified. Set your new password below.");
      // Collapse the block and move the cursor to what the user must do next.
      // Done here rather than in an effect on `grace`: the transition is known at
      // this exact point, and an effect would also fire on a fresh page load —
      // stealing focus on arrival, which nobody asked for.
      setOtpOpen(false);
      setOtpSent(false);
      newPasswordRef.current?.focus();
    } catch (err) {
      setOtpError(extractApiError(err, "That code was not accepted."));
    } finally {
      setOtpBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await authApi.changePassword({
        // Omitted entirely under grace — the server rejects a blank current
        // password unless it can see the verification itself.
        ...(grace ? {} : { current_password: form.current_password }),
        password: form.password,
        confirm_password: form.confirm_password,
      });
      setForm({ current_password: "", password: "", confirm_password: "" });
      setNotice(res.data.message);
      // The grace is consumed server-side by a successful change; re-fetch so the
      // form goes back to asking for the current password.
      const me = await authApi.me();
      dispatch(setUser(me.data));
    } catch (err) {
      setError(extractApiError(err, "Could not update the password."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-none bg-white ring-1 ring-surface-border dark:bg-night-card dark:ring-night-border">
        <div className="border-b border-surface-border px-6 py-4 dark:border-night-border">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Update password</h3>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            Ensure your account is using a long, random password to stay secure.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-5 px-6 py-5">
            {grace && (
              <div className="flex items-start gap-3 rounded-[5px] border border-tone-success/40 bg-tone-success/10 px-4 py-3 text-sm text-tone-success dark:border-tone-success/50/40 dark:bg-tone-success/20 dark:text-brand-on-dark">
                <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <strong>Email ownership verified.</strong> You can set a new
                  password below without entering the current one.
                </div>
              </div>
            )}

            {notice && !error && (
              <p className="rounded-[5px] bg-tone-success/10 px-3.5 py-2.5 text-sm text-tone-success dark:bg-tone-success/20 dark:text-brand-on-dark">
                {notice}
              </p>
            )}

            {!grace && (
              <div>
                <label htmlFor="current_password" className={LABEL_CLASS}>Current password</label>
                <div className="relative">
                  <input id="current_password" type={show.current ? "text" : "password"}
                    className={FIELD_CLASS} value={form.current_password}
                    onChange={set("current_password")} autoComplete="current-password"
                    required={!isSsoOnly} disabled={isSsoOnly} />
                  <RevealButton shown={show.current} onClick={() => setShow((s) => ({ ...s, current: !s.current }))} />
                </div>
                {isSsoOnly && (
                  <p className="mt-1.5 text-[11px] text-gray-400 dark:text-gray-500">
                    This account signs in with Google and has no password yet. Verify
                    your email below to set one.
                  </p>
                )}
              </div>
            )}

            <div>
              <label htmlFor="password" className={LABEL_CLASS}>New password</label>
              <div className="relative">
                <input id="password" ref={newPasswordRef} type={show.next ? "text" : "password"}
                  className={FIELD_CLASS} value={form.password} onChange={set("password")}
                  autoComplete="new-password" required />
                <RevealButton shown={show.next} onClick={() => setShow((s) => ({ ...s, next: !s.next }))} />
              </div>
            </div>

            <div>
              <label htmlFor="confirm_password" className={LABEL_CLASS}>Confirm password</label>
              <div className="relative">
                <input id="confirm_password" type={show.confirm ? "text" : "password"}
                  className={FIELD_CLASS} value={form.confirm_password}
                  onChange={set("confirm_password")} autoComplete="new-password" required />
                <RevealButton shown={show.confirm} onClick={() => setShow((s) => ({ ...s, confirm: !s.confirm }))} />
              </div>
            </div>

            {error && (
              <p role="alert" className="rounded-[5px] bg-tone-danger/10 px-3.5 py-2.5 text-sm text-tone-danger dark:bg-tone-danger/15 dark:text-tone-danger">
                {error}
              </p>
            )}
          </div>

          <div className="border-t border-surface-border bg-gray-50 px-6 py-4 dark:border-night-border dark:bg-night-card/40">
            <button type="submit" disabled={saving}
              className="inline-flex items-center gap-2 rounded-[5px] bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-50">
              {saving ? "Saving…" : "Save password"}
            </button>
          </div>
        </form>
      </div>

      {/* ── OTP recovery ─────────────────────────────────────────────────────── */}
      {!grace && (
        <div className="overflow-hidden rounded-none bg-white ring-1 ring-surface-border dark:bg-night-card dark:ring-night-border">
          <div className="px-6 py-5">
            {!otpOpen ? (
              <button type="button" onClick={() => setOtpOpen(true)}
                className="text-sm font-medium text-brand dark:text-brand-on-dark transition hover:text-brand hover:underline">
                Don&rsquo;t know your current password?
              </button>
            ) : (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Verify your email instead
                  </h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    We&rsquo;ll email a 6-digit code to{" "}
                    <span className="font-medium text-gray-700 dark:text-gray-300">{user?.email}</span>.
                    Enter it below and you can set a new password without the old one.
                  </p>
                </div>

                <div className="flex flex-wrap items-end gap-3">
                  <button type="button" onClick={handleSendOtp} disabled={otpBusy}
                    className="rounded-[5px] border-2 border-surface-border px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-night-border dark:text-gray-200 dark:hover:bg-gray-800">
                    {otpBusy ? "Working…" : otpSent ? "Resend code" : "Email me a code"}
                  </button>

                  {otpSent && (
                    <>
                      <div>
                        <label htmlFor="otp" className={LABEL_CLASS}>6-digit code</label>
                        <input id="otp" value={otp}
                          onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                          inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                          placeholder="000000"
                          className="w-32 rounded-[5px] border-2 border-surface-border bg-white px-3.5 py-2 text-center font-mono text-sm tracking-widest text-gray-900 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 dark:border-night-border dark:bg-night-card dark:text-gray-100" />
                      </div>
                      <button type="button" onClick={handleVerifyOtp}
                        disabled={otpBusy || otp.length !== 6}
                        className="rounded-[5px] bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white">
                        Verify
                      </button>
                    </>
                  )}
                </div>

                {otpError && (
                  <p role="alert" className="rounded-[5px] bg-tone-danger/10 px-3.5 py-2.5 text-sm text-tone-danger dark:bg-tone-danger/15 dark:text-tone-danger">
                    {otpError}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
