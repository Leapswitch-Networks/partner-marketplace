import { MARK, SURFACE, seriesColor } from "./tokens";

/**
 * A twelve-ish point trend, sized to sit inside a stat tile.
 *
 * No axes, no grid, no tooltip — a sparkline's whole job is shape, and the number
 * beside it carries the value. The last point gets a dot with a surface ring so the
 * eye lands on "now"; nothing else is labelled.
 *
 * Deliberately **not** interactive: it is the one form the interaction rules exempt,
 * because there is no scale to read a position against.
 */
export default function Sparkline({
  values,
  width = 96,
  height = 28,
  slot = 0,
  ariaLabel,
}: {
  values: number[];
  width?: number;
  height?: number;
  /** Categorical slot. Defaults to the first. */
  slot?: number;
  /** Say what the trend is, since the shape is not readable by a screen reader. */
  ariaLabel?: string;
}) {
  if (values.length < 2) return null;

  const colour = seriesColor(slot);
  const pad = MARK.dotRadius + MARK.ring;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const x = (i: number) => pad + (i / (values.length - 1)) * (width - pad * 2);
  const y = (v: number) => height - pad - ((v - min) / span) * (height - pad * 2);

  const line = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(" ");
  const lastX = x(values.length - 1);
  const lastY = y(values[values.length - 1]);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role={ariaLabel ? "img" : "presentation"}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      className="overflow-visible"
    >
      {/* The wash is ~10%, never a saturated block — the line is the data. */}
      <path
        d={`${line} L${lastX.toFixed(2)},${height} L${x(0).toFixed(2)},${height} Z`}
        fill={colour}
        opacity={MARK.areaOpacity}
      />
      <path
        d={line}
        fill="none"
        stroke={colour}
        strokeWidth={MARK.lineWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* The ring is painted in the surface colour so the dot stays legible where it
          crosses the line. Not a stroke around the mark — surface, doing the work. */}
      <circle cx={lastX} cy={lastY} r={MARK.dotRadius + MARK.ring} fill={SURFACE} />
      <circle cx={lastX} cy={lastY} r={MARK.dotRadius} fill={colour} />
    </svg>
  );
}
