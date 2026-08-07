"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthCard from "@/components/auth/AuthCard";
import Button from "@/components/common/Button";
import Input from "@/components/common/Input";
import { authApi } from "@/lib/api/authApi";
import { invitationApi } from "@/lib/api/rbacApi";
import { setUser } from "@/lib/store/authSlice";
import useAppDispatch from "@/lib/hooks/useAppDispatch";
import { extractApiError } from "@/lib/utils/apiError";

/**
 * Mirrors `InvitationPreviewResponse`. `expires_at` and `requires_google` were
 * both returned by the API and absent from this type, so neither was reachable —
 * the same under-typing that hid eleven fields on `GET /users/{id}`.
 */
interface Preview {
  email: string;
  role_name: string | null;
  account_type: string;
  expires_at: string;
  requires_google: boolean;
}

/**
 * Landing page for an invitation link.
 *
 * Previews the invitation before asking for anything. Showing the address the
 * invitation was issued to lets the invitee catch a wrong or forwarded link before
 * they have typed a password, and it is the only signal they have that the link is
 * genuine. The preview endpoint is deliberately minimal server-side — the address,
 * the role name and the account type, nothing about the inviter — so an
 * unauthenticated token holder learns no more than they need.
 *
 * Unlike registration, accepting **signs the user straight in**: an administrator
 * already vouched for this address by inviting it, so there is no approval left to
 * wait for.
 */
export default function AcceptInvitationClient({ token }: { token: string | null }) {
  const router = useRouter();
  const dispatch = useAppDispatch();

  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(token));

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    let live = true;
    void (async () => {
      try {
        const res = await invitationApi.preview(token);
        if (live) setPreview(res.data);
      } catch (err: unknown) {
        const detail = (err as { response?: { data?: { detail?: string } } }).response?.data
          ?.detail;
        if (live) setLoadError(detail ?? "This invitation is invalid, expired or already used.");
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [token]);

  const mismatch = confirm.length > 0 && password !== confirm;
  const tooShort = password.length > 0 && password.length < 8;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const res = await authApi.acceptInvitation({
        token,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        password,
        confirm_password: confirm,
      });
      dispatch(setUser(res.data.user));
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(extractApiError(err, "Could not accept the invitation."));
    } finally {
      setBusy(false);
    }
  };

  const signInLink = (
    <Link href="/sign-in" className="font-medium text-brand dark:text-brand-on-dark hover:underline">
      Go to sign in
    </Link>
  );

  if (!token) {
    return (
      <AuthCard
        title="No invitation found"
        subtitle="This page needs an invitation link."
        footer={signInLink}
      >
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Open the link from your invitation email. If it has expired, ask whoever invited
          you to send a new one.
        </p>
      </AuthCard>
    );
  }

  if (loading) {
    return (
      <AuthCard title="Checking your invitation…">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-night-card">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-brand" />
        </div>
      </AuthCard>
    );
  }

  if (loadError || !preview) {
    return (
      <AuthCard title="This invitation can't be used" subtitle={loadError ?? undefined} footer={signInLink}>
        {/* No hardcoded window. The lifetime is a server constant that can
            change, and this branch renders when there is no `preview` to read a
            real date from — so it says what is true without naming a number
            that could be wrong. */}
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Invitations expire after a while and can only be accepted once. Ask whoever invited
          you to resend it.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Accept your invitation"
      subtitle={`Setting up the account for ${preview.email}`}
      footer={signInLink}
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {/* `expires_at` was fetched and never rendered, while the error branch
            asserted a hardcoded 7 days. Showing the real date means the page
            cannot disagree with the server about when the link dies. */}
        <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500 dark:bg-night-card dark:text-gray-400">
          {preview.role_name && (
            <>
              You&apos;ll join as <span className="font-semibold">{preview.role_name}</span>.{" "}
            </>
          )}
          This link expires on{" "}
          <span className="font-semibold">
            {new Date(preview.expires_at).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </span>
          .
        </p>

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-tone-danger/40 bg-tone-danger/10 px-4 py-3 text-sm text-tone-danger dark:border-tone-danger/40 dark:bg-tone-danger/15 dark:text-tone-danger"
          >
            {error}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            autoComplete="given-name"
            autoFocus
          />
          <Input
            label="Last name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            autoComplete="family-name"
          />
        </div>

        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={tooShort ? "At least 8 characters" : undefined}
          hint="At least 8 characters, with one capital letter and one number."
        />
        <Input
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={mismatch ? "Passwords do not match" : undefined}
        />

        <Button
          type="submit"
          loading={busy}
          disabled={
            !firstName.trim() || !lastName.trim() || !password || mismatch || tooShort
          }
          fullWidth
        >
          Create my account
        </Button>
      </form>
    </AuthCard>
  );
}
