"use client";

import { SEQUENTIAL, compact } from "./tokens";

/**
 * Ordered stages, and what falls out between them.
 *
 * **Ordinal, not categorical.** Swapping two stages would change the meaning, which
 * is the test: the colour therefore carries the *order* — one hue, darkening down the
 * funnel — rather than identity. Spending five categorical hues here would say the
 * stages are five unrelated things.
 *
 * Rendered as stacked horizontal bars rather than the tapering trapezoid a "funnel
 * chart" usually means. The taper encodes the value twice (width *and* the sloping
 * edge) and the slope makes adjacent stages look closer than they are. A bar's
 * length is the value, full stop.
 *
 * The drop-off between stages is the number people actually want, so it is shown
 * explicitly instead of being left as a subtraction.
 */
export default function FunnelChart({
  stages,
  valueFormat = compact,
}: {
  stages: { label: string; value: number }[];
  valueFormat?: (n: number) => string;
}) {
  if (!stages.length) return null;
  const top = stages[0].value || 1;

  return (
    <ol className="space-y-2">
      {stages.map((s, i) => {
        const pct = (s.value / top) * 100;
        const prev = i > 0 ? stages[i - 1].value : null;
        const drop = prev && prev > 0 ? Math.round(((prev - s.value) / prev) * 100) : null;
        // Depth follows position in the sequence, not magnitude — the order is what
        // the colour is encoding.
        const colour = SEQUENTIAL[Math.min(SEQUENTIAL.length - 1, i)];

        return (
          <li key={s.label} className="min-w-0">
            <div className="flex items-baseline justify-between gap-3">
              <p className="truncate text-[11px] font-semibold text-ink dark:text-white">
                {s.label}
              </p>
              <p className="shrink-0 text-[11px] tabular-nums">
                <span className="font-semibold text-ink dark:text-white">{valueFormat(s.value)}</span>
                <span className="ml-1.5 text-ink-label dark:text-night-muted">
                  {Math.round(pct)}% of first
                </span>
                {drop !== null && drop > 0 && (
                  <span className="ml-1.5 font-semibold text-tone-danger dark:text-[rgb(var(--tone-danger-on-dark))]">
                    −{drop}%
                  </span>
                )}
              </p>
            </div>
            <div className="mt-1 h-3 w-full rounded-[2px]" style={{ backgroundColor: SEQUENTIAL[0] }}>
              <div
                className="h-full rounded-[2px]"
                style={{ width: `${Math.max(pct, 1)}%`, backgroundColor: colour }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
