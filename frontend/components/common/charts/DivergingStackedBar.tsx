"use client";

import { DIVERGING, MARK, SURFACE } from "./tokens";

/**
 * An ordered opinion scale — agree ↔ disagree, satisfied ↔ not — centred on neutral.
 *
 * The form for a Likert or sentiment share. A plain stacked bar would put "strongly
 * disagree" at one end and force the reader to add segments to answer "is this good
 * or bad"; centring on the neutral band means **the direction the bar leans is the
 * answer**, readable in one glance across a whole list of rows.
 *
 * Colour is diverging: cool for one polarity, warm for the other, and the neutral
 * band in the grey midpoint so it reads as "no opinion" rather than as a third
 * position. Depth within each arm carries intensity, so "strongly" is darker than
 * "somewhat" without needing a fourth and fifth hue.
 *
 * The 2px separators are the surface showing through, one consistent width, never a
 * stroke.
 */
export interface DivergingRow {
  label: string;
  /** Most-negative first. Rendered leftward from the centre, intensity outward. */
  negative: number[];
  neutral: number;
  /** Most-positive last. Rendered rightward. */
  positive: number[];
}

export default function DivergingStackedBar({
  rows,
  legend,
}: {
  rows: DivergingRow[];
  /** Labels, negative-most first through positive-most last. */
  legend?: string[];
}) {
  if (!rows.length) return null;

  // One scale across every row, so rows are comparable. Half-widths, because the
  // centre is the neutral band's midpoint.
  const worst = Math.max(
    ...rows.map((r) => Math.max(
      r.negative.reduce((a, b) => a + b, 0) + r.neutral / 2,
      r.positive.reduce((a, b) => a + b, 0) + r.neutral / 2
    )),
    1
  );

  const coolSteps = [...DIVERGING.cool].reverse(); // darkest at the outer edge
  const warmSteps = DIVERGING.warm;

  return (
    <div>
      <div className="space-y-2.5">
        {rows.map((r) => {
          const negTotal = r.negative.reduce((a, b) => a + b, 0);
          const half = r.neutral / 2;
          // Left offset in percent, so the neutral band always straddles 50%.
          const leftPad = 50 - ((negTotal + half) / worst) * 50;

          return (
            <div key={r.label} className="min-w-0">
              <div className="flex items-baseline justify-between gap-3">
                <p className="truncate text-[11px] font-semibold text-ink dark:text-white">{r.label}</p>
                <p className="shrink-0 text-[11px] tabular-nums text-ink-label dark:text-night-muted">
                  {Math.round((r.positive.reduce((a, b) => a + b, 0) /
                    (negTotal + r.neutral + r.positive.reduce((a, b) => a + b, 0) || 1)) * 100)}
                  % positive
                </p>
              </div>
              <div className="relative mt-1 h-3.5 w-full" role="img" aria-label={r.label}>
                <div
                  className="absolute inset-y-0 flex"
                  style={{ left: `${leftPad}%`, gap: MARK.gap, backgroundColor: SURFACE }}
                >
                  {r.negative.map((v, i) =>
                    v > 0 ? (
                      <span
                        key={`n${i}`}
                        style={{ width: `${(v / worst) * 50}%`, backgroundColor: coolSteps[i % coolSteps.length] }}
                      />
                    ) : null
                  )}
                  {r.neutral > 0 && (
                    <span style={{ width: `${(r.neutral / worst) * 50}%`, backgroundColor: DIVERGING.mid }} />
                  )}
                  {r.positive.map((v, i) =>
                    v > 0 ? (
                      <span
                        key={`p${i}`}
                        style={{ width: `${(v / worst) * 50}%`, backgroundColor: warmSteps[i % warmSteps.length] }}
                      />
                    ) : null
                  )}
                </div>
                {/* The centre rule is the whole point of the form, so it stays
                    visible above the bars. */}
                <span aria-hidden="true" className="absolute inset-y-[-3px] left-1/2 w-[1px] bg-ink/30 dark:bg-white/30" />
              </div>
            </div>
          );
        })}
      </div>

      {legend && (
        <ul className="mt-3.5 flex flex-wrap items-center gap-x-3.5 gap-y-1.5">
          {legend.map((l, i) => {
            const negCount = rows[0].negative.length;
            const colour =
              i < negCount
                ? coolSteps[i % coolSteps.length]
                : i === negCount
                  ? DIVERGING.mid
                  : warmSteps[(i - negCount - 1) % warmSteps.length];
            return (
              <li key={l} className="flex items-center gap-1.5 text-[10px] text-ink-label dark:text-night-muted">
                <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: colour }} />
                {l}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
