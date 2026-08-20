import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import { cn } from "@/lib/utils/cn";
import SurfaceCard, { groundText, type MetricGround } from "./SurfaceCard";

/**
 * One number, what it is, and which way it is going.
 *
 * The figure sits on the **right**, baseline-aligned with the label — the layout
 * the owner asked for on `StatTiles` on 2026-08-20, applied here so the two read
 * as the same family. Baseline rather than top alignment is what makes a `text-3xl`
 * figure and a `text-xs` label look like one row; and because a flex item that is
 * itself a block aligns on its **first** line box, a two-line description never
 * moves the figure out of line with its neighbours'.
 *
 * ## `delta` is a pair, not a colour
 *
 * The direction is carried by a glyph *and* a colour, never colour alone — the
 * house rule `Badge` and `StatTiles` both follow, so a reader who cannot separate
 * the two hues still gets the answer. `groundText()` supplies the pair that belongs
 * to the ground, so a green "up" never lands on the pine slab where it would say
 * nothing.
 *
 * `direction` is separate from the sign of `delta` on purpose: for churn or cost, a
 * fall is good news, and only the caller knows that.
 */
export interface MetricCardProps {
  label: string;
  value: ReactNode;
  /** One clause of context. Genuinely optional. */
  hint?: ReactNode;
  /** e.g. `"+12.4%"`, `"−3"`, `"unchanged"`. Rendered verbatim. */
  delta?: string;
  /** Which way the arrow points, and which half of the ground's pair it takes. */
  direction?: "up" | "down" | "flat";
  /** `"good"` paints `direction` with the ground's success colour, `"bad"` with its danger. */
  sentiment?: "good" | "bad" | "neutral";
  /** A small mark beside the label — a `lucide-react` icon at `h-3.5 w-3.5`. */
  icon?: ReactNode;
  ground?: MetricGround;
  href?: string;
  className?: string;
}

export default function MetricCard({
  label,
  value,
  hint,
  delta,
  direction = "flat",
  sentiment = "neutral",
  icon,
  ground = "paper",
  href,
  className,
}: MetricCardProps) {
  const t = groundText(ground);

  const Arrow = direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : Minus;
  const deltaColour =
    sentiment === "good" ? t.success : sentiment === "bad" ? t.danger : t.muted;

  return (
    <SurfaceCard ground={ground} padding="md" href={href} className={className}>
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className={cn("flex items-center gap-1.5 text-xs font-semibold", t.body)}>
            {icon && (
              <span aria-hidden="true" className={cn("shrink-0 [&>svg]:h-3.5 [&>svg]:w-3.5", t.emphasis)}>
                {icon}
              </span>
            )}
            {/* Truncate, not wrap: these sit in a 2-up grid at 360px, and a label
                that wraps sets the height of every card in the row. */}
            <span className="truncate">{label}</span>
          </p>
          {hint && <p className={cn("mt-0.5 text-[11px] leading-snug", t.muted)}>{hint}</p>}
        </div>

        {/* `shrink-0 whitespace-nowrap`: the figure is the one thing that must never
            wrap or clip. The label gives way instead. */}
        <p className={cn("app-display shrink-0 whitespace-nowrap text-[28px] leading-none", t.emphasis)}>
          {value}
        </p>
      </div>

      {delta && (
        <p className={cn("mt-3 flex items-center gap-1 text-[11px] font-semibold", deltaColour)}>
          <Arrow aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          {/* The direction is in the text too, so the arrow is never the only signal. */}
          <span className="sr-only">
            {direction === "up" ? "up" : direction === "down" ? "down" : "unchanged"}
          </span>
          <span className="truncate">{delta}</span>
        </p>
      )}
    </SurfaceCard>
  );
}
