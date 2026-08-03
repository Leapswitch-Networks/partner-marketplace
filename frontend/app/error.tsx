"use client";

import { useEffect } from "react";
import ErrorState from "@/components/common/ErrorState";

/**
 * Root segment error boundary (TECH_DEBT PM-19).
 *
 * Catches render and data errors anywhere below the root layout that a nearer
 * boundary has not already handled. Before this existed, such an error produced
 * a blank screen.
 *
 * It cannot catch a failure in `app/layout.tsx` itself — a boundary lives inside
 * the layout it belongs to. That case is `app/global-error.tsx`.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The browser console is the only sink the frontend has today; there is no
    // error-reporting service (PM-10's monitoring half). Logged rather than
    // swallowed so a failure leaves a trace even without one.
    console.error("[route error]", error);
  }, [error]);

  return <ErrorState error={error} reset={reset} />;
}
