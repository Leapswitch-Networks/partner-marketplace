/**
 * The chart set — `BACKOFFICE_DESIGN.md` § 4.13.
 *
 * Zero dependencies: every mark is inline SVG. A charting library would have cost
 * more than the whole route's JavaScript budget (`FRONTEND_PLAN.md` § 11 caps
 * first-load at 150 kB), and none of these forms need one.
 *
 * **The palette in `tokens.ts` was produced by a validator, not chosen.** Before
 * changing a colour, re-run it — for light *and* dark. Before building a scatter,
 * bubble or map, re-run it with `--pairs all`: those forms compare every pair, not
 * just neighbours, and cap at fewer series than these do.
 */
export { default as ChartFrame } from "./ChartFrame";
export type { Series } from "./ChartFrame";

export { default as TrendChart } from "./TrendChart";
export type { TrendSeries } from "./TrendChart";

export { default as BarChart } from "./BarChart";
export { default as StackedBar } from "./StackedBar";
export { default as Sparkline } from "./Sparkline";
export { default as Meter } from "./Meter";

export { default as GroupedBar } from "./GroupedBar";
export { default as DivergingBar } from "./DivergingBar";
export { default as Heatmap } from "./Heatmap";
export { default as EmphasisChart } from "./EmphasisChart";
export { default as Dumbbell } from "./Dumbbell";
export { default as SmallMultiples } from "./SmallMultiples";
export { default as HeroFigure } from "./HeroFigure";
export { default as BulletChart } from "./BulletChart";
export { default as DivergingStackedBar } from "./DivergingStackedBar";
export type { DivergingRow } from "./DivergingStackedBar";
export { default as FunnelChart } from "./FunnelChart";
export { default as DataBarTable } from "./DataBarTable";
export { default as ScaleLegend } from "./ScaleLegend";
export { ChartEmpty, ChartSkeleton } from "./ChartStates";

export {
  CATEGORICAL,
  SEQUENTIAL,
  DIVERGING,
  MUTED,
  STATUS,
  MARK,
  SURFACE,
  GRID,
  seriesColor,
  sequentialStep,
  divergingStep,
  compact,
} from "./tokens";
