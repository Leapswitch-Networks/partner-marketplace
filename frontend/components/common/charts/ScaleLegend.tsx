import { SEQUENTIAL, DIVERGING, compact } from "./tokens";

/**
 * The key for a value scale — required, not optional.
 *
 * A sequential or diverging encoding is unreadable without one: the reader can see
 * that one cell is darker than another but has no way to turn that into a number.
 * Categorical charts get a legend of swatches; value scales get this.
 *
 * **`Heatmap` shipped without one, which was a gap** — the per-cell hover text
 * carried the numbers, but hover is not available to a keyboard, a screen reader, a
 * touch device or a printout.
 */
export default function ScaleLegend({
  min,
  max,
  kind = "sequential",
  label,
  valueFormat = compact,
}: {
  min: number;
  max: number;
  kind?: "sequential" | "diverging";
  label?: string;
  valueFormat?: (n: number) => string;
}) {
  const steps =
    kind === "diverging"
      ? [...[...DIVERGING.cool].reverse(), DIVERGING.mid, ...DIVERGING.warm]
      : SEQUENTIAL;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {label && (
        <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-label dark:text-night-muted">
          {label}
        </span>
      )}
      <span className="text-[10px] tabular-nums text-ink-label dark:text-night-muted">
        {kind === "diverging" ? `−${valueFormat(Math.abs(min))}` : valueFormat(min)}
      </span>
      {/* Discrete blocks, not a smooth gradient: the encoding is stepped, so a
          continuous bar would imply a precision the cells do not have. */}
      <span className="flex overflow-hidden rounded-[2px]" aria-hidden="true">
        {steps.map((c, i) => (
          <span key={i} className="h-2.5 w-5" style={{ backgroundColor: c }} />
        ))}
      </span>
      <span className="text-[10px] tabular-nums text-ink-label dark:text-night-muted">
        {valueFormat(max)}
      </span>
    </div>
  );
}
