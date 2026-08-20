import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";
import SurfaceCard, { groundText, type CardGround } from "./SurfaceCard";

/**
 * A person, a partner, an integration — something with a name, an identity mark
 * and a couple of facts.
 *
 * The shape is the public surface's `PartnerCard` reduced to back-office density:
 * mark and name at the top, facts on the floor, status top-right. What ports is the
 * **composition**; what does not is the geometry — `PartnerCard` is
 * `rounded-[2rem] p-7` with a 4px border, and § 5 keeps cards here squared, 1px and
 * compact. A marketing card is one of six on a page; this is one of thirty in a
 * grid.
 *
 * ## `meta` sits on the floor
 *
 * `mt-auto` — grid children stretch to the tallest card, and without it the facts
 * of a card with a one-line name float against the top of a box sized by its
 * neighbour's two-line one. On the floor, a row of cards has its facts on a single
 * line. (`StatTiles` deliberately gave this up when its figure moved beside its
 * label; here the facts are still genuinely the bottom of the card.)
 */
export interface EntityCardProps {
  /** The identity mark — an `Avatar`, a logo, or an initials disc. */
  leading?: ReactNode;
  title: string;
  subtitle?: string;
  /** Short label/value facts, rendered on the card's floor. Keep it to three. */
  meta?: Array<{ label: string; value: ReactNode }>;
  /** A `Badge`, or any status mark. Sits top-right. */
  status?: ReactNode;
  href?: string;
  ground?: CardGround;
  className?: string;
}

export default function EntityCard({
  leading,
  title,
  subtitle,
  meta,
  status,
  href,
  ground = "paper",
  className,
}: EntityCardProps) {
  const t = groundText(ground);

  return (
    <SurfaceCard ground={ground} padding="md" href={href} className={className}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          {leading && <span className="shrink-0">{leading}</span>}
          <div className="min-w-0">
            <p className={cn("truncate text-sm font-semibold leading-snug", t.body)}>{title}</p>
            {subtitle && <p className={cn("mt-0.5 truncate text-xs", t.muted)}>{subtitle}</p>}
          </div>
        </div>
        {status && <span className="shrink-0">{status}</span>}
      </div>

      {meta && meta.length > 0 && (
        <dl className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-4">
          {meta.map((row) => (
            <div key={row.label} className="min-w-0">
              {/* The label is the quiet half and the value the loud one — the
                  opposite of a table, where the column heading already said it. */}
              <dt className={cn("text-[10px] font-medium uppercase tracking-wide", t.muted)}>
                {row.label}
              </dt>
              <dd className={cn("truncate text-xs font-semibold", t.body)}>{row.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </SurfaceCard>
  );
}
