"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import Input from "@/components/common/Input";
import Button from "@/components/common/Button";
import { authApi } from "@/lib/api/authApi";
import { extractApiError } from "@/lib/utils/apiError";

const schema = z.object({
  first_name: z
    .string()
    .min(1, { message: "First name is required" })
    .max(50, { message: "First name must be at most 50 characters" }),
  last_name: z
    .string()
    .max(50, { message: "Last name must be at most 50 characters" })
    .optional()
    .or(z.literal("")),
  email: z.string().email({ message: "Enter a valid email address" }),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters" })
    .regex(/[A-Z]/, { message: "Must contain an uppercase letter" })
    .regex(/[0-9]/, { message: "Must contain a number" }),
  // Viho renders this as a required agreement, so it gates submission.
  agree: z.literal(true, { message: "Please accept the privacy policy" }),
});

type FormValues = z.infer<typeof schema>;

const UserIcon = (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

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

/**
 * Partner self-registration — Viho's Create Your Account screen.
 *
 * Built against `documentation/design/assets/screenshots/register.png`. Three
 * things there changed real behaviour rather than only styling:
 *
 * 1. **First and last name are separate fields** under one "Your Name" label.
 *    This is strictly better than what was here before: the form took a single
 *    "Full name" and split it on the first space to satisfy the API, which
 *    mangled every two-word surname. The API has always wanted the two parts.
 * 2. **There is no confirm-password field.** Viho relies on the `Show` toggle
 *    instead. The API still requires `confirm_password`, so we send the password
 *    twice — see the call below.
 * 3. **An "Agree With Privacy Policy" checkbox gates submission.**
 *
 * Success navigates to `/sign-in?registered=1`; `AuthHub` reads that flag.
 */
export default function SignUpForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

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
      //
      // `confirm_password` repeats `password` deliberately: the screen has no
      // confirm field, but the endpoint's contract still requires the key. The
      // server re-validates the pair, so sending them equal is honest rather
      // than a bypass — there is simply nothing for the user to mistype twice.
      await authApi.register({
        first_name: data.first_name.trim(),
        last_name: (data.last_name ?? "").trim(),
        email: data.email,
        password: data.password,
        confirm_password: data.password,
      });
      reset();
      router.push("/sign-in?registered=1");
    } catch (err: unknown) {
      setServerError(extractApiError(err, "Something went wrong. Please try again."));
    }
  };

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handleSubmit(onSubmit)(e);
  };

  return (
    <form onSubmit={handleFormSubmit} noValidate className="flex flex-col">
      {serverError && (
        <div
          role="alert"
          className="mb-5 rounded-[5px] border border-tone-danger/30 bg-tone-danger/10 px-4 py-3 text-sm text-tone-danger"
        >
          {serverError}
        </div>
      )}

      {/* "Your Name" is one label over a two-up pair, so each field carries its
          own accessible name via aria-label rather than a visible one. */}
      <fieldset className="mb-5">
        <legend className="mb-[5px] text-sm font-semibold text-ink dark:text-white">
          Your Name
        </legend>
        {/* Single column below `sm` — two-up at 360px left ~58px per name
            field, too narrow to type into. */}
        <div className="grid gap-[15px] sm:grid-cols-2">
          <Input
            label=""
            id="first-name"
            aria-label="First name"
            type="text"
            placeholder="First Name"
            autoComplete="given-name"
            addon={UserIcon}
            error={errors.first_name?.message}
            {...register("first_name")}
          />
          <Input
            label=""
            id="last-name"
            aria-label="Last name"
            type="text"
            placeholder="Last Name"
            autoComplete="family-name"
            addon={UserIcon}
            error={errors.last_name?.message}
            {...register("last_name")}
          />
        </div>
      </fieldset>

      <div className="mb-5">
        <Input
          label="Email Address"
          type="email"
          placeholder="Test@gmail.com"
          autoComplete="email"
          addon={MailIcon}
          error={errors.email?.message}
          {...register("email")}
        />
      </div>

      <div className="mb-5">
        <Input
          label="Password"
          id="new-password"
          type={showPassword ? "text" : "password"}
          placeholder="••••••••"
          autoComplete="new-password"
          addon={LockIcon}
          hint="At least 8 characters, with an uppercase letter and a number."
          error={errors.password?.message}
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

      <div className="mb-5">
        <label className="flex cursor-pointer select-none items-center gap-2 text-sm font-semibold text-ink dark:text-white">
          <input
            type="checkbox"
            className="h-4 w-4 rounded-none border-surface-border accent-brand"
            {...register("agree")}
          />
          <span>
            Agree With{" "}
            {/* Styled as Viho's link but rendered as text on purpose: there is no
                privacy-policy route in this app yet, and a checkbox that gates
                signup must not point at a 404. Make it a <Link> the moment the
                page exists. */}
            <span className="font-normal text-brand dark:text-brand-on-dark">Privacy Policy</span>
          </span>
        </label>
        {errors.agree && (
          <p className="mt-[5px] text-xs text-tone-danger">{errors.agree.message}</p>
        )}
      </div>

      <Button type="submit" loading={isSubmitting} className="ml-auto font-bold uppercase">
        Create Account
      </Button>
    </form>
  );
}
