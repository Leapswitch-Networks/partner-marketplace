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
      className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800 ${className}`}
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
    <div className="shrink-0 border-b border-gray-100 px-4 py-3 dark:border-gray-800 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-gray-100">
            {icon}
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">{description}</p>
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
