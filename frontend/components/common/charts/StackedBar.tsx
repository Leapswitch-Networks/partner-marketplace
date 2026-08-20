"use client";

import { MARK, SURFACE, seriesColor } from "./tokens";

/**
 * Part-to-whole — one horizontal bar, split.
 *
 * A stacked bar rather than a pie or a donut: the segments share a common baseline
 * and a common direction, so they can actually be compared. A donut asks the reader
 * to compare angles, which nobody does well, and it wastes its centre.
 *
 * **The 2px gaps between segments are painted in the surface colour, not stroked.**
 * A stroke around each segment would add ink that is not data and would darken the
 * whole bar; the gap does the separating and costs nothing. One consistent width
 * across the stack.
 *
 * Labels go **outside**, in the legend and the readout below — an interior segment
 * has no free end to label, and text clipped by its own segment is worse than no
 * text. Which is also why `ChartFrame`'s table view is mandatory: the exact numbers
 * are always one click away.
 */
export default function StackedBar({
  segments,
  height = 14,
  showShare = true,
}: {
  segments: { label: string; value: number }[];
  height?: number;
  /** Show `label — n (x%)` beneath the bar. The values with no room inside it. */
  showShare?: boolean;
}) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  if (total <= 0) {
    return (
      <p className="text-xs text-ink-label dark:text-night-muted">
        Nothing recorded yet.
      </p>
    );
  }

  return (
    <div>
      <div
        className="flex w-full overflow-hidden rounded-[2px]"
        style={{ height, gap: MARK.gap, backgroundColor: SURFACE }}
        role="img"
        aria-label={segments.map((s) => `${s.label} ${s.value}`).join(", ")}
      >
        {/* ⚠️ The colour comes from the segment's ORIGINAL index, and the filter
            happens after. Mapping over the filtered list instead — which is what
            this did first — repaints every survivor the moment one segment reaches
            zero, so a reader who learned "pending is teal" is then misled. Colour
            follows the entity, never its current position. */}
        {segments
          .map((s, i) => ({ ...s, colour: seriesColor(i) }))
          .filter((s) => s.value > 0)
          .map((s) => (
            <div
              key={s.label}
              style={{ flexGrow: s.value, backgroundColor: s.colour }}
              className="h-full first:rounded-l-[2px] last:rounded-r-[2px]"
            />
          ))}
      </div>

      {showShare && (
        <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
          {segments.map((s, i) => (
            <li
              key={s.label}
              className="flex items-center gap-1.5 text-[11px] text-ink-label dark:text-night-muted"
            >
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                style={{ backgroundColor: seriesColor(i) }}
              />
              <span className="text-ink dark:text-white">{s.label}</span>
              <span className="font-semibold tabular-nums text-ink dark:text-white">
                {s.value.toLocaleString()}
              </span>
              <span className="tabular-nums">{Math.round((s.value / total) * 100)}%</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
