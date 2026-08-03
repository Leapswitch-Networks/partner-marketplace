"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import Input from "@/components/common/Input";
import Button from "@/components/common/Button";
import { authApi, isTwoFactorRequired } from "@/lib/api/authApi";
import TwoFactorChallenge from "@/components/auth/TwoFactorChallenge";
import { setUser } from "@/lib/store/authSlice";
import useAppDispatch from "@/lib/hooks/useAppDispatch";

const schema = z.object({
  email: z.email({ message: "Enter a valid email address" }),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional(),
});

type FormValues = z.infer<typeof schema>;

interface SignInFormProps {
  hideForgotPassword?: boolean;
  /** Inline toggle: called when user clicks "Don't have an account?" */
  onSwitchToSignUp?: () => void;
}

export default function SignInForm({
  hideForgotPassword = false,
  onSwitchToSignUp,
}: SignInFormProps) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [serverError, setServerError] = useState<string | null>(null);
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
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setServerError(detail ?? "Invalid email or password.");
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
    <form onSubmit={handleSubmit(onSubmit)} method="post" noValidate className="flex flex-col gap-5">
      {serverError && (
        <div role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 border border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800">
          {serverError}
        </div>
      )}

      <Input
        label="Email address"
        type="email"
        placeholder="you@leapswitch.com"
        autoComplete="email"
        error={errors.email?.message}
        {...register("email")}
      />

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Password
          </label>
          {!hideForgotPassword && (
            <a href="#" className="text-xs text-[#F97316] hover:underline">
              Forgot password?
            </a>
          )}
        </div>
        <input
          id="password"
          type="password"
          placeholder="••••••••"
          autoComplete="current-password"
          className={`w-full rounded-lg border px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition
            focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20
            dark:text-gray-100 dark:placeholder-gray-500
            ${errors.password ? "border-red-400 bg-red-50 dark:border-red-700 dark:bg-red-950/30" : "border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-800"}`}
          {...register("password")}
        />
        {errors.password && (
          <p className="text-xs text-red-500">{errors.password.message}</p>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none dark:text-gray-400">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-gray-300 accent-[#F97316]"
          {...register("rememberMe")}
        />
        Remember me
      </label>

      <Button type="submit" fullWidth loading={isSubmitting}>
        Sign in
      </Button>

      {onSwitchToSignUp && (
        <p className="text-center text-sm text-gray-500 dark:text-gray-400">
          Don&apos;t have an account?{" "}
          <button
            type="button"
            onClick={onSwitchToSignUp}
            className="font-medium text-[#F97316] hover:underline"
          >
            Create one
          </button>
        </p>
      )}
    </form>
  );
}
