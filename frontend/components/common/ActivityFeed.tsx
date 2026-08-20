import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * A vertical run of events — what happened, and when.
 *
 * Not a chart: a sequence of discrete events has no magnitude to encode, so drawing
 * it as one would be inventing a measurement. It is a list, and the design work is
 * information hierarchy rather than colour.
 *
 * The rail is a 1px hairline with a dot per event, which is the cheapest way to say
 * "these are in order" — no per-item border, no card per row. `tone` marks the few
 * events that are not routine, and it always arrives with the label saying so, never
 * as colour alone.
 *
 * Timestamps are `tabular-nums` and right-aligned so they form a readable column;
 * they are the one thing here that lines up vertically.
 */
export interface ActivityItem {
  id: string | number;
  /** What happened. Written from the reader's side — "Invited a partner", not "POST /invitations". */
  title: ReactNode;
  /** Who, or any second line. */
  meta?: ReactNode;
  /** Pre-formatted. This component does not guess a locale. */
  time: string;
  tone?: "neutral" | "good" | "warning" | "critical";
  icon?: ReactNode;
}

const DOT: Record<NonNullable<ActivityItem["tone"]>, string> = {
  neutral: "bg-brand dark:bg-brand-on-dark",
  good: "bg-tone-success dark:bg-brand-on-dark",
  warning: "bg-tone-warning",
  critical: "bg-[rgb(var(--tone-danger-on-dark))]",
};

export default function ActivityFeed({
  items,
  className,
  emptyLabel = "Nothing recorded yet.",
}: {
  items: ActivityItem[];
  className?: string;
  emptyLabel?: string;
}) {
  if (!items.length) {
    return <p className="text-xs text-ink-label dark:text-night-muted">{emptyLabel}</p>;
  }

  return (
    <ol className={cn("relative", className)}>
      {/* One rail behind every row, inset to pass through the dots' centres. It
          stops at the last dot rather than running past it — a rail that continues
          into empty space implies there is more below. */}
      <span
        aria-hidden="true"
        className="absolute bottom-3 left-[3.5px] top-3 w-[1px] bg-brand/20 dark:bg-night-border"
      />
      {items.map((item) => (
        <li key={item.id} className="relative flex gap-3 py-2 pl-0">
          <span
            aria-hidden="true"
            className={cn("mt-[7px] h-2 w-2 shrink-0 rounded-full", DOT[item.tone ?? "neutral"])}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="min-w-0 text-xs font-semibold text-ink dark:text-white">
                {item.icon && (
                  <span className="mr-1.5 inline-block align-[-2px] text-brand dark:text-brand-on-dark">
                    {item.icon}
                  </span>
                )}
                {item.title}
              </p>
              <time className="shrink-0 text-[11px] tabular-nums text-ink-label dark:text-night-muted">
                {item.time}
              </time>
            </div>
            {item.meta && (
              <p className="mt-0.5 text-[11px] text-ink-label dark:text-night-muted">{item.meta}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
