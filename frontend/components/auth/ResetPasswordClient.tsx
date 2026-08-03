"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthCard from "@/components/auth/AuthCard";
import Button from "@/components/common/Button";
import Input from "@/components/common/Input";
import { authApi } from "@/lib/api/authApi";

/**
 * Landing page for the link in a password-reset email.
 *
 * Worth knowing what completing this does server-side: it revokes **every** session
 * for the account, including any the attacker holds. That is the point of a reset,
 * and it is why the success screen sends the user to sign in rather than trying to
 * log them straight in — there is deliberately no session to inherit.
 *
 * The password rules are duplicated from the backend as *hints* only. The server's
 * validator is the authority; these exist so the user is not told their password is
 * wrong after submitting it.
 */
export default function ResetPasswordClient({ token }: { token: string | null }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const mismatch = confirm.length > 0 && password !== confirm;
  const tooShort = password.length > 0 && password.length < 8;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await authApi.resetPassword({
        token,
        password,
        confirm_password: confirm,
      });
      setDone(true);
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { detail?: unknown } } }).response?.data;
      // A 422 from Pydantic carries a list of field errors, not a string. Rendering
      // the object would print "[object Object]" at the user.
      const detail = data?.detail;
      setError(
        typeof detail === "string"
          ? detail
          : Array.isArray(detail) && detail.length > 0
            ? String((detail[0] as { msg?: string })?.msg ?? "That password was rejected.")
            : "This reset link is invalid or has expired."
      );
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <AuthCard
        title="Nothing to reset"
        subtitle="This page needs a reset link from your email."
        footer={
          <Link href="/forgot-password" className="font-medium text-[#F97316] hover:underline">
            Request a new link
          </Link>
        }
      >
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Open the link from your password-reset email, or request a fresh one.
        </p>
      </AuthCard>
    );
  }

  if (done) {
    return (
      <AuthCard title="Password updated">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Your password has been changed and every signed-in device has been signed out —
          including anyone else who had access.
        </p>
        <Button className="mt-5" fullWidth onClick={() => router.push("/sign-in")}>
          Sign in
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Choose a new password"
      footer={
        <Link href="/sign-in" className="font-medium text-[#F97316] hover:underline">
          Back to sign in
        </Link>
      }
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
          label="New password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={tooShort ? "At least 8 characters" : undefined}
          hint="At least 8 characters, with one capital letter and one number."
          autoFocus
        />
        <Input
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={mismatch ? "Passwords do not match" : undefined}
        />
        <Button
          type="submit"
          loading={busy}
          disabled={!password || mismatch || tooShort}
          fullWidth
        >
          Update password
        </Button>
      </form>
    </AuthCard>
  );
}
