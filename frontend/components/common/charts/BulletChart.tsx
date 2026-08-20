"use client";

import { SEQUENTIAL, STATUS, compact } from "./tokens";

/**
 * Actual against a target, in one line.
 *
 * A `Meter` says "62 of 98". A bullet says "62, against a target of 80, in a band
 * that runs to 120" — the extra information is the **target tick**, and it is what
 * turns a progress bar into a judgement.
 *
 * Chosen over a gauge or a speedometer, which say exactly this in five times the
 * space and ask the reader to compare angles.
 *
 * The track is a lighter step of the same ramp — same-hue, so state reads across the
 * whole bar rather than only where the fill stops. `severity` swaps the fill for the
 * reserved status scale and puts the word beside it, because status is never colour
 * alone.
 */
export default function BulletChart({
  label,
  value,
  target,
  max,
  severity,
  valueFormat = compact,
}: {
  label: string;
  value: number;
  target: number;
  /** Defaults to a little past whichever of value/target is larger. */
  max?: number;
  severity?: "good" | "warning" | "critical";
  valueFormat?: (n: number) => string;
}) {
  const ceiling = max ?? Math.ceil(Math.max(value, target) * 1.25);
  const pct = (n: number) => `${Math.min(100, Math.max(0, (n / ceiling) * 100))}%`;
  const fill = severity ? STATUS[severity] : SEQUENTIAL[SEQUENTIAL.length - 1];
  const met = value >= target;

  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <p className="truncate text-xs font-semibold text-ink dark:text-white">{label}</p>
        <p className="shrink-0 text-xs tabular-nums text-ink-label dark:text-night-muted">
          <span className="font-semibold text-ink dark:text-white">{valueFormat(value)}</span>
          {" / "}
          {valueFormat(target)}
          {/* The verdict in words. A tick mark alone leaves the reader doing the
              comparison the chart exists to do for them. */}
          <span className={met ? "ml-1.5 font-semibold text-tone-success dark:text-brand-on-dark" : "ml-1.5 font-semibold text-tone-danger dark:text-[rgb(var(--tone-danger-on-dark))]"}>
            {met ? "met" : "short"}
          </span>
        </p>
      </div>
      <div
        className="relative mt-1.5 h-2.5 w-full overflow-hidden rounded-[2px]"
        style={{ backgroundColor: SEQUENTIAL[0] }}
        role="meter"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={ceiling}
        aria-label={`${label}: ${value} against a target of ${target}`}
      >
        <div className="h-full rounded-[2px]" style={{ width: pct(value), backgroundColor: fill }} />
        {/* The target tick, in ink rather than a hue — it is a reference, not a
            series, and it has to stay visible over both the fill and the track. */}
        <span
          aria-hidden="true"
          className="absolute top-[-2px] h-[14px] w-[2px] bg-ink dark:bg-white"
          style={{ left: pct(target) }}
        />
      </div>
    </div>
  );
}
