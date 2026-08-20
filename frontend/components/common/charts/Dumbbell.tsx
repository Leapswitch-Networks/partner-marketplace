"use client";

import { GRID, MARK, SURFACE, compact, seriesColor } from "./tokens";

/**
 * Before → after, per item.
 *
 * Two dots joined by a rule: the gap between them *is* the change, so the reader
 * measures a length rather than subtracting two bar heights. Far better than a
 * grouped bar for this specific question.
 *
 * **One hue, two shades** — not two categorical slots. Before and after are the same
 * measure at two times, so this is depth, not identity: the lighter dot is "before"
 * and the darker one "after", which also means the direction of travel reads without
 * the legend.
 *
 * Both dots carry the 2px surface ring, which matters here because they can sit
 * almost on top of each other when an item barely moved.
 */
export default function Dumbbell({
  data,
  height,
  beforeLabel = "Before",
  afterLabel = "After",
  valueFormat = compact,
}: {
  data: { label: string; before: number; after: number }[];
  height?: number;
  beforeLabel?: string;
  afterLabel?: string;
  valueFormat?: (n: number) => string;
}) {
  if (!data.length) return null;

  const W = 600;
  const rowH = 30;
  const labelW = 140;
  const valueW = 64;
  const H = height ?? data.length * rowH + 24;
  const all = data.flatMap((d) => [d.before, d.after]);
  const max = Math.max(...all, 1);
  const min = Math.min(...all, 0);
  const span = max - min || 1;
  const plotW = W - labelW - valueW;
  const x = (v: number) => labelW + ((v - min) / span) * plotW;

  const shadeBefore = "rgb(var(--chart-seq-2))";
  const shadeAfter = seriesColor(0);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" role="img" aria-label={`${beforeLabel} against ${afterLabel} per item`}>
      {data.map((d, i) => {
        const cy = i * rowH + rowH / 2 + 4;
        return (
          <g key={d.label}>
            <text x={labelW - 10} y={cy} textAnchor="end" dominantBaseline="middle" className="fill-ink text-[11px] dark:fill-white">
              {d.label.length > 20 ? `${d.label.slice(0, 19)}…` : d.label}
            </text>
            {/* The connector is the data. Recessive weight so the dots read as the
                endpoints rather than the line reading as a bar. */}
            <line x1={x(d.before)} x2={x(d.after)} y1={cy} y2={cy} stroke={GRID} strokeWidth={MARK.lineWidth} strokeLinecap="round" />
            <circle cx={x(d.before)} cy={cy} r={MARK.dotRadius + MARK.ring} fill={SURFACE} />
            <circle cx={x(d.before)} cy={cy} r={MARK.dotRadius} fill={shadeBefore} />
            <circle cx={x(d.after)} cy={cy} r={MARK.dotRadius + MARK.ring} fill={SURFACE} />
            <circle cx={x(d.after)} cy={cy} r={MARK.dotRadius} fill={shadeAfter} />
            <text x={W - 6} y={cy} textAnchor="end" dominantBaseline="middle" className="fill-ink text-[11px] font-semibold tabular-nums dark:fill-white">
              {valueFormat(d.after - d.before) === "0" ? "—" : `${d.after > d.before ? "+" : ""}${valueFormat(d.after - d.before)}`}
            </text>
          </g>
        );
      })}
      <g transform={`translate(${labelW}, ${H - 4})`}>
        <circle cx={4} cy={-4} r={4} fill={shadeBefore} />
        <text x={13} y={-1} className="fill-ink-label text-[9px] dark:fill-night-muted">{beforeLabel}</text>
        <circle cx={76} cy={-4} r={4} fill={shadeAfter} />
        <text x={85} y={-1} className="fill-ink-label text-[9px] dark:fill-night-muted">{afterLabel}</text>
      </g>
    </svg>
  );
}
