import Skeleton from "@/components/common/Skeleton";

/**
 * Dashboard loading state (TECH_DEBT PM-19).
 *
 * Shaped like an index page — header row, filter row, then table rows — because
 * that is what most dashboard sections resolve into. Rendering inside
 * `app/dashboard/layout.tsx` means the sidebar and top nav are already on screen,
 * so this fills only the panel.
 */
export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-3 p-4 sm:p-6" role="status" aria-label="Loading">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 flex-1 min-w-[180px]" />
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="mt-1 flex flex-col gap-2">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-10" />
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
