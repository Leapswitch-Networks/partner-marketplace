"use client";

import { GRID, MARK, compact, seriesColor } from "./tokens";

/**
 * Two or three series side by side per category — for telling distinct series apart.
 *
 * This is the one form where **categorical** colour is genuinely the job: the series
 * *are* the subject. Bars within a group are separated by the 2px surface gap, the
 * same width as everywhere else, so neighbours read distinct because of the gap
 * rather than a stroke.
 *
 * Capped at three series. Past that the groups get too dense to compare and the
 * right answer is small multiples — one facet per series, each a single colour.
 */
export default function GroupedBar({
  categories,
  series,
  height = 200,
  valueFormat = compact,
}: {
  categories: string[];
  series: { label: string; values: number[] }[];
  height?: number;
  valueFormat?: (n: number) => string;
}) {
  if (!categories.length || !series.length) return null;
  if (series.length > 3) {
    throw new Error(
      `GroupedBar: ${series.length} series is too dense to compare. Use small multiples — ` +
        `one facet per series, each in slot 1 — or fold the tail into "Other".`
    );
  }

  const W = 600;
  const padL = 40;
  const padR = 12;
  const padB = 22;
  const padT = 8;
  const H = height;
  const max = Math.max(...series.flatMap((s) => s.values), 1);
  const groupW = (W - padL - padR) / categories.length;
  const barW = Math.min(MARK.barMax, (groupW - MARK.gap * (series.length + 1)) / series.length);
  const y = (v: number) => H - padB - (v / max) * (H - padT - padB);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" role="img" aria-label={`${series.map((s) => s.label).join(" and ")} by category`}>
      {[0, max / 2, max].map((t) => (
        <g key={t}>
          <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
          <text x={padL - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" className="fill-ink-label text-[10px] tabular-nums dark:fill-night-muted">
            {valueFormat(Math.round(t))}
          </text>
        </g>
      ))}

      {categories.map((c, ci) => (
        <g key={c}>
          <text
            x={padL + ci * groupW + groupW / 2}
            y={H - 6}
            textAnchor="middle"
            className="fill-ink-label text-[10px] dark:fill-night-muted"
          >
            {c.length > 9 ? `${c.slice(0, 8)}…` : c}
          </text>
          {series.map((s, si) => {
            const v = s.values[ci] ?? 0;
            const h = Math.max(0, H - padB - y(v));
            const x = padL + ci * groupW + MARK.gap + si * (barW + MARK.gap);
            const r = Math.min(MARK.barRadius, h);
            return (
              /* Rounded at the top (the data end), square at the baseline. */
              <path
                key={s.label}
                d={
                  h <= r
                    ? `M${x},${H - padB - h} h${barW} v${h} h${-barW} Z`
                    : `M${x},${H - padB} v${-(h - r)} a${r},${r} 0 0 1 ${r},${-r} h${barW - r * 2} a${r},${r} 0 0 1 ${r},${r} v${h - r} Z`
                }
                fill={seriesColor(si)}
              />
            );
          })}
        </g>
      ))}
    </svg>
  );
}
