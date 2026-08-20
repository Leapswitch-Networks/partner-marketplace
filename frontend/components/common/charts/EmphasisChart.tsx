"use client";

import { GRID, MARK, MUTED, SURFACE, compact, seriesColor } from "./tokens";

/**
 * One series is the point; the rest are context.
 *
 * The most underused form there is, and usually the honest answer to "make this
 * chart clearer". Eight categorical hues when the story is a single series is the
 * commonest way a chart misses its own point — every line shouts, so none of them
 * says anything.
 *
 * Here exactly one line wears a colour and every other line wears the de-emphasis
 * grey. The emphasised line is drawn **last** so it sits above the others, gets the
 * endpoint dot, and is the only one labelled.
 *
 * There is no legend, on purpose: the emphasised series is named in the title or by
 * its own end label, and a legend listing seven grey lines would be noise.
 */
export default function EmphasisChart({
  series,
  labels,
  emphasis,
  height = 200,
  valueFormat = compact,
}: {
  series: { label: string; values: number[] }[];
  labels: string[];
  /** Index of the series that carries the story. */
  emphasis: number;
  height?: number;
  valueFormat?: (n: number) => string;
}) {
  const all = series.flatMap((s) => s.values);
  if (!all.length || labels.length < 2) return null;

  const W = 600;
  const padL = 40;
  const padR = 74;
  const padT = 12;
  const padB = 22;
  const H = height;
  const max = Math.max(...all);
  const min = Math.min(...all, 0);
  const span = max - min || 1;
  const n = labels.length;

  const x = (i: number) => padL + (i / (n - 1)) * (W - padL - padR);
  const y = (v: number) => H - padB - ((v - min) / span) * (H - padT - padB);
  const path = (vals: number[]) =>
    vals.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(" ");

  const lead = series[emphasis];
  const rest = series.filter((_, i) => i !== emphasis);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" role="img" aria-label={`${lead?.label ?? ""} against ${rest.length} other series`}>
      {[min, max].map((t) => (
        <g key={t}>
          <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
          <text x={padL - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" className="fill-ink-label text-[10px] tabular-nums dark:fill-night-muted">
            {valueFormat(Math.round(t))}
          </text>
        </g>
      ))}
      {[0, n - 1].map((i) => (
        <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : "middle"} className="fill-ink-label text-[10px] dark:fill-night-muted">
          {labels[i]}
        </text>
      ))}

      {/* Context first, so the emphasised line lands on top of it. */}
      {rest.map((s) => (
        <path key={s.label} d={path(s.values)} fill="none" stroke={MUTED} strokeWidth={MARK.lineWidth} strokeLinejoin="round" strokeLinecap="round" />
      ))}

      {lead && (
        <g>
          <path d={path(lead.values)} fill="none" stroke={seriesColor(0)} strokeWidth={MARK.lineWidth} strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={x(n - 1)} cy={y(lead.values[n - 1])} r={MARK.dotRadius + MARK.ring} fill={SURFACE} />
          <circle cx={x(n - 1)} cy={y(lead.values[n - 1])} r={MARK.dotRadius} fill={seriesColor(0)} />
          {/* The only direct label on the chart. Text on an ink token — the dot
              beside it carries the identity, never the text colour. */}
          <text x={x(n - 1) + 10} y={y(lead.values[n - 1])} dominantBaseline="middle" className="fill-ink text-[10px] font-semibold dark:fill-white">
            {lead.label}
          </text>
        </g>
      )}
    </svg>
  );
}
