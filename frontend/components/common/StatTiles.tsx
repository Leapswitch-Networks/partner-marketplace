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
 * **The surface reads on all four backgrounds.** These tiles render both on the
 * page body (`ApiDocs`, `WorkerJobs`) and inside the index `Card` (`Invitations`),
 * in light and dark — four surfaces, and `night-card` tiles on a `night-card` card
 * would be invisible. So the fill is a faint tint rather than a named surface, and
 * the border does the separating.
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

/** Tone → dot fill. `neutral` renders no dot at all rather than a grey one. */
const DOT: Record<Exclude<StatTone, "neutral">, string> = {
  brand: "bg-brand dark:bg-brand-on-dark",
  success: "bg-tone-success",
  warning: "bg-tone-warning",
  danger: "bg-tone-danger",
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
      `h-full` + `flex-col`: grid children stretch to the tallest tile, and without
      this the content of a short tile floats against the top of a box sized by its
      neighbour's two-line hint. The hint takes `mt-auto` for the same reason — it
      sits on the floor, so a row of tiles has its hints on one line.
    */
    <div className="flex h-full flex-col rounded-none border border-brand/20 bg-surface-tile/60 px-3 py-2.5 transition-colors hover:border-brand/40 dark:border-night-border dark:bg-white/[0.03] dark:hover:border-brand/40">
      {/*
        The value sits in a fixed 30px box, bottom-aligned — 30px being what
        `text-2xl`/`leading-tight` occupies. Without it a `textual` tile's short
        line leaves its label riding ~16px higher than the numeric tiles beside
        it, and a row of labels that nearly lines up looks like a bug rather than
        a variant. Bottom-aligned rather than centred so both kinds share a
        baseline, which is the edge the eye actually tracks.
      */}
      <div className="flex min-h-[30px] items-end">
        <p
          className={cn(
            "font-semibold leading-tight text-ink dark:text-white",
            textual ? "text-xs" : "text-2xl"
          )}
        >
          {textual ? value : formatStatValue(value)}
        </p>
      </div>

      <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-ink dark:text-gray-200">
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

      {hint && (
        <p className="mt-auto pt-1 text-[11px] leading-snug text-ink-label dark:text-night-muted">
          {hint}
        </p>
      )}
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
        ? items.map((item, i) => <Skeleton key={item.label || i} className="h-[86px] rounded-none" />)
        : items.map((item) => <Tile key={item.label} {...item} />)}
    </div>
  );
}
