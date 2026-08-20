"use client";

import { useId, useState } from "react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";
import SurfaceCard from "@/components/common/cards/SurfaceCard";
import { headingClasses } from "@/components/common/PageHeading";

/**
 * The shell every chart sits in: title, legend, the plot, and a table view.
 *
 * ## The table view is not optional
 *
 * Every chart here ships one, and it is why a sub-3:1 fill or a colourblind-floor
 * warning is survivable at all: the numbers are always reachable without reading
 * colour or hovering anything. It is also the answer for screen readers, for print,
 * and for anyone who just wants the figures. **A chart without it is not finished.**
 *
 * ## Legend rules
 *
 * Present whenever there are **two or more** series — colour-matching alone is never
 * the identity channel. **Absent for one series**, where the title already says what
 * is plotted and a one-swatch box would just restate it.
 *
 * The swatch carries the colour; the text does not. A categorical hue used as text
 * is illegible on the surface, so labels stay on ink tokens throughout.
 */
export interface Series {
  label: string;
  color: string;
}

export default function ChartFrame({
  title,
  description,
  series,
  /** Column headers for the table view — typically the x-axis categories. */
  tableColumns,
  /** One row per series: the values in the same order as `tableColumns`. */
  tableRows,
  actions,
  height = 200,
  children,
  className,
}: {
  title: string;
  description?: string;
  series?: Series[];
  tableColumns?: string[];
  tableRows?: { label: string; values: (string | number)[] }[];
  actions?: ReactNode;
  height?: number;
  children: ReactNode;
  className?: string;
}) {
  const [showTable, setShowTable] = useState(false);
  const tableId = useId();
  const hasTable = Boolean(tableColumns?.length && tableRows?.length);

  return (
    <SurfaceCard ground="paper" padding="md" className={className}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className={`${headingClasses("section")} text-ink dark:text-white`}>{title}</h3>
          {description && (
            <p className="mt-0.5 text-xs text-ink-label dark:text-night-muted">{description}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {actions}
          {hasTable && (
            <button
              type="button"
              onClick={() => setShowTable((v) => !v)}
              aria-expanded={showTable}
              aria-controls={tableId}
              className="rounded-[5px] border border-brand/25 px-2 py-1 text-[11px] font-semibold text-brand transition-colors hover:bg-brand/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ring-offset-white dark:text-brand-on-dark dark:ring-offset-night-card"
            >
              {showTable ? "Chart" : "Table"}
            </button>
          )}
        </div>
      </div>

      {/* A legend for two or more series, never for one — see the docblock. The
          swatch is the identity channel; the text wears an ink token. */}
      {series && series.length > 1 && (
        <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {series.map((s) => (
            <li
              key={s.label}
              className="flex items-center gap-1.5 text-[11px] font-medium text-ink-label dark:text-night-muted"
            >
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                style={{ backgroundColor: s.color }}
              />
              {s.label}
            </li>
          ))}
        </ul>
      )}

      {showTable && hasTable ? (
        /* `overflow-x-auto` on the table's own container: wide content scrolls
           inside itself so the page body never scrolls sideways. */
        <div id={tableId} className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="border-b border-brand/20 px-2 py-1.5 text-left font-semibold text-ink-label dark:border-night-border dark:text-night-muted">
                  Series
                </th>
                {tableColumns!.map((c) => (
                  <th
                    key={c}
                    className="border-b border-brand/20 px-2 py-1.5 text-right font-semibold text-ink-label dark:border-night-border dark:text-night-muted"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows!.map((r) => (
                <tr key={r.label}>
                  <td className="px-2 py-1.5 text-ink dark:text-white">{r.label}</td>
                  {r.values.map((v, i) => (
                    /* `tabular-nums` HERE and not on the chart's own big figures:
                       columns of digits must align vertically; a display-size
                       number looks loose with every glyph the width of a zero. */
                    <td
                      key={i}
                      className="px-2 py-1.5 text-right font-semibold tabular-nums text-ink dark:text-white"
                    >
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={cn("mt-3 w-full")} style={{ height }}>
          {children}
        </div>
      )}
    </SurfaceCard>
  );
}
