"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import AuthCard from "@/components/auth/AuthCard";
import Button from "@/components/common/Button";
import Input from "@/components/common/Input";
import { authApi } from "@/lib/api/authApi";

type State = "verifying" | "done" | "failed" | "missing";

/**
 * Landing page for the link in a verification email (PM-35).
 *
 * Verifies on mount rather than behind a button. The user already expressed intent
 * by clicking the link in their inbox; making them click a second one to confirm
 * they meant it is friction for nothing.
 *
 * On failure it offers to resend, because the overwhelmingly common cause is an
 * expired link — 24 hours — and a dead end there means the account can never be
 * approved. The resend deliberately reports nothing about whether the address
 * exists or was already verified, matching the endpoint.
 */
export default function VerifyEmailClient({ token }: { token: string | null }) {
  const [state, setState] = useState<State>(token ? "verifying" : "missing");
  const [message, setMessage] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [resent, setResent] = useState(false);
  const [busy, setBusy] = useState(false);

  // Guards against the double-invoke of effects in React strict mode, which would
  // otherwise fire two verify requests and burn two of the endpoint's rate-limit
  // allowance on every page load.
  const attempted = useRef(false);

  useEffect(() => {
    if (!token || attempted.current) return;
    attempted.current = true;

    let live = true;
    void (async () => {
      try {
        const res = await authApi.verifyEmail({ token });
        if (!live) return;
        setMessage(res.data.message);
        setState("done");
      } catch (err: unknown) {
        if (!live) return;
        const detail = (err as { response?: { data?: { detail?: string } } }).response?.data
          ?.detail;
        setMessage(detail ?? "This verification link is invalid or has expired.");
        setState("failed");
      }
    })();

    return () => {
      live = false;
    };
  }, [token]);

  const resend = async () => {
    setBusy(true);
    try {
      await authApi.resendVerification({ email });
    } catch {
      // Swallowed on purpose. The endpoint answers the same either way, so
      // surfacing a network-level difference here would leak more than the API does.
    } finally {
      setResent(true);
      setBusy(false);
    }
  };

  const signInLink = (
    <Link href="/sign-in" className="font-medium text-brand dark:text-brand-on-dark hover:underline">
      Go to sign in
    </Link>
  );

  if (state === "verifying") {
    return (
      <AuthCard title="Confirming your email…" subtitle="This will only take a moment.">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-night-card">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-brand" />
        </div>
      </AuthCard>
    );
  }

  if (state === "done") {
    return (
      <AuthCard title="Email confirmed" subtitle={message ?? undefined} footer={signInLink}>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Thanks — that address is confirmed. If your account is still awaiting approval,
          you&apos;ll be able to sign in once an administrator activates it.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title={state === "missing" ? "Nothing to confirm" : "That link didn't work"}
      subtitle={
        state === "missing"
          ? "This page needs a confirmation link from your email."
          : (message ?? undefined)
      }
      footer={signInLink}
    >
      {resent ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          If that address needs confirming, a new link is on its way. Check your inbox —
          and your spam folder.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Verification links expire after 24 hours. Enter your address and we&apos;ll send
            a new one.
          </p>
          <Input
            label="Email address"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button onClick={resend} loading={busy} disabled={!email.trim()} fullWidth>
            Send a new link
          </Button>
        </div>
      )}
    </AuthCard>
  );
}
