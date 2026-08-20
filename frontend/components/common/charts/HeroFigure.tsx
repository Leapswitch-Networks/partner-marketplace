import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";
import { compact } from "./tokens";

/**
 * The one number a view leads with. **Exactly one per screen.**
 *
 * ## Sans, not the display face — deliberately
 *
 * Every other heading in this app is set in the shared serif, and this is the one
 * place that would be wrong. A hero figure in a display or serif face reads as
 * decoration rather than data; the visualization guidance is explicit about it, and
 * a number is not a headline. It is the one considered exception to § 3.
 *
 * ## Proportional figures, not tabular
 *
 * `tabular-nums` gives every digit the width of a zero, which is right in a column
 * and wrong at display size — `121` comes out visibly gappy. Tabular is for the
 * table view and the axis ticks.
 */
export default function HeroFigure({
  label,
  value,
  sub,
  delta,
  trend,
  className,
}: {
  label: string;
  value: number | string;
  /** One clause under the number. */
  sub?: string;
  /** Signed, and always against a named period — "+18% vs last month". */
  delta?: ReactNode;
  /** A `Sparkline`, usually. */
  trend?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-label dark:text-night-muted">
        {label}
      </p>
      <div className="mt-1.5 flex flex-wrap items-end gap-x-4 gap-y-2">
        {/* No `app-display` here, and no `tabular-nums`. See the docblock. */}
        <p className="text-[52px] font-semibold leading-none text-ink dark:text-white">
          {typeof value === "number" ? compact(value) : value}
        </p>
        {trend && <span className="mb-1">{trend}</span>}
      </div>
      {(sub || delta) && (
        <p className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-ink-label dark:text-night-muted">
          {delta}
          {sub && <span>{sub}</span>}
        </p>
      )}
    </div>
  );
}
