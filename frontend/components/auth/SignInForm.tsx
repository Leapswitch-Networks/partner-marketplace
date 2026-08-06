"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Input from "@/components/common/Input";
import Button from "@/components/common/Button";
import { authApi, isTwoFactorRequired } from "@/lib/api/authApi";
import TwoFactorChallenge from "@/components/auth/TwoFactorChallenge";
import { setUser } from "@/lib/store/authSlice";
import useAppDispatch from "@/lib/hooks/useAppDispatch";
import { extractApiError } from "@/lib/utils/apiError";

const schema = z.object({
  email: z.email({ message: "Enter a valid email address" }),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional(),
});

type FormValues = z.infer<typeof schema>;

interface SignInFormProps {
  hideForgotPassword?: boolean;
}

/** Viho prefixes each login field with a brand-tinted icon tile. Drawn as inline
 *  SVG on purpose — the theme's own glyphs come from Themify/IcoFont/FontAwesome,
 *  which are licensed and must not be copied into this repo. */
const MailIcon = (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

const LockIcon = (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);

export default function SignInForm({ hideForgotPassword = false }: SignInFormProps) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [challenge, setChallenge] = useState<{
    token: string;
    recoveryCodesRemaining: number;
  } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormValues) => {
    setServerError(null);
    try {
      // One login endpoint for everyone — staff and partners share the `users`
      // table, and roles decide what happens next.
      const res = await authApi.login({ email: data.email, password: data.password });

      // Two possible shapes. Branch on the explicit flag rather than checking for
      // a missing `user`: a correct password with 2FA enabled is NOT a sign-in,
      // and treating it as one would drop the user at a dashboard with no session.
      if (isTwoFactorRequired(res.data)) {
        setChallenge({
          token: res.data.challenge_token,
          recoveryCodesRemaining: res.data.recovery_codes_remaining,
        });
        return;
      }

      dispatch(setUser(res.data.user));
      router.push("/dashboard");
    } catch (err: unknown) {
      setServerError(extractApiError(err, "Invalid email or password."));
    }
  };

  // The challenge replaces the form rather than appearing alongside it. Leaving
  // the email and password fields on screen invites re-submitting them, which
  // would mint a second challenge token and invalidate nothing — just confusion.
  if (challenge) {
    return (
      <TwoFactorChallenge
        challengeToken={challenge.token}
        recoveryCodesRemaining={challenge.recoveryCodesRemaining}
        onCancel={() => setChallenge(null)}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} method="post" noValidate className="flex flex-col">
      {serverError && (
        <div
          role="alert"
          className="mb-5 rounded-[5px] border border-tone-danger/30 bg-tone-danger/10 px-4 py-3 text-sm text-tone-danger"
        >
          {serverError}
        </div>
      )}

      {/* Viho's form-group rhythm is a flat 20px between fields. */}
      <div className="mb-5">
        <Input
          label="Email Address"
          type="email"
          placeholder="test@admin.com"
          autoComplete="email"
          addon={MailIcon}
          error={errors.email?.message}
          {...register("email")}
        />
      </div>

      <div className="mb-5">
        <Input
          label="Password"
          id="password"
          type={showPassword ? "text" : "password"}
          placeholder="••••••••"
          autoComplete="current-password"
          addon={LockIcon}
          error={errors.password?.message}
          // A text toggle rather than an eye icon — Viho's choice, and it is
          // unambiguous without needing a licensed glyph. The field had no reveal
          // control of any kind before this.
          trailing={
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-pressed={showPassword}
              className="rounded text-sm font-medium text-brand dark:text-brand-on-dark hover:underline focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-1"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          }
          {...register("password")}
        />
      </div>

      <div className="mb-5 flex items-center justify-between gap-3">
        <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-ink-muted dark:text-night-muted">
          <input
            type="checkbox"
            className="h-4 w-4 rounded-none border-surface-border accent-brand"
            {...register("rememberMe")}
          />
          Remember Password
        </label>

        {!hideForgotPassword && (
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-brand dark:text-brand-on-dark hover:underline"
          >
            Forgot password?
          </Link>
        )}
      </div>

      {/* Right-aligned via `ml-auto`, not full-width — Viho uses
          `margin-left: auto` on this button and it is a deliberate difference
          from the `fullWidth` treatment the rest of our forms use.
          The card heading reads "Login" but the button reads "SIGN IN" — that
          asymmetry is Viho's, checked against login.png. */}
      <Button type="submit" loading={isSubmitting} className="ml-auto font-bold uppercase">
        Sign in
      </Button>
    </form>
  );
}
