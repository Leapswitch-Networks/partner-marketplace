"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import useAppSelector from "@/lib/hooks/useAppSelector";
import SignInForm from "./SignInForm";
import SignUpForm from "./SignUpForm";
import SocialSignIn from "./SocialSignIn";

type Mode = "signin" | "signup";

interface AuthHubProps {
  mode?: Mode;
}

/**
 * The auth entry card — Viho's `.login-form`.
 *
 * Three deliberate departures from what this component used to be:
 *
 * 1. **No logo block above the card.** Viho's login screen is the card alone on a
 *    brand wash. Dropping it also removed the last of the inherited test-platform
 *    branding — a `T` monogram, "Admin Portal", and the subtitle "Sign in to
 *    manage tests, questions, and job roles" (TECH_DEBT PM-21's deferred items).
 * 2. **A link, not a tab toggle.** Viho navigates between Login and Create
 *    Account as separate screens with a text link at the foot of the card. The
 *    segmented toggle and its four slide keyframes are gone with it — `/sign-in`
 *    and `/sign-up` are real routes and now behave like it.
 * 3. **Square card, no border, no shadow.** Pixel-checked against `login.png`:
 *    the pixel immediately outside the card is the `#eaf0ef` wash and the card's
 *    own edge is pure `#ffffff`, so there is no 1px rule. The wash alone is what
 *    makes it read as raised.
 *
 * Width is `max-w-[450px]`, not Viho's fixed `width: 450px` — the measured card is
 * exactly 450px, but a fixed width is not responsive below 474px and only its
 * parent's padding rescues it.
 */
function AuthHubInner({ mode = "signin" }: AuthHubProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isAuthenticated } = useAppSelector((s) => s.auth);
  const justRegistered = searchParams.get("registered") === "1";

  useEffect(() => {
    if (isAuthenticated) router.replace("/dashboard");
  }, [isAuthenticated, router]);

  const isSignIn = mode === "signin";

  return (
    <div className="w-full max-w-[450px] bg-white p-[30px] dark:bg-night-card">
      <h1 className="text-[22px] font-semibold capitalize text-ink dark:text-white">
        {isSignIn ? "Login" : "Create Your Account"}
      </h1>
      <p className="mb-[25px] mt-[5px] text-sm text-ink-muted dark:text-night-muted">
        {isSignIn
          ? "Welcome back! Log in to your account."
          : "Enter your personal details to create account"}
      </p>

      {justRegistered && isSignIn && (
        <div
          role="status"
          className="mb-5 rounded-[5px] border border-brand/20 bg-brand/10 px-4 py-3 text-sm text-brand dark:text-brand-on-dark"
        >
          Account created successfully. You can now sign in.
        </div>
      )}

      {isSignIn ? <SignInForm /> : <SignUpForm />}

      <SocialSignIn />

      <p className="text-center text-sm font-semibold text-ink dark:text-white">
        {isSignIn ? (
          <>
            Don&apos;t have account?{" "}
            <Link href="/sign-up" className="text-brand dark:text-brand-on-dark hover:underline">
              Create Account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href="/sign-in" className="text-brand dark:text-brand-on-dark hover:underline">
              Login
            </Link>
          </>
        )}
      </p>
    </div>
  );
}

export default function AuthHub({ mode = "signin" }: AuthHubProps) {
  return (
    <Suspense fallback={<div className="w-full max-w-[450px]" />}>
      <AuthHubInner mode={mode} />
    </Suspense>
  );
}
