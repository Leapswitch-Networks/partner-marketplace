"use client";

import { MARK, SURFACE, compact, seriesColor } from "./tokens";

/**
 * One small chart per category, on a shared scale.
 *
 * The answer when there are too many series for one plot. Faceting is what the
 * series-count ladder points at past its soft cap, and it is strictly better than
 * generating a ninth hue — which would be indistinguishable from an existing one
 * under colour-blindness anyway.
 *
 * **Every facet is the same colour**, slot 1. That is the whole trick: identity
 * comes from each facet's own heading, so the colour channel stays free and the
 * all-pairs cap — which would otherwise limit a scatter or a small-multiples grid to
 * three series — never binds.
 *
 * 🔴 **One shared scale across every facet.** Per-facet scaling makes a flat series
 * look as dramatic as a steep one, which is the same lie a dual axis tells.
 */
export default function SmallMultiples({
  facets,
  labels,
  columns = 4,
  facetHeight = 56,
  valueFormat = compact,
}: {
  facets: { label: string; values: number[] }[];
  labels: string[];
  columns?: number;
  facetHeight?: number;
  valueFormat?: (n: number) => string;
}) {
  const all = facets.flatMap((f) => f.values);
  if (!all.length || labels.length < 2) return null;

  // One scale, computed across every facet. See the docblock.
  const max = Math.max(...all);
  const min = Math.min(...all, 0);
  const span = max - min || 1;

  const W = 140;
  const pad = MARK.dotRadius + MARK.ring;

  return (
    <div
      className="grid gap-x-4 gap-y-4"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {facets.map((f) => {
        const n = f.values.length;
        const x = (i: number) => pad + (i / (n - 1)) * (W - pad * 2);
        const y = (v: number) => facetHeight - pad - ((v - min) / span) * (facetHeight - pad * 2);
        const path = f.values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(" ");
        const last = f.values[n - 1];

        return (
          <div key={f.label} className="min-w-0">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-[11px] font-semibold text-ink dark:text-white">{f.label}</p>
              <p className="shrink-0 text-[11px] font-semibold tabular-nums text-ink-label dark:text-night-muted">
                {valueFormat(last)}
              </p>
            </div>
            <svg viewBox={`0 0 ${W} ${facetHeight}`} className="mt-1 w-full" role="img" aria-label={`${f.label}, ending at ${valueFormat(last)}`}>
              <path d={`${path} L${x(n - 1).toFixed(2)},${facetHeight} L${x(0).toFixed(2)},${facetHeight} Z`} fill={seriesColor(0)} opacity={MARK.areaOpacity} />
              <path d={path} fill="none" stroke={seriesColor(0)} strokeWidth={MARK.lineWidth} strokeLinejoin="round" strokeLinecap="round" />
              <circle cx={x(n - 1)} cy={y(last)} r={MARK.dotRadius + MARK.ring} fill={SURFACE} />
              <circle cx={x(n - 1)} cy={y(last)} r={MARK.dotRadius} fill={seriesColor(0)} />
            </svg>
          </div>
        );
      })}
    </div>
  );
}
