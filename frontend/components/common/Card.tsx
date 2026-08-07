import type { ReactNode } from "react";

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
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border border-brand/20 bg-surface-wash dark:border-night-border dark:bg-night-card ${className}`}
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
    <div className="shrink-0 border-b border-brand/20 px-4 py-3 dark:border-night-border sm:px-5">
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
    <div className={`flex min-h-0 flex-1 flex-col px-4 py-3 sm:px-5 ${className}`}>{children}</div>
  );
}

/** Filter row: every filter `flex-1`, trailing controls `shrink-0`. */
export function FilterRow({ children }: { children: ReactNode }) {
  return <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">{children}</div>;
}
