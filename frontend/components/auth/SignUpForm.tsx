"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Input from "@/components/common/Input";
import Button from "@/components/common/Button";
import { authApi } from "@/lib/api/authApi";

const schema = z
  .object({
    full_name: z
      .string()
      .min(2, { message: "Name must be at least 2 characters" })
      .max(100, { message: "Name must be at most 100 characters" }),
    email: z.string().email({ message: "Enter a valid email address" }),
    password: z
      .string()
      .min(8, { message: "Password must be at least 8 characters" })
      .regex(/[A-Z]/, { message: "Must contain an uppercase letter" })
      .regex(/[0-9]/, { message: "Must contain a number" }),
    confirmPassword: z.string().min(1, { message: "Please confirm your password" }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof schema>;

interface SignUpFormProps {
  /** Called after successful registration so AuthHub can switch to Sign In tab */
  onRegistered?: () => void;
  /** Inline toggle: called when user clicks "Already have an account?" */
  onSwitchToSignIn?: () => void;
}

export default function SignUpForm({ onRegistered, onSwitchToSignIn }: SignUpFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormValues) => {
    setServerError(null);
    try {
      // Partner self-registration. Staff cannot register here — they arrive via
      // Google SSO or an invitation, and the API rejects a staff-domain address.
      const trimmed = data.full_name.trim();
      const spaceAt = trimmed.indexOf(" ");
      await authApi.register({
        first_name: spaceAt > 0 ? trimmed.slice(0, spaceAt) : trimmed,
        last_name: spaceAt > 0 ? trimmed.slice(spaceAt + 1).trim() : "",
        email: data.email,
        password: data.password,
        confirm_password: data.confirmPassword,
      });
      reset();
      onRegistered?.();
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setServerError(detail ?? "Something went wrong. Please try again.");
    }
  };

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handleSubmit(onSubmit)(e);
  };

  return (
    <form onSubmit={handleFormSubmit} noValidate className="flex flex-col gap-5">
      {serverError && (
        <div role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 border border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800">
          {serverError}
        </div>
      )}

      <Input
        label="Full name"
        type="text"
        placeholder="Your Full Name"
        autoComplete="name"
        error={errors.full_name?.message}
        {...register("full_name")}
      />

      <Input
        label="Email address"
        type="email"
        placeholder="you@leapswitch.com"
        autoComplete="email"
        error={errors.email?.message}
        {...register("email")}
      />

      <Input
        label="Password"
        type="password"
        placeholder="••••••••"
        autoComplete="new-password"
        error={errors.password?.message}
        {...register("password")}
      />

      <Input
        label="Confirm password"
        type="password"
        placeholder="••••••••"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...register("confirmPassword")}
      />

      <p className="text-xs text-gray-500 dark:text-gray-400">
        Password must be at least 8 characters and include an uppercase letter and a number.
      </p>

      <Button type="submit" fullWidth loading={isSubmitting}>
        Create admin account
      </Button>

      {onSwitchToSignIn && (
        <p className="text-center text-sm text-gray-500 dark:text-gray-400">
          Already have an account?{" "}
          <button
            type="button"
            onClick={onSwitchToSignIn}
            className="font-medium text-[#F97316] hover:underline"
          >
            Sign in
          </button>
        </p>
      )}
    </form>
  );
}
