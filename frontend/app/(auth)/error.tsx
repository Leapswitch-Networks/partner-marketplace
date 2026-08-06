"use client";

import { useEffect } from "react";
import ErrorState from "@/components/common/ErrorState";

/**
 * Error boundary for the sign-in / sign-up group (TECH_DEBT PM-19).
 *
 * Exists chiefly to change where the escape hatch points. The root boundary
 * offers "Back to dashboard", which for someone who has not signed in means a
 * redirect straight back to `/sign-in` by `middleware.ts` — two navigations to
 * arrive where they already were. Here the retry is the whole story.
 */
export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[auth error]", error);
  }, [error]);

  return (
    <div className="w-full max-w-md rounded-none bg-white p-6 ring-1 ring-surface-border dark:bg-night-card dark:ring-night-border">
      <ErrorState
        error={error}
        reset={reset}
        compact
        title="Sign-in is unavailable"
        description="This page failed to load. Try again — if it keeps failing, the API may be unreachable."
      />
    </div>
  );
}
