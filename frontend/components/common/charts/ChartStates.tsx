import type { ReactNode } from "react";

import Skeleton from "@/components/common/Skeleton";

/**
 * The two states every chart has and nobody builds.
 *
 * ## `ChartEmpty`
 *
 * A chart with no rows must say **why** there is nothing, not draw empty axes. Empty
 * axes read as broken; "no enquiries yet" reads as a fact. And it must never show a
 * zero where it has no number — `ANTI_SLOP.md`: omit the block, never zero it.
 *
 * ## `ChartSkeleton`
 *
 * Sized to the chart it replaces, so the panel does not change height when the data
 * lands and shove everything below it down — the same reasoning as the stat tiles
 * sharing one height constant with their skeleton.
 */
export function ChartEmpty({
  title = "Nothing to show yet",
  description,
  action,
  height = 180,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  height?: number;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-1.5 border border-dashed border-brand/25 px-6 text-center dark:border-night-border"
      style={{ height }}
    >
      <p className="text-sm font-semibold text-ink dark:text-white">{title}</p>
      {description && (
        <p className="max-w-xs text-xs leading-relaxed text-ink-label dark:text-night-muted">
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ChartSkeleton({ height = 180 }: { height?: number }) {
  return (
    <div className="flex flex-col justify-end gap-2" style={{ height }}>
      {/* Bars of differing height rather than one grey block: it reads as "a chart
          is coming" instead of "something failed to load". */}
      <div className="flex items-end gap-2" style={{ height: height - 22 }}>
        {/* The height goes on a wrapper: `Skeleton` takes a className and nothing
            else, and an arbitrary Tailwind height per bar would be eight classes
            Tailwind has to find in the source to generate. */}
        {[62, 84, 48, 96, 71, 88, 55, 78].map((h, i) => (
          <div key={i} className="flex flex-1 items-end" style={{ height: `${h}%` }}>
            <Skeleton className="h-full w-full rounded-none" />
          </div>
        ))}
      </div>
      <Skeleton className="h-2.5 w-full rounded-none" />
    </div>
  );
}
