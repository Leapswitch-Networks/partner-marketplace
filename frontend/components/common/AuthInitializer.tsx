"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import useAppDispatch from "@/lib/hooks/useAppDispatch";
import useAppSelector from "@/lib/hooks/useAppSelector";
import { fetchCurrentUser } from "@/lib/store/authSlice";

export default function AuthInitializer({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { isAuthenticated, loading } = useAppSelector((s) => s.auth);

  // Track whether we have attempted the session check this mount cycle
  const fetchedRef = useRef(false);
  const [checked, setChecked] = useState(isAuthenticated); // skip check if already auth'd

  useEffect(() => {
    // Already authenticated (e.g. user just logged in and was routed here) — nothing to do
    if (isAuthenticated) {
      setChecked(true);
      return;
    }

    // Only fire once per mount
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    // Safety-net timeout: never block the loading screen for more than 6s
    const timeout = setTimeout(() => setChecked(true), 6000);

    dispatch(fetchCurrentUser()).finally(() => {
      clearTimeout(timeout);
      setChecked(true);
    });

    return () => clearTimeout(timeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // After session check completes, redirect unauthenticated users to sign-in
  useEffect(() => {
    if (checked && !loading && !isAuthenticated) {
      router.replace("/sign-in");
    }
  }, [checked, loading, isAuthenticated, router]);

  // While we are verifying the session, show a neutral loading screen
  if (!checked || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F3F4F6]">
        <div className="flex flex-col items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-[5px] bg-brand text-lg font-bold text-white">
            T
          </span>
          <p className="text-sm font-medium text-gray-500">Loading…</p>
        </div>
      </div>
    );
  }

  // Don't render children until we confirm the user is authenticated
  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
