/**
 * The card set — `BACKOFFICE_DESIGN.md` § 4.12.
 *
 * `SurfaceCard` is the engine: it owns the ground, the border, the hover and the
 * focus ring, and `groundText()` hands out the foregrounds that belong to each
 * ground. **Build a new card on it rather than beside it** — three of the five
 * hand-rolled card surfaces this replaces had independently drifted onto a border
 * colour that is invisible on the chrome, which is what happens when there is no
 * single definition to fix.
 */
export { default as SurfaceCard, groundText } from "./SurfaceCard";
export type { CardGround, MetricGround, SurfaceCardProps } from "./SurfaceCard";

export { default as MetricCard } from "./MetricCard";
export type { MetricCardProps } from "./MetricCard";

export { default as ActionCard } from "./ActionCard";
export type { ActionCardProps } from "./ActionCard";

export { default as EntityCard } from "./EntityCard";
export type { EntityCardProps } from "./EntityCard";

export { default as FeatureSlab } from "./FeatureSlab";
export type { FeatureSlabProps } from "./FeatureSlab";
