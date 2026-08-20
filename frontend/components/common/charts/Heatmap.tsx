"use client";

import { GRID, MARK, SURFACE, sequentialStep } from "./tokens";

/**
 * Magnitude on a grid — the activity calendar shape.
 *
 * Sequential, one hue, more-is-darker: the cells encode *how much*, and identity is
 * carried by their position, so spending a categorical hue here would be spending it
 * on nothing.
 *
 * **The 2px separation between cells is the surface showing through**, not a stroke
 * around each cell — a stroke on a grid this dense doubles the ink and darkens the
 * whole block. An empty cell keeps its slot in the neutral track so the grid stays
 * legible as a grid rather than becoming ragged.
 *
 * Every cell carries a `<title>`, which is what makes a 350-cell grid readable at
 * all without a tooltip layer: the browser's own hover text does the job, and it
 * works for a keyboard and a screen reader too.
 */
export default function Heatmap({
  rows,
  columns,
  values,
  cell = 14,
  valueLabel = "",
}: {
  /** Row headings — days of the week, say. */
  rows: string[];
  /** Column headings. Only the first, middle and last are drawn. */
  columns: string[];
  /** `values[rowIndex][columnIndex]`. */
  values: number[][];
  cell?: number;
  /** Appended in the hover text: "12 enquiries". */
  valueLabel?: string;
}) {
  const flat = values.flat();
  if (!flat.length) return null;

  const rowLabelW = 34;
  const gap = MARK.gap;
  const max = Math.max(...flat);
  const min = Math.min(...flat);
  const W = rowLabelW + columns.length * (cell + gap);
  const H = rows.length * (cell + gap) + 18;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" role="img" aria-label={`Grid of ${valueLabel || "values"} by ${rows.length} rows and ${columns.length} columns`}>
      {rows.map((r, ri) => (
        <text
          key={r}
          x={rowLabelW - 6}
          y={ri * (cell + gap) + cell / 2 + 2}
          textAnchor="end"
          dominantBaseline="middle"
          className="fill-ink-label text-[9px] dark:fill-night-muted"
        >
          {r}
        </text>
      ))}

      {[0, Math.floor((columns.length - 1) / 2), columns.length - 1].map((ci) => (
        <text
          key={ci}
          x={rowLabelW + ci * (cell + gap) + cell / 2}
          y={H - 4}
          textAnchor={ci === 0 ? "start" : ci === columns.length - 1 ? "end" : "middle"}
          className="fill-ink-label text-[9px] dark:fill-night-muted"
        >
          {columns[ci]}
        </text>
      ))}

      {values.map((row, ri) =>
        row.map((v, ci) => (
          <rect
            key={`${ri}-${ci}`}
            x={rowLabelW + ci * (cell + gap)}
            y={ri * (cell + gap) + 2}
            width={cell}
            height={cell}
            rx={2}
            /* An empty cell keeps its place in the neutral track rather than
               vanishing, so the grid never goes ragged. */
            fill={v <= min ? GRID : sequentialStep(v, min, max)}
          >
            <title>{`${rows[ri]}, ${columns[ci]}: ${v.toLocaleString()}${valueLabel ? ` ${valueLabel}` : ""}`}</title>
          </rect>
        ))
      )}
      {/* The gaps above are the surface showing between cells — this rect is never
          drawn, it documents that `SURFACE` is the separator, not a stroke. */}
      <rect width={0} height={0} fill={SURFACE} />
    </svg>
  );
}
