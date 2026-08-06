"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/common/Button";
import Input from "@/components/common/Input";
import { authApi } from "@/lib/api/authApi";
import { setUser } from "@/lib/store/authSlice";
import useAppDispatch from "@/lib/hooks/useAppDispatch";

/**
 * The second step of sign-in when 2FA is enabled.
 *
 * Reached only after the password step succeeded, holding a `challenge_token`
 * that is **not** a session — there is no cookie yet, and the token is refused
 * everywhere a real access token would be accepted.
 *
 * Two ways through, and offering both matters: a phone is lost far more often
 * than a password, so a UI that only accepts an authenticator code strands the
 * user with recovery codes they cannot use.
 */
export default function TwoFactorChallenge({
  challengeToken,
  recoveryCodesRemaining,
  onCancel,
}: {
  challengeToken: string;
  recoveryCodesRemaining: number;
  onCancel: () => void;
}) {
  const router = useRouter();
  const dispatch = useAppDispatch();

  const [mode, setMode] = useState<"totp" | "recovery">("totp");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isTotp = mode === "totp";

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await authApi.twoFactorChallenge({
        challenge_token: challengeToken,
        ...(isTotp ? { code: value.trim() } : { recovery_code: value.trim() }),
      });
      dispatch(setUser(res.data.user));
      router.push("/dashboard");
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data
        ?.detail;
      // A 429 here is the rate limiter, not a wrong code. Saying "that code is
      // wrong" when the real problem is too many attempts sends people to look
      // for a fault in their authenticator app.
      setError(
        status === 429
          ? detail ?? "Too many attempts. Please wait a moment and try again."
          : detail ?? "That code is not valid."
      );
      setValue("");
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = () => {
    setMode(isTotp ? "recovery" : "totp");
    setValue("");
    setError(null);
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <div>
        <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
          Two-factor authentication
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {isTotp
            ? "Enter the 6-digit code from your authenticator app."
            : "Enter one of your recovery codes. Each code works once."}
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-tone-danger/40 bg-tone-danger/10 px-4 py-3 text-sm text-tone-danger dark:border-tone-danger/40 dark:bg-tone-danger/15 dark:text-tone-danger"
        >
          {error}
        </div>
      )}

      <Input
        label={isTotp ? "Authentication code" : "Recovery code"}
        // `one-time-code` lets a password manager and iOS autofill the code, and
        // is the whole reason to use a text input with numeric hints rather than
        // type="number" — which would also add spinners and strip leading zeros.
        autoComplete={isTotp ? "one-time-code" : "off"}
        inputMode={isTotp ? "numeric" : "text"}
        placeholder={isTotp ? "123456" : "XXXXX-XXXXX"}
        maxLength={isTotp ? 6 : 11}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoFocus
        hint={
          isTotp
            ? undefined
            : `${recoveryCodesRemaining} code${recoveryCodesRemaining === 1 ? "" : "s"} remaining`
        }
      />

      <Button type="submit" loading={submitting} fullWidth disabled={!value.trim()}>
        Verify and sign in
      </Button>

      <div className="flex items-center justify-between text-xs">
        <button
          type="button"
          onClick={switchMode}
          className="text-brand dark:text-brand-on-dark hover:underline"
        >
          {isTotp ? "Use a recovery code instead" : "Use my authenticator app"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-gray-400 hover:underline dark:text-gray-500"
        >
          Back to sign in
        </button>
      </div>
    </form>
  );
}
