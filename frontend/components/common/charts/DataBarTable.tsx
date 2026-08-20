"use client";

import { SEQUENTIAL, compact, seriesColor } from "./tokens";

/**
 * A ranked table with the magnitude drawn behind each row.
 *
 * **This is the endorsed answer to "too many categories."** Past roughly seven
 * classes that all carry meaning, colours stop being distinguishable and a chart
 * stops helping — the guidance says use a table, or a table plus a chart. This is
 * both: exact numbers, in order, with a bar so the shape is still readable at a
 * glance.
 *
 * ## The tail folds into "Other" rather than being dropped
 *
 * `limit` keeps the top N and sums the rest into one final row. Truncating silently
 * is the failure this avoids: a top-five list that looks like the whole list makes a
 * reader think they have seen everything. The Other row is rendered in the neutral
 * track so it reads as an aggregate rather than as a competitor.
 */
export default function DataBarTable({
  rows,
  limit,
  valueLabel = "Value",
  valueFormat = compact,
  otherLabel = "Other",
}: {
  rows: { label: string; value: number }[];
  /** Keep this many and fold the remainder into one row. */
  limit?: number;
  valueLabel?: string;
  valueFormat?: (n: number) => string;
  otherLabel?: string;
}) {
  if (!rows.length) return null;

  const sorted = [...rows].sort((a, b) => b.value - a.value);
  let shown = sorted;
  let other: { label: string; value: number; count: number } | null = null;

  if (limit && sorted.length > limit) {
    shown = sorted.slice(0, limit);
    const tail = sorted.slice(limit);
    other = {
      label: `${otherLabel} (${tail.length})`,
      value: tail.reduce((a, r) => a + r.value, 0),
      count: tail.length,
    };
  }

  const total = sorted.reduce((a, r) => a + r.value, 0) || 1;
  const max = Math.max(...sorted.map((r) => r.value), 1);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="border-b border-brand/20 px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-label dark:border-night-border dark:text-night-muted">
              Category
            </th>
            <th className="w-[42%] border-b border-brand/20 px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-label dark:border-night-border dark:text-night-muted">
              {valueLabel}
            </th>
            <th className="border-b border-brand/20 px-2 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wider text-ink-label dark:border-night-border dark:text-night-muted">
              Share
            </th>
          </tr>
        </thead>
        <tbody>
          {[...shown, ...(other ? [other] : [])].map((r, i) => {
            const isOther = Boolean(other) && i === shown.length;
            return (
              <tr key={r.label} className="border-b border-brand/10 last:border-0 dark:border-night-border/60">
                <td className="max-w-[180px] truncate px-2 py-1.5 text-ink dark:text-white">{r.label}</td>
                <td className="px-2 py-1.5">
                  <div className="flex items-center gap-2">
                    <span className="h-2 flex-1 rounded-[2px]" style={{ backgroundColor: SEQUENTIAL[0] }}>
                      <span
                        className="block h-full rounded-[2px]"
                        style={{
                          width: `${(r.value / max) * 100}%`,
                          /* One colour for real rows — the bar length already
                             encodes magnitude, so shading it by value would spend
                             the colour channel on nothing. Other gets the neutral
                             track so it reads as an aggregate. */
                          backgroundColor: isOther ? SEQUENTIAL[1] : seriesColor(0),
                        }}
                      />
                    </span>
                    <span className="w-12 shrink-0 text-right font-semibold tabular-nums text-ink dark:text-white">
                      {valueFormat(r.value)}
                    </span>
                  </div>
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums text-ink-label dark:text-night-muted">
                  {Math.round((r.value / total) * 100)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
