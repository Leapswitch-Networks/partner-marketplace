"use client";

import type { ReactNode } from "react";
import Skeleton from "@/components/common/Skeleton";
import { cn } from "@/lib/utils/cn";

/**
 * The KPI row that sits above an index table.
 *
 * **One component, because there were three.** Until 2026-08-17 every module that
 * wanted headline counts drew its own: `ApiDocsModule` and `WorkerJobsModule` each
 * inlined a `Card`/`CardContent` per tile (the same twenty lines, copied), and
 * `InvitationsModule` had a private `StatCard` of a different size and shape
 * crammed into the filter row. Three visual languages for one idea, and a fix to
 * any of them reached none of the others.
 *
 * **Not `Card`.** The two modules that reached for `Card` were misusing it: `Card`
 * is the *viewport-locked index surface* — `flex min-h-0 flex-1 flex-col
 * overflow-hidden`, whose class combinations exist so a table can scroll inside
 * it. None of that means anything for a tile, and `flex-1` on a grid child is a
 * contradiction waiting to be read as intentional. A tile is its own thing.
 *
 * ## The tile is an INK SLAB — changed 2026-08-20
 *
 * At the owner's request, this row now wears the public surface's "black card,
 * light text" treatment (`SectionSlab ground="ink"`, `BACKOFFICE_DESIGN.md` § 2.4).
 * It is the one component in the back office where that slab genuinely fits: a KPI
 * row is a small number of large figures, which is exactly what the reference uses
 * an ink slab for.
 *
 * **Light and dark are asymmetric, and that is deliberate.** Measured:
 *
 * | tile fill | vs chrome | vs white card | vs `night-card` |
 * |---|---|---|---|
 * | `bg-ink` `#242934` | **13.58:1** | **14.57:1** | **1.23:1** ❌ |
 *
 * So ink is superb on both light surfaces and **invisible on the dark card** —
 * which is the original four-surfaces warning this docstring used to carry, and it
 * still holds. Dark mode therefore keeps the faint lift (`bg-white/[0.03]`): the
 * ink slab reads as striking *because* it contrasts with a light ground, and on an
 * already-dark page the equivalent gesture is to lift, not to darken.
 *
 * **Both modes are a dark ground, so both take § 2.2's dark-ground row** — amber
 * emphasis, light body text, translucent-light hairlines. That is why the figure is
 * `text-accent` in light mode too: on the public surface the display numeral on an
 * ink slab is amber (`StepList` when `dark`, and the home page's step list), and
 * amber on ink measures 7.64:1.
 *
 * ⚠️ This does **not** contradict the `tone` rule below. That rule forbids putting
 * a *semantic status* colour on the figure, because a semantic fill is designed to
 * sit behind white text. The figure's amber is a uniform display treatment — every
 * tile gets it, so it carries no status at all.
 */

export type StatTone = "neutral" | "brand" | "success" | "warning" | "danger";

export interface StatTile {
  /** Sentence case, no trailing colon. Names the number — "Permission-gated". */
  label: string;
  /**
   * The number, or a short string where the answer is not a count (a timestamp,
   * an em-dash for "none"). Numbers are compacted past five figures; see
   * `formatStatValue`.
   */
  value: ReactNode;
  /** One clause of context under the label. Optional, and genuinely optional. */
  hint?: ReactNode;
  /**
   * Status colour. It rides on a **dot beside the label, never on the figure**.
   *
   * Measured on 2026-08-12 for the invitation tiles this replaces: colouring the
   * number itself put `tone-success` at 1.84:1 on the dark surface and
   * `tone-warning` at 1.47:1 on the light one — the count was the least readable
   * thing on a tile whose whole job is to show a count. A semantic fill is
   * designed to sit *behind* white text in a badge, not to be text on a wash.
   *
   * The colour is never the only signal either: the label names the state
   * ("Unhealthy", "Expired"), so a dot that nobody can distinguish still leaves a
   * tile that reads correctly.
   */
  tone?: StatTone;
  /**
   * Render the value at body size instead of display size. For values that are
   * text rather than a figure — "12 Aug 2026, 3:08 pm" at `text-2xl` sets the
   * tile's width for the whole row and still wraps.
   */
  textual?: boolean;
}

/**
 * Tone → dot fill. `neutral` renders no dot at all rather than a grey one.
 *
 * **Every value is the DARK-GROUND variant**, because the tile is a dark ground in
 * both modes now. Measured on the ink tile / on `night-card`:
 *
 * | tone | was | on ink | on night.card |
 * |---|---|---|---|
 * | brand | `bg-brand` (pine) | 1.53:1 ❌ | — |
 * | success | `bg-tone-success` | 1.15:1 ❌ | **1.41:1 ❌** |
 * | warning | `bg-tone-warning` | 8.58:1 ✅ | 10.52:1 ✅ |
 * | danger | `bg-tone-danger` | 2.90:1 ❌ | 3.56:1 |
 *
 * 🐛 **The `success` row was already broken in dark mode before this change** —
 * 1.41:1 on `night-card`, i.e. invisible, on every screen with a success tile.
 * `tone-success` is the brand darkened 27% by the owner's 2026-08-13 decision, so
 * `brand-on-dark` is its correct counterpart and fixes both grounds at once. It
 * does make `brand` and `success` the same colour on a dark ground — they are
 * already near-identical on a light one for the same reason.
 *
 * Only `warning` survived unchanged.
 */
const DOT: Record<Exclude<StatTone, "neutral">, string> = {
  brand: "bg-brand-on-dark",
  success: "bg-brand-on-dark",
  warning: "bg-tone-warning",
  danger: "bg-[rgb(var(--tone-danger-on-dark))]",
};

/**
 * Column count at `lg`. Below that the row is fixed at 2-up then 3-up, which are
 * the counts that keep a label on one line at 360px and 768px respectively.
 *
 * Explicit strings, not a template — Tailwind scans source text, so
 * `lg:grid-cols-${n}` compiles to nothing.
 */
const LG_COLUMNS: Record<number, string> = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
  6: "lg:grid-cols-6",
};

/**
 * Compact past five figures: `1284` stays, `12852` becomes `12.9K`.
 *
 * **Proportional figures, not `tabular-nums`** — deliberate, and the opposite of
 * what the table columns do. Tabular gives every digit the width of a `0`, which
 * is right when numbers stack vertically and must align, and wrong at display
 * size where it leaves `121` visibly gappy. Columns align; a headline does not.
 */
export function formatStatValue(value: ReactNode): ReactNode {
  if (typeof value !== "number" || !Number.isFinite(value)) return value;
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (abs >= 10_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return value.toLocaleString();
}

function Tile({ label, value, hint, tone = "neutral", textual }: StatTile) {
  return (
    /*
      ## Layout: label and hint LEFT, figure RIGHT — changed 2026-08-20

      The figure used to sit stacked above the label. It now shares a row with it,
      at the owner's request, which retired two mechanisms whose reasoning is worth
      keeping here because both were load-bearing before:

      * **The figure's fixed 30px bottom-aligned box is gone.** It existed so a
        `textual` tile's short line did not leave its label riding ~16px higher
        than the numeric tiles beside it. With the figure beside the label rather
        than above it, `items-baseline` does that job directly and for both kinds
        at once.
      * **The hint's `mt-auto` is gone.** It pushed the hint to the tile's floor so
        a row of tiles had its hints on one line. The hint now sits directly under
        the label — which is the point of the change — and hints still align across
        the row, because every label is a single truncated line, so every hint
        starts at the same offset.

      `min-h-[62px]` and the skeleton's `h-[62px]` are deliberately the same
      number. That is what stops the row changing height when the data lands and
      shoving the table down, and it is more robust than the previous pair of
      independently-chosen heights. **Change one and you must change the other.**
    */
    <div className="flex h-full min-h-[62px] flex-col justify-center rounded-none border border-white/10 bg-ink px-3 py-2.5 transition-colors hover:border-white/25 dark:border-night-border dark:bg-white/[0.03] dark:hover:border-brand/40">
      {/*
        `items-baseline`, not `items-start`: it aligns the figure's baseline with
        the label's, so the two read as one row even though one is `text-2xl` and
        the other `text-xs`. A flex item that is itself a block aligns on its
        FIRST line box, which is the label — so the hint hanging below does not
        move the figure, and every figure in the row lands on the same line
        whether its neighbour's hint wrapped or not.
      */}
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-medium text-white dark:text-gray-200">
            {tone !== "neutral" && (
              <span
                aria-hidden="true"
                className={cn("inline-block h-1.5 w-1.5 shrink-0 rounded-full", DOT[tone])}
              />
            )}
            {/* Tiles go 2-up under 640px — truncate so a narrow tile shrinks its
                label rather than overflowing the row. */}
            <span className="truncate">{label}</span>
          </p>

          {/* `ink-label` was right on a tinted fill and is unreadable on ink. The
              reference's muted-on-dark is its cream at 70%; white/70 over ink is
              the same idea and measures 7.82:1. */}
          {hint && (
            <p className="mt-0.5 text-[11px] leading-snug text-white/70 dark:text-night-muted">
              {hint}
            </p>
          )}
        </div>

        <p
          className={cn(
            // Amber on a dark ground — 7.64:1 on ink, 9.37:1 on night.card. This
            // is the reference's own treatment for a display figure on an ink
            // slab. NEVER reuse `text-accent` on a light ground: 1.91:1.
            //
            // `shrink-0` + `whitespace-nowrap`: the figure is the one thing on the
            // tile that must never wrap or be clipped. The label truncates
            // instead — `formatStatValue` already caps the figure's width by
            // compacting past five digits.
            "shrink-0 whitespace-nowrap font-semibold leading-none text-accent",
            textual ? "text-xs" : "text-2xl"
          )}
        >
          {textual ? value : formatStatValue(value)}
        </p>
      </div>
    </div>
  );
}

export default function StatTiles({
  items,
  loading = false,
  className = "",
}: {
  items: StatTile[];
  /**
   * Renders the same number of tile-shaped skeletons. Worth passing: these sit
   * directly above a table that is itself loading, and a row that pops into
   * existence shoves the table down after the eye has already landed on it.
   */
  loading?: boolean;
  className?: string;
}) {
  if (!loading && items.length === 0) return null;

  const columns = LG_COLUMNS[Math.min(items.length, 6)] ?? "lg:grid-cols-5";

  return (
    <div className={cn("grid grid-cols-2 gap-2 sm:grid-cols-3", columns, className)}>
      {loading
        ? // `h-[62px]` mirrors `Tile`'s `min-h-[62px]` exactly — see the note there.
          items.map((item, i) => <Skeleton key={item.label || i} className="h-[62px] rounded-none" />)
        : items.map((item) => <Tile key={item.label} {...item} />)}
    </div>
  );
}
