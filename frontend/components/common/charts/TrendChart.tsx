"use client";

import { useState } from "react";

import { GRID, MARK, SURFACE, compact, seriesColor } from "./tokens";

/**
 * Change over time — one line, or a few, with a crosshair and a tooltip.
 *
 * ## The hover layer ships by default
 *
 * An SVG chart *is* interactive, so a line chart without a readout is an unfinished
 * one: the reader can see the shape but cannot get a value. The crosshair snaps to
 * the nearest x index across the **full plot height**, not to each dot — dots are
 * 8px and a pointer is not that precise, and a hit target smaller than the mark is
 * how a tooltip ends up feeling broken.
 *
 * ## Deliberately absent: a second y-axis
 *
 * Two measures of different scale get two charts, or get indexed to a common base.
 * A dual axis lets the author decide where the lines cross, which means the chart
 * can be made to say anything.
 *
 * ## Labels
 *
 * The endpoint of each series is labelled and nothing else. A value on every point
 * is unreadable, and it is the axis and the tooltip's job to carry the rest. Past
 * four converging series, end labels detach from their lines — use the legend and
 * the table view instead of nudging them apart.
 */
export interface TrendSeries {
  label: string;
  values: number[];
}

export default function TrendChart({
  series,
  labels,
  height = 200,
  /** Fill under the line. Only honest for a single series — stacked washes lie. */
  area,
  valueFormat = compact,
}: {
  series: TrendSeries[];
  labels: string[];
  height?: number;
  area?: boolean;
  valueFormat?: (n: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const W = 600;
  const padL = 40;
  const padR = 16;
  const padT = 12;
  const padB = 24;
  const H = height;

  const all = series.flatMap((s) => s.values);
  if (!all.length || labels.length < 2) return null;

  const max = Math.max(...all, 0);
  const min = Math.min(...all, 0);
  const span = max - min || 1;
  const n = labels.length;

  const x = (i: number) => padL + (i / (n - 1)) * (W - padL - padR);
  const y = (v: number) => H - padB - ((v - min) / span) * (H - padT - padB);

  // Clean tick values rather than whatever the data happens to end on.
  const ticks = [min, min + span / 2, max].map((v) => Math.round(v));
  const showArea = Boolean(area) && series.length === 1;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-full w-full"
      role="img"
      aria-label={`${series.map((s) => s.label).join(", ")} over ${labels[0]} to ${labels[n - 1]}`}
      onMouseLeave={() => setHover(null)}
      onMouseMove={(e) => {
        const box = e.currentTarget.getBoundingClientRect();
        const px = ((e.clientX - box.left) / box.width) * W;
        const t = (px - padL) / (W - padL - padR);
        setHover(Math.min(n - 1, Math.max(0, Math.round(t * (n - 1)))));
      }}
    >
      {/* Gridlines: 1px, solid, one step off the surface. Never dashed — a dashed
          rule reads as data. Horizontal only; vertical ones fight the marks. */}
      {ticks.map((t) => (
        <g key={t}>
          <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
          <text
            x={padL - 8}
            y={y(t)}
            textAnchor="end"
            dominantBaseline="middle"
            className="fill-ink-label text-[10px] tabular-nums dark:fill-night-muted"
          >
            {valueFormat(t)}
          </text>
        </g>
      ))}

      {/* First, middle and last only — every x label is a collision at this width. */}
      {[0, Math.floor((n - 1) / 2), n - 1].map((i) => (
        <text
          key={i}
          x={x(i)}
          y={H - 6}
          textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
          className="fill-ink-label text-[10px] dark:fill-night-muted"
        >
          {labels[i]}
        </text>
      ))}

      {hover !== null && (
        <line
          x1={x(hover)}
          x2={x(hover)}
          y1={padT}
          y2={H - padB}
          stroke={GRID}
          strokeWidth={1}
        />
      )}

      {series.map((s, si) => {
        const colour = seriesColor(si);
        const path = s.values
          .map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(2)},${y(v).toFixed(2)}`)
          .join(" ");
        return (
          <g key={s.label}>
            {showArea && (
              <path
                d={`${path} L${x(n - 1).toFixed(2)},${H - padB} L${padL},${H - padB} Z`}
                fill={colour}
                opacity={MARK.areaOpacity}
              />
            )}
            <path
              d={path}
              fill="none"
              stroke={colour}
              strokeWidth={MARK.lineWidth}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {/* The endpoint, ringed in the surface colour so it survives crossing
                another line. Only the endpoint is labelled. */}
            <circle
              cx={x(n - 1)}
              cy={y(s.values[n - 1])}
              r={MARK.dotRadius + MARK.ring}
              fill={SURFACE}
            />
            <circle cx={x(n - 1)} cy={y(s.values[n - 1])} r={MARK.dotRadius} fill={colour} />

            {hover !== null && (
              <>
                <circle cx={x(hover)} cy={y(s.values[hover])} r={MARK.dotRadius + MARK.ring} fill={SURFACE} />
                <circle cx={x(hover)} cy={y(s.values[hover])} r={MARK.dotRadius} fill={colour} />
              </>
            )}
          </g>
        );
      })}

      {/* The readout. Text on an ink token, never on the series colour — a
          categorical hue is illegible as text; the dot beside it carries identity. */}
      {hover !== null && (
        <g transform={`translate(${Math.min(x(hover) + 10, W - padR - 118)}, ${padT})`}>
          <rect width={112} height={18 + series.length * 14} rx={3} fill={SURFACE} stroke={GRID} />
          <text x={8} y={13} className="fill-ink-label text-[10px] font-semibold dark:fill-night-muted">
            {labels[hover]}
          </text>
          {series.map((s, si) => (
            <g key={s.label} transform={`translate(8, ${26 + si * 14})`}>
              <rect width={7} height={7} y={-6} rx={1.5} fill={seriesColor(si)} />
              <text x={13} className="fill-ink text-[10px] dark:fill-white">
                {s.label}
              </text>
              <text x={104} textAnchor="end" className="fill-ink text-[10px] font-semibold tabular-nums dark:fill-white">
                {valueFormat(s.values[hover])}
              </text>
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}
