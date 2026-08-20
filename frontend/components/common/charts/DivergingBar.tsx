"use client";

import { GRID, MARK, compact, divergingStep, DIVERGING } from "./tokens";

/**
 * Distance from a baseline — over and under target, on one axis.
 *
 * The form for polarity: bars grow left and right from a **centre line**, so the
 * sign is carried by direction as well as by hue. Colour is diverging — teal one
 * way, amber the other, a neutral grey at zero — and never a status red/green,
 * because "under target" is a position, not a failure.
 *
 * Zero-length bars still get their label and a mark at the centre, so a row never
 * silently disappears.
 */
export default function DivergingBar({
  data,
  height,
  valueFormat = compact,
  positiveLabel = "over",
  negativeLabel = "under",
}: {
  data: { label: string; value: number }[];
  height?: number;
  valueFormat?: (n: number) => string;
  positiveLabel?: string;
  negativeLabel?: string;
}) {
  if (!data.length) return null;

  const W = 600;
  const rowH = 30;
  const labelW = 140;
  const valueW = 56;
  const H = height ?? data.length * rowH + 22;
  const maxAbs = Math.max(...data.map((d) => Math.abs(d.value)), 1);
  const plotW = W - labelW - valueW;
  const mid = labelW + plotW / 2;
  const barH = Math.min(MARK.barMax, rowH - 12);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" role="img" aria-label="Distance from target by item">
      {/* The centre line is the baseline and is the most important rule here, so it
          is the one that stays visible. */}
      <line x1={mid} x2={mid} y1={4} y2={data.length * rowH + 4} stroke={GRID} strokeWidth={1} />
      <text x={mid} y={H - 4} textAnchor="middle" className="fill-ink-label text-[9px] uppercase tracking-wider dark:fill-night-muted">
        target
      </text>
      <text x={mid - plotW / 2} y={H - 4} className="fill-ink-label text-[9px] dark:fill-night-muted">
        ← {negativeLabel}
      </text>
      <text x={mid + plotW / 2} y={H - 4} textAnchor="end" className="fill-ink-label text-[9px] dark:fill-night-muted">
        {positiveLabel} →
      </text>

      {data.map((d, i) => {
        const w = (Math.abs(d.value) / maxAbs) * (plotW / 2);
        const yTop = i * rowH + (rowH - barH) / 2 + 4;
        const pos = d.value > 0;
        const colour = divergingStep(d.value, maxAbs);
        const r = Math.min(MARK.barRadius, Math.max(0, w));
        const x0 = pos ? mid : mid - w;

        return (
          <g key={d.label}>
            <text x={labelW - 10} y={yTop + barH / 2} textAnchor="end" dominantBaseline="middle" className="fill-ink text-[11px] dark:fill-white">
              {d.label.length > 20 ? `${d.label.slice(0, 19)}…` : d.label}
            </text>

            {w <= 0.5 ? (
              /* A row at target still shows a mark, in the neutral midpoint, so it
                 reads as "on target" rather than as missing data. */
              <rect x={mid - 1} y={yTop} width={2} height={barH} fill={DIVERGING.mid} />
            ) : (
              <path
                d={
                  pos
                    ? `M${x0},${yTop} h${w - r} a${r},${r} 0 0 1 ${r},${r} v${barH - r * 2} a${r},${r} 0 0 1 ${-r},${r} h${-(w - r)} Z`
                    : `M${mid},${yTop} h${-(w - r)} a${r},${r} 0 0 0 ${-r},${r} v${barH - r * 2} a${r},${r} 0 0 0 ${r},${r} h${w - r} Z`
                }
                fill={colour}
              />
            )}

            <text
              x={pos ? mid + w + 8 : mid - w - 8}
              y={yTop + barH / 2}
              textAnchor={pos ? "start" : "end"}
              dominantBaseline="middle"
              className="fill-ink text-[11px] font-semibold tabular-nums dark:fill-white"
            >
              {d.value > 0 ? `+${valueFormat(d.value)}` : valueFormat(d.value)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
