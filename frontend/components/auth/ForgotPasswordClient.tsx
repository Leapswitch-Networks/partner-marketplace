"use client";

import { useState } from "react";
import Link from "next/link";
import AuthCard from "@/components/auth/AuthCard";
import Button from "@/components/common/Button";
import Input from "@/components/common/Input";
import { authApi } from "@/lib/api/authApi";

/**
 * Request a password-reset link.
 *
 * **The response is always the same**, and this UI must not undermine that. The
 * endpoint answers "if an account exists for that address, a reset link has been
 * sent" whether or not it does, because a distinguishable answer turns the form
 * into an account-enumeration oracle. So the success screen makes no claim about
 * whether the address is registered, and a network failure is reported as a
 * failure to *send the request* rather than a fact about the account.
 */
export default function ForgotPasswordClient() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await authApi.forgotPassword({ email: email.trim() });
      setSent(true);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } }).response?.status;
      const detail = (err as { response?: { data?: { detail?: string } } }).response?.data
        ?.detail;
      setError(
        status === 429
          ? detail ?? "Too many requests. Please wait a moment and try again."
          : "Could not send the request. Check your connection and try again."
      );
    } finally {
      setBusy(false);
    }
  };

  const backToSignIn = (
    <Link href="/sign-in" className="font-medium text-[#F97316] hover:underline">
      Back to sign in
    </Link>
  );

  if (sent) {
    return (
      <AuthCard title="Check your email" footer={backToSignIn}>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          If an account exists for <span className="font-medium">{email.trim()}</span>, a
          reset link is on its way. It expires in one hour.
        </p>
        <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
          Nothing arrived? Check your spam folder, then try again.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Reset your password"
      subtitle="We'll email you a link to choose a new one."
      footer={backToSignIn}
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400"
          >
            {error}
          </div>
        )}
        <Input
          label="Email address"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
        />
        <Button type="submit" loading={busy} disabled={!email.trim()} fullWidth>
          Send reset link
        </Button>
      </form>
    </AuthCard>
  );
}
