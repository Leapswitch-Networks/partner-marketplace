"use client";

import { useCallback, useEffect, useState } from "react";
import Badge from "@/components/common/Badge";
import Button from "@/components/common/Button";
import Input from "@/components/common/Input";
import Modal from "@/components/common/Modal";
import { extractApiError } from "@/lib/utils/apiError";
import {
  authApi,
  type TwoFactorEnrolment,
  type TwoFactorStatus,
} from "@/lib/api/authApi";

/**
 * Enable, confirm, disable and re-key two-factor authentication.
 *
 * Mirrors the backend's three states, because collapsing them into an on/off
 * switch is how a user ends up locked out: a stored-but-unconfirmed secret means
 * enrolment was started and abandoned, and 2FA is **not** being enforced. That
 * state gets its own badge and its own call to action rather than reading as "on".
 *
 * **No QR image, deliberately.** The backend returns an `otpauth://` URI and no
 * picture, and rendering one here would mean adding a QR library to a project
 * where `npm ci` is already broken on a peer-dependency conflict (PM-25). What is
 * offered instead works everywhere: the URI as a link, which opens the
 * authenticator directly on mobile, plus the secret formatted for the manual-entry
 * field that every authenticator app has. A QR is a nicety on top of that, and is
 * noted as follow-up rather than pretended to be here.
 */
export default function TwoFactorSettings() {
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Enrolment payload lives here only while the modal is open. It holds the one
  // and only copy of the secret and recovery codes — the API will not return them
  // again — so it is never persisted or logged.
  const [enrolment, setEnrolment] = useState<TwoFactorEnrolment | null>(null);
  const [confirmCode, setConfirmCode] = useState("");
  const [busy, setBusy] = useState(false);

  // Password confirmation gate. Enabling, disabling and re-keying all require it.
  const [passwordPrompt, setPasswordPrompt] = useState<null | (() => Promise<void>)>(null);
  const [password, setPassword] = useState("");
  const [freshCodes, setFreshCodes] = useState<string[] | null>(null);

  /**
   * Refresh the status. Takes a liveness check so it never writes state after the
   * component has gone — the modal this lives in can be closed mid-request, and a
   * setState on an unmounted component is a warning at best and a leak at worst.
   */
  const load = useCallback(async (isLive: () => boolean = () => true) => {
    try {
      const res = await authApi.twoFactorStatus();
      if (isLive()) setStatus(res.data);
    } catch {
      if (isLive()) setError("Could not load two-factor status.");
    } finally {
      if (isLive()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Not `void load()` directly: `react-hooks/set-state-in-effect` cannot see
    // that `load` awaits before touching state, so it reads the call as a
    // synchronous setState. Threading the cancellation flag through is what the
    // effect should do anyway, and it satisfies the rule honestly rather than
    // with a disable comment.
    let live = true;
    void load(() => live);
    return () => {
      live = false;
    };
  }, [load]);

  /**
   * Run an action, prompting for the password if the API says it is required.
   *
   * The backend answers `403` with `X-Password-Confirmation-Required` rather than
   * `401`, so this must not be confused with a dead session — treating it as one
   * would sign the user out instead of asking for their password.
   */
  const withPasswordConfirmation = async (action: () => Promise<void>) => {
    setError(null);
    try {
      await action();
    } catch (err: unknown) {
      const response = (err as { response?: { status?: number; data?: { detail?: string } } })
        .response;
      if (response?.status === 403) {
        setPasswordPrompt(() => action);
        return;
      }
      setError(extractApiError(err, "Something went wrong."));
    }
  };

  const submitPassword = async () => {
    setBusy(true);
    setError(null);
    try {
      await authApi.confirmPassword({ password });
      const retry = passwordPrompt;
      setPasswordPrompt(null);
      setPassword("");
      if (retry) await retry();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } }).response?.data
        ?.detail;
      setError(detail ?? "That password is incorrect.");
    } finally {
      setBusy(false);
    }
  };

  const beginEnrolment = () =>
    withPasswordConfirmation(async () => {
      const res = await authApi.enableTwoFactor();
      setEnrolment(res.data);
      setConfirmCode("");
    });

  const confirmEnrolment = async () => {
    setBusy(true);
    setError(null);
    try {
      await authApi.confirmTwoFactor({ code: confirmCode.trim() });
      setEnrolment(null);
      setNotice("Two-factor authentication is now enabled.");
      await load();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } }).response?.data
        ?.detail;
      setError(detail ?? "That code is not valid.");
    } finally {
      setBusy(false);
    }
  };

  const disable = () =>
    withPasswordConfirmation(async () => {
      await authApi.disableTwoFactor();
      setNotice("Two-factor authentication is disabled.");
      await load();
    });

  const regenerate = () =>
    withPasswordConfirmation(async () => {
      const res = await authApi.regenerateRecoveryCodes();
      setFreshCodes(res.data.recovery_codes);
      await load();
    });

  if (loading) {
    return <p className="text-sm text-ink-label dark:text-night-muted">Loading…</p>;
  }

  const pending = status?.pending_confirmation ?? false;
  const enabled = status?.enabled ?? false;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-gray-100">
            Two-factor authentication
            {enabled && <Badge tone="success">Enabled</Badge>}
            {pending && <Badge tone="warning">Setup incomplete</Badge>}
            {!enabled && !pending && <Badge tone="neutral">Disabled</Badge>}
          </h3>
          <p className="mt-1 max-w-prose text-xs text-ink-label dark:text-night-muted">
            {enabled
              ? "You'll be asked for a code from your authenticator app when you sign in."
              : pending
                ? "A secret was generated but never confirmed, so two-factor is not being enforced. Finish setup or start again."
                : "Add a second step to sign-in using an authenticator app."}
          </p>
        </div>

        <div className="flex shrink-0 gap-2">
          {!enabled && <Button onClick={beginEnrolment}>{pending ? "Restart setup" : "Enable"}</Button>}
          {enabled && (
            <>
              <Button variant="outline" onClick={regenerate}>
                New recovery codes
              </Button>
              <Button variant="outline" onClick={disable}>
                Disable
              </Button>
            </>
          )}
        </div>
      </div>

      {enabled && (
        <p className="text-xs text-ink-label dark:text-night-muted">
          {status?.recovery_codes_remaining ?? 0} recovery code
          {status?.recovery_codes_remaining === 1 ? "" : "s"} remaining.
          {(status?.recovery_codes_remaining ?? 0) <= 2 && (
            <span className="ml-1 font-semibold text-tone-warning dark:text-tone-warning">
              Generate a new set — running out means losing your phone locks you out.
            </span>
          )}
        </p>
      )}

      {notice && <p className="text-xs text-tone-success dark:text-tone-success">{notice}</p>}
      {error && !passwordPrompt && !enrolment && (
        <p role="alert" className="text-xs text-tone-danger">
          {error}
        </p>
      )}

      {/* --- Password confirmation --- */}
      {passwordPrompt !== null && (
      <Modal
        onClose={() => {
          setPasswordPrompt(null);
          setPassword("");
          setError(null);
        }}
        title="Confirm your password"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink-label dark:text-night-muted">
            For your security, please re-enter your password to continue.
          </p>
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={error ?? undefined}
            autoFocus
          />
          <Button onClick={submitPassword} loading={busy} disabled={!password} fullWidth>
            Confirm
          </Button>
        </div>
      </Modal>
      )}

      {/* --- Enrolment --- */}
      {enrolment !== null && (
      <Modal
        onClose={() => {
          setEnrolment(null);
          setError(null);
        }}
        title="Set up two-factor authentication"
      >
        {enrolment && (
          <div className="flex flex-col gap-4">
            <ol className="flex list-decimal flex-col gap-3 pl-5 text-sm text-gray-600 dark:text-gray-300">
              <li>
                Open your authenticator app and add an account.{" "}
                <a
                  href={enrolment.otpauth_uri}
                  className="text-brand dark:text-brand-on-dark hover:underline"
                  rel="noreferrer"
                >
                  Tap here on a phone
                </a>{" "}
                to add it automatically.
              </li>
              <li>
                Or enter this key manually:
                <code className="mt-1 block break-all rounded-lg bg-gray-50 p-2 font-mono text-xs dark:bg-night-card">
                  {/* Grouped in fours: these are retyped by hand more often than
                      anyone expects, and an unbroken 32-character string is where
                      mistakes happen. */}
                  {enrolment.secret.replace(/(.{4})/g, "$1 ").trim()}
                </code>
              </li>
              <li>Enter the 6-digit code it shows, to confirm it works.</li>
            </ol>

            <div className="rounded-lg border border-tone-warning/40 bg-tone-warning/10 p-3 dark:border-tone-warning/40 dark:bg-tone-warning/15">
              <p className="text-xs font-semibold text-tone-warning dark:text-tone-warning">
                Save these recovery codes now — they are not shown again.
              </p>
              <p className="mt-0.5 text-[11px] text-tone-warning dark:text-tone-warning">
                Each works once. They are the only way in if you lose your phone.
              </p>
              <div className="mt-2 grid grid-cols-2 gap-1 font-mono text-xs text-tone-warning dark:text-tone-warning">
                {enrolment.recovery_codes.map((code) => (
                  <span key={code}>{code}</span>
                ))}
              </div>
            </div>

            <Input
              label="Authentication code"
              autoComplete="one-time-code"
              inputMode="numeric"
              placeholder="123456"
              maxLength={6}
              value={confirmCode}
              onChange={(e) => setConfirmCode(e.target.value)}
              error={error ?? undefined}
            />
            <Button
              onClick={confirmEnrolment}
              loading={busy}
              disabled={confirmCode.trim().length < 6}
              fullWidth
            >
              Confirm and enable
            </Button>
          </div>
        )}
      </Modal>
      )}

      {/* --- Freshly regenerated codes --- */}
      {freshCodes !== null && (
      <Modal
        onClose={() => setFreshCodes(null)}
        title="Your new recovery codes"
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-ink-label dark:text-night-muted">
            Your previous codes no longer work. Save these now — they are not shown again.
          </p>
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-gray-50 p-3 font-mono text-xs dark:bg-night-card">
            {(freshCodes ?? []).map((code) => (
              <span key={code}>{code}</span>
            ))}
          </div>
          <Button onClick={() => setFreshCodes(null)} fullWidth>
            I&apos;ve saved them
          </Button>
        </div>
      </Modal>
      )}
    </div>
  );
}
