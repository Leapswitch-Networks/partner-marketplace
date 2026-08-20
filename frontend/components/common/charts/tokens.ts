/**
 * Chart tokens — the validated palette, in TypeScript.
 *
 * The values live in `globals.css` so light/dark switching is free; this file is
 * the typed accessor plus the rules that cannot be expressed in CSS.
 *
 * **None of these colours were chosen.** They came out of the palette validator:
 * lightness band, chroma floor, adjacent CVD separation under protanopia and
 * deuteranopia, a normal-vision floor, and contrast against the surface — run for
 * light (white card) and again for dark (`night.card`). Worst adjacent pair 13.3
 * against a target of 8; normal-vision floor 19.4 against a gate of 15.
 */

/** Fixed order. Assigned in sequence, **never cycled**. */
export const CATEGORICAL = [
  "rgb(var(--chart-1))",
  "rgb(var(--chart-2))",
  "rgb(var(--chart-3))",
  "rgb(var(--chart-4))",
  "rgb(var(--chart-5))",
] as const;

/** One hue, light → dark. For magnitude, not identity. */
export const SEQUENTIAL = [
  "rgb(var(--chart-seq-1))",
  "rgb(var(--chart-seq-2))",
  "rgb(var(--chart-seq-3))",
  "rgb(var(--chart-seq-4))",
] as const;

/**
 * Diverging — polarity. Two hues that read **opposite** plus a neutral midpoint.
 *
 * `cool` is one side of the baseline, `warm` the other, `mid` is zero. Both arms
 * validated as ordinal ramps; the poles validated against each other. 🔴 Never put
 * a hue at `mid`, and never use two cool hues as the poles — the reader has to see
 * opposition, not merely difference.
 */
export const DIVERGING = {
  cool: [
    "rgb(var(--chart-div-cool-1))",
    "rgb(var(--chart-div-cool-2))",
    "rgb(var(--chart-div-cool-3))",
    "rgb(var(--chart-div-cool-4))",
  ],
  mid: "rgb(var(--chart-div-mid))",
  warm: [
    "rgb(var(--chart-div-warm-1))",
    "rgb(var(--chart-div-warm-2))",
    "rgb(var(--chart-div-warm-3))",
    "rgb(var(--chart-div-warm-4))",
  ],
} as const;

/**
 * The de-emphasis colour for the **emphasis** form — one series in its hue, every
 * other series in this. The skill calls emphasis the most underused form, and it is
 * usually the honest answer to "make this chart clearer": eight categorical hues
 * when the story is one series is the commonest way a chart misses its point.
 */
export const MUTED = "rgb(var(--chart-muted))";

export const SURFACE = "rgb(var(--chart-surface))";
export const GRID = "rgb(var(--chart-grid))";

/**
 * Status is a **reserved** scale with fixed meaning, deliberately outside the
 * categorical slots so a status colour can never read as "series 4".
 *
 * 🔴 Always ship these with an icon **and** a label. `warning` sits below 3:1 on a
 * light surface by design — the pairing is the mitigation, not an oversight.
 *
 * The collision rule: a series that *means* good/bad (error rate, pass/fail) wears
 * status; a series that is merely the fourth thing wears categorical. Never both in
 * one chart.
 */
export const STATUS = {
  good: "rgb(var(--tone-success))",
  goodOnDark: "rgb(var(--brand-on-dark))",
  warning: "#e2c636",
  critical: "rgb(var(--tone-danger))",
  criticalOnDark: "rgb(var(--tone-danger-on-dark))",
} as const;

/**
 * The colour for series `i`.
 *
 * Throws past the last slot rather than wrapping. Cycling is the single most
 * common way a categorical palette silently breaks: two series get the same hue and
 * the chart still renders, so nobody notices. **A 6th series is not a colour
 * problem** — fold the tail into "Other", facet into small multiples, or use a
 * different form.
 */
export function seriesColor(i: number): string {
  if (i < 0 || i >= CATEGORICAL.length) {
    throw new Error(
      `chart: no slot ${i}. The palette has ${CATEGORICAL.length} and is never cycled — ` +
        `fold the tail into "Other", facet into small multiples, or change the form.`
    );
  }
  return CATEGORICAL[i];
}

/** A diverging step: sign picks the arm, magnitude picks the depth. */
export function divergingStep(value: number, maxAbs: number): string {
  if (value === 0 || maxAbs <= 0) return DIVERGING.mid;
  const arm = value > 0 ? DIVERGING.warm : DIVERGING.cool;
  const t = Math.min(1, Math.abs(value) / maxAbs);
  return arm[Math.min(arm.length - 1, Math.floor(t * arm.length))];
}

/** A step of the sequential ramp for `value` within `[min, max]`. */
export function sequentialStep(value: number, min: number, max: number): string {
  if (max <= min) return SEQUENTIAL[SEQUENTIAL.length - 1];
  const t = Math.min(1, Math.max(0, (value - min) / (max - min)));
  return SEQUENTIAL[Math.min(SEQUENTIAL.length - 1, Math.floor(t * SEQUENTIAL.length))];
}

/** Mark specs, fixed across every chart in this set. */
export const MARK = {
  /** Lines are 2px, round join and cap. */
  lineWidth: 2,
  /** Dots are >= 8px across, so r >= 4. */
  dotRadius: 4,
  /** Every dot carries a 2px ring in the surface colour — part of its hit target. */
  ring: 2,
  /** The gap that separates touching marks. Surface-coloured, never a stroke. */
  gap: 2,
  /** Bars are capped, never filling their band — the leftover is air. */
  barMax: 24,
  /** Rounded at the data end, square at the baseline. */
  barRadius: 4,
  /** Area fills are a wash at ~10%, never a saturated block. */
  areaOpacity: 0.1,
} as const;

/** Compact a number the way the stat tiles do, so a chart axis and a tile agree. */
export function compact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (abs >= 10_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return n.toLocaleString();
}
