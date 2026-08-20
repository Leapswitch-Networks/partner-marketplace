import { cn } from "@/lib/utils/cn";
import { SEQUENTIAL, STATUS } from "./tokens";

/**
 * One ratio against a limit — a single bar, a value, and a label.
 *
 * A meter, not a two-slice pie: a proportion is a length, and a length is read far
 * more accurately than an angle.
 *
 * **The track is a lighter step of the same ramp**, not a neutral grey. Same-hue
 * track means the state reads across the whole bar rather than only where the fill
 * ends.
 *
 * `severity` swaps the fill for the reserved status scale, and when it does the
 * label carries the word too — status is never colour alone. `warning` sits below
 * 3:1 on a light surface by design; the visible label is the mitigation.
 */
export default function Meter({
  label,
  value,
  max = 100,
  /** Rendered verbatim to the right. Falls back to `value / max`. */
  display,
  severity,
  className,
}: {
  label: string;
  value: number;
  max?: number;
  display?: string;
  severity?: "good" | "warning" | "critical";
  className?: string;
}) {
  const pct = max <= 0 ? 0 : Math.min(100, Math.max(0, (value / max) * 100));
  const fill = severity ? STATUS[severity] : SEQUENTIAL[SEQUENTIAL.length - 1];
  const track = SEQUENTIAL[0];

  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="truncate text-xs font-semibold text-ink dark:text-white">
          {label}
          {severity && (
            /* The word, beside the colour. A status that is only a hue is not a
               status — it is a decoration that some readers cannot see. */
            <span className="ml-1.5 font-medium text-ink-label dark:text-night-muted">
              · {severity === "good" ? "healthy" : severity}
            </span>
          )}
        </p>
        <p className="shrink-0 text-xs font-semibold tabular-nums text-ink dark:text-white">
          {display ?? `${value.toLocaleString()} / ${max.toLocaleString()}`}
        </p>
      </div>
      <div
        className="mt-1.5 h-1.5 w-full overflow-hidden rounded-[2px]"
        style={{ backgroundColor: track }}
        role="meter"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
      >
        <div className="h-full rounded-[2px]" style={{ width: `${pct}%`, backgroundColor: fill }} />
      </div>
    </div>
  );
}
