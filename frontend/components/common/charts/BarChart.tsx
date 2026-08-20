"use client";

import { GRID, MARK, compact, sequentialStep, seriesColor } from "./tokens";

/**
 * Magnitude, low to high — horizontal bars.
 *
 * **Horizontal, not vertical.** These categories are things like "Managed hosting"
 * and "Colocation and rack space": a column chart turns those into rotated labels or
 * truncation, and a rotated label is not a readable label.
 *
 * ## One colour, not a value ramp — corrected 2026-08-20
 *
 * This first shaded each bar darker-where-bigger, and the docstring argued for it.
 * That is wrong for **nominal** categories (service names, teams, endpoints): the
 * shade re-encodes what bar length already shows, spends the one free channel on
 * nothing, and fails the categorical checks by design, since a ramp spans the
 * lightness band and drops under the chroma floor.
 *
 * So the default is **one series, one colour** — slot 1 for every bar. No legend
 * either: there is one colour, and the title says what is plotted.
 *
 * `ordinal` opts into the ramp, and only for categories with a real order — tiers,
 * funnel stages, age bands — where seeing the order *in* the colour is the point.
 * If swapping two categories would not change the meaning, it is not ordinal.
 *
 * Bars are capped at 24px and the band's leftover is left as air rather than
 * stretched; the data end is rounded and the baseline end square, so the bar reads
 * as growing from the axis. Values ride the tip — the one place a label per bar is
 * right, because there is nothing else there.
 */
export default function BarChart({
  data,
  height,
  valueFormat = compact,
  ordinal = false,
}: {
  data: { label: string; value: number }[];
  height?: number;
  valueFormat?: (n: number) => string;
  /** Only for categories with a genuine order. See the docblock. */
  ordinal?: boolean;
}) {
  if (!data.length) return null;

  const W = 600;
  const rowH = 30;
  const labelW = 150;
  const valueW = 52;
  const H = height ?? data.length * rowH + 8;

  const max = Math.max(...data.map((d) => d.value), 1);
  const min = Math.min(...data.map((d) => d.value), 0);
  const plotW = W - labelW - valueW;
  const barH = Math.min(MARK.barMax, rowH - 12);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" role="img" aria-label="Comparison by category">
      {/* One baseline. Recessive, 1px, solid. */}
      <line x1={labelW} x2={labelW} y1={4} y2={data.length * rowH} stroke={GRID} strokeWidth={1} />

      {data.map((d, i) => {
        const w = max <= 0 ? 0 : (d.value / max) * plotW;
        const yTop = i * rowH + (rowH - barH) / 2 + 4;
        const colour = ordinal ? sequentialStep(d.value, min, max) : seriesColor(0);
        const r = Math.min(MARK.barRadius, Math.max(0, w));

        return (
          <g key={d.label}>
            <text
              x={labelW - 10}
              y={yTop + barH / 2}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-ink text-[11px] dark:fill-white"
            >
              {d.label.length > 22 ? `${d.label.slice(0, 21)}…` : d.label}
            </text>

            {/* Rounded at the data end, square at the baseline — drawn as a path
                rather than a rect with a uniform radius, which would round all four
                corners and detach the bar from its axis. */}
            <path
              d={
                w <= r
                  ? `M${labelW},${yTop} h${w} v${barH} h${-w} Z`
                  : `M${labelW},${yTop} h${w - r} a${r},${r} 0 0 1 ${r},${r} v${barH - r * 2} a${r},${r} 0 0 1 ${-r},${r} h${-(w - r)} Z`
              }
              fill={colour}
            />

            <text
              x={labelW + w + 8}
              y={yTop + barH / 2}
              dominantBaseline="middle"
              className="fill-ink text-[11px] font-semibold tabular-nums dark:fill-white"
            >
              {valueFormat(d.value)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
