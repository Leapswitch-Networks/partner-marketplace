"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import useAppSelector from "@/lib/hooks/useAppSelector";
import SignInForm from "./SignInForm";
import SignUpForm from "./SignUpForm";

type Tab = "signin" | "signup";

interface AuthHubProps {
  initialTab?: Tab;
}

function AuthHubInner({ initialTab = "signin" }: AuthHubProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isAuthenticated } = useAppSelector((s) => s.auth);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [animating, setAnimating] = useState(false);
  const [displayTab, setDisplayTab] = useState<Tab>(initialTab);
  const [direction, setDirection] = useState<"left" | "right">("right");
  const [registeredBanner, setRegisteredBanner] = useState(
    searchParams.get("registered") === "1"
  );
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isAuthenticated) router.replace("/dashboard");
  }, [isAuthenticated, router]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const switchTab = (next: Tab) => {
    if (next === tab || animating) return;
    setRegisteredBanner(false);
    setDirection(next === "signup" ? "right" : "left");
    setAnimating(true);
    setTab(next);
    router.push(next === "signin" ? "/sign-in" : "/sign-up");

    timeoutRef.current = setTimeout(() => {
      setDisplayTab(next);
      setAnimating(false);
    }, 180);
  };

  const handleRegistered = () => {
    setRegisteredBanner(true);
    setDirection("left");
    setAnimating(true);
    setTab("signin");
    router.push("/sign-in?registered=1");

    timeoutRef.current = setTimeout(() => {
      setDisplayTab("signin");
      setAnimating(false);
    }, 180);
  };

  return (
    <div className="w-full max-w-md">
      {/* Logo / Brand */}
      <div className="mb-8 text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#F97316] text-white text-xl font-bold mb-4">
          T
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Admin Portal</h1>
        <p
          className="mt-1 text-sm text-gray-500 transition-opacity duration-200"
          style={{ opacity: animating ? 0 : 1 }}
        >
          {tab === "signin"
            ? "Sign in to manage tests, questions, and job roles"
            : "Create an admin account to get started"}
        </p>
      </div>

      {/* Card */}
      <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800">
        {/* Toggle */}
        <div className="mb-6 flex rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
          <button
            type="button"
            onClick={() => switchTab("signin")}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-all duration-200 ${
              tab === "signin"
                ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => switchTab("signup")}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-all duration-200 ${
              tab === "signup"
                ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Animated form container */}
        <div className="overflow-hidden">
          <div
            key={displayTab}
            style={{
              animation: animating
                ? `${direction === "right" ? "slideOutLeft" : "slideOutRight"} 180ms ease forwards`
                : `${direction === "right" ? "slideInRight" : "slideInLeft"} 220ms ease forwards`,
            }}
          >
            {registeredBanner && displayTab === "signin" && (
              <div
                role="status"
                className="mb-5 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700 border border-green-200"
              >
                Account created successfully. You can now sign in.
              </div>
            )}

            {displayTab === "signin" ? (
              // `hideForgotPassword` is no longer passed: the link was suppressed
              // because /forgot-password did not exist and pointed at `href="#"`.
              // The page exists now, so hiding the only route to a password reset
              // would leave locked-out users with nowhere to go.
              <SignInForm onSwitchToSignUp={() => switchTab("signup")} />
            ) : (
              <SignUpForm
                onRegistered={handleRegistered}
                onSwitchToSignIn={() => switchTab("signin")}
              />
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(24px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-24px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideOutLeft {
          from { opacity: 1; transform: translateX(0); }
          to   { opacity: 0; transform: translateX(-24px); }
        }
        @keyframes slideOutRight {
          from { opacity: 1; transform: translateX(0); }
          to   { opacity: 0; transform: translateX(24px); }
        }
      `}</style>
    </div>
  );
}

export default function AuthHub({ initialTab = "signin" }: AuthHubProps) {
  return (
    <Suspense fallback={<div className="w-full max-w-md" />}>
      <AuthHubInner initialTab={initialTab} />
    </Suspense>
  );
}
