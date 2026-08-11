import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Viewport-locked card, per LeapDesk's mandatory index-page layout.
 *
 * The class combinations are load-bearing, not cosmetic:
 *   Card         flex min-h-0 flex-1 flex-col overflow-hidden
 *   CardHeader   shrink-0            (never scrolls)
 *   CardContent  flex min-h-0 flex-1 flex-col
 *
 * `min-h-0` is what allows a flex child to shrink below its content height —
 * without it the table cannot scroll internally and the whole page scrolls
 * instead, which is the failure mode this layout exists to prevent.
 *
 * **Viho surface, 2026-08-05.** Squared (`radius 0`), a 1px `surface-border`, and
 * **no shadow or ring** — Viho separates surfaces with borders and background
 * washes rather than elevation. In dark mode the card is `night-card` (#111727)
 * against a `night-body` (#202938) page: the card is *darker* than the page, which
 * is inverted from the usual convention and is deliberate.
 *
 * **Light surface is `surface-wash` (#eaf0ef), not white, since 2026-08-07.** That
 * is the brand teal at 10% over white — the same token the auth page and the
 * branding form already use, so this is the existing green rather than a new one.
 * Only the three admin modules mount this component, so nothing else moved.
 *
 * Popovers that sit *on* the card (`RowActions`, the column menu) stay `bg-white`
 * on purpose: white-on-green is what now reads as raised, and it is the only
 * elevation cue this design allows itself.
 *
 * Padding stays at the existing compact scale rather than Viho's 30px. Viho's
 * airier spacing is adoption item 4b, and it cannot land here alone: it changes
 * how many table rows fit, so `useAutoPerPage()`'s hardcoded `433` must be
 * re-measured in the same change (VIHO_ADOPTION_PLAN.md phases 5 and 7).
 */

export function Card({
  children,
  bordered = true,
  className = "",
}: {
  children: ReactNode;
  /**
   * The brand hairline around the card. Off on index pages since 2026-08-10 —
   * the table already draws its own frame, so the outer border read as a second
   * box around the first.
   *
   * It is a prop rather than a `className` override because the border here is
   * a **width**, and `border-0` passed in would fight `border` on CSS source
   * order rather than on the caller's intent — the same trap `cn()`'s docblock
   * describes. A boolean cannot lose that argument.
   */
  bordered?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-hidden rounded-none bg-surface-wash dark:bg-night-card",
        bordered && "border border-brand/20 dark:border-night-border",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  icon,
  actions,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    /*
      No bottom rule under the heading, since 2026-08-10. It rendered as a line
      across the top of `CardContent`, and with the card's own border already
      gone it was the last hairline boxing the header in. The heading's weight
      and the padding separate it from the filters well enough — this design
      leans on borders, but three concentric ones around the same table is what
      that turns into if nobody stops it.
    */
    <div className="shrink-0 px-2 py-2 sm:px-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-bold text-ink dark:text-white">
            {icon}
            {title}
          </h2>
          {/*
            `ink-label` (#59667a), not `ink-muted` (#6b7280). At 11px this needs
            4.5:1, and muted measures 4.83 on white but drops to 4.19 on the
            `surface-wash` card — a fail. Label scores 5.05 on the same surface.
            If the card ever goes back to white, muted is fine again.
          */}
          {description && (
            <p className="mt-0.5 text-[11px] text-ink-label dark:text-night-muted">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function CardContent({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex min-h-0 flex-1 flex-col px-2 py-2 sm:px-2 ${className}`}>{children}</div>
  );
}

/**
 * Filter row: every filter `flex-1`, trailing controls `shrink-0`.
 *
 * Since 2026-08-10 this is **nested inside `DataTable`'s toolbar row**, sharing a
 * line with the column picker rather than sitting on its own above it. Hence
 * `min-w-0 flex-1` (it claims the leading space and lets its children wrap) and
 * no bottom margin — the toolbar row owns the spacing now. It renders nowhere
 * else, so this is the only shape it has to serve.
 */
export function FilterRow({ children }: { children: ReactNode }) {
  return <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{children}</div>;
}
