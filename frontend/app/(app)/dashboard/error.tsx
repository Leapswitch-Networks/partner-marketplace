"use client";

import { useEffect } from "react";
import ErrorState from "@/components/common/ErrorState";

/**
 * Dashboard error boundary (TECH_DEBT PM-19).
 *
 * Scoped to the dashboard segment so a failure in one module — the users table,
 * the permission matrix — does not take the whole application down. Because this
 * boundary sits *inside* `app/dashboard/layout.tsx`, the sidebar and top nav
 * survive and the user can navigate elsewhere instead of reaching for the back
 * button.
 *
 * `compact` because it renders inside the dashboard's own padded panel; the
 * viewport-filling variant would double the vertical whitespace.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard error]", error);
  }, [error]);

  return (
    <ErrorState
      error={error}
      reset={reset}
      compact
      title="This section could not be loaded"
      description="The rest of the dashboard is still available. Try again, or pick another section from the sidebar."
    />
  );
}
