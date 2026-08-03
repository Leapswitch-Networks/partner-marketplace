import Skeleton from "@/components/common/Skeleton";

/**
 * Root route loading state (TECH_DEBT PM-19).
 *
 * Next renders this as the Suspense fallback while a route segment resolves.
 * Skeletons rather than a spinner, reusing the existing `Skeleton` component:
 * blocks roughly the shape of the content that follows keep the layout from
 * jumping when it arrives, which a centred spinner does not.
 */
export default function Loading() {
  return (
    <div className="flex flex-col gap-4 p-6" role="status" aria-label="Loading">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-80" />
      <div className="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
