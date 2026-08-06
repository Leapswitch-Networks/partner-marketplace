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
      className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border border-surface-border bg-white dark:border-night-border dark:bg-night-card ${className}`}
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
    <div className="shrink-0 border-b border-surface-border px-4 py-3 dark:border-night-border sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-bold text-ink dark:text-white">
            {icon}
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 text-[11px] text-ink-muted dark:text-night-muted">{description}</p>
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
