import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * The one place a page's title and description are defined.
 *
 * Built 2026-08-20. Before it, **nine admin modules each hand-rolled the same
 * three lines** — `<h1 className="text-lg font-semibold text-ink dark:text-gray-100">`
 * over `<p className="mt-1 text-sm text-ink-muted dark:text-night-muted">` — plus
 * `ShowPage`, `CardHeader`, the settings layout and four section headings on their
 * own variants. Twelve definitions of one idea, which is why the display face could
 * not be applied "everywhere" without editing twenty files, and why it would have
 * drifted again by the next feature.
 *
 * ## The three sizes are the hierarchy
 *
 * | size | renders | where |
 * |---|---|---|
 * | `page` | 21px | a page's own title — the default |
 * | `section` | 19px | a titled block inside a page |
 * | `compact` | 18px / `leading-5` | a header sitting directly above a table |
 *
 * `compact` exists for one measured reason. `CardHeader` sits inside the index
 * `Card`, and `useAutoPerPage()` computes rows as
 * `floor((viewportHeight − 433) / 38)` — that 433 is the chrome above and below the
 * table. **Growing the header's box costs a table row at common viewport heights**,
 * which is the coupling `Card.tsx` has warned about since the Viho migration. So
 * `compact` raises the type from 14px to 18px while holding the line box at 20px:
 * the title gets its proper scale and `CHROME_OVERHEAD` needs no re-measuring.
 *
 * ## Type
 *
 * Titles are set in `.app-display` — the shared display face, the same variable the
 * public marketing site reads (`globals.css`, `public.css`). 🔴 **No `font-bold` or
 * `font-semibold`:** only weight 400 is loaded and the browser would synthesise a
 * fake bold, which on a high-contrast serif looks smeared. Size carries the
 * emphasis.
 *
 * Descriptions use `ink-label`, **not** `ink-muted`. On the tinted chrome muted
 * measures 4.51:1 against label's 5.43:1 — both pass since the ground was warmed,
 * but muted was a documented AA failure at 4.07 before that and is the wrong habit
 * to keep.
 */

const TITLE = {
  page: "text-[21px]",
  section: "text-[19px]",
  // 18px type in a 20px line box — see the docblock. Do not add leading here.
  compact: "text-[18px] leading-5",
} as const;

const GAP = {
  page: "mt-1",
  section: "mt-1",
  compact: "mt-0.5",
} as const;

const DESC = {
  page: "text-sm",
  section: "text-sm",
  compact: "text-[11px]",
} as const;

/**
 * The title's type classes, for the one case the component cannot serve: **a
 * heading whose title is a multi-line JSX expression already nested inside its
 * own layout.**
 *
 * Exported rather than inlined for exactly the reason `common/Button.tsx` exports
 * `buttonClasses` — a caller that cannot use the component must still not restate
 * the definition, or the two drift and the display face stops being universal.
 * Returns the type only; the caller keeps its own colour classes.
 */
export function headingClasses(size: keyof typeof TITLE = "page"): string {
  return `app-display ${TITLE[size]}`;
}

export interface PageHeadingProps {
  title: ReactNode;
  description?: ReactNode;
  /** A mark before the title. Rendered in the brand colour, as a unit with its dark twin. */
  icon?: ReactNode;
  /** Buttons or filters, pushed to the trailing edge and wrapping under on narrow screens. */
  actions?: ReactNode;
  size?: keyof typeof TITLE;
  /** `h1` for a page, `h2` for a section. Defaults from `size`. */
  as?: "h1" | "h2" | "h3";
  className?: string;
}

export default function PageHeading({
  title,
  description,
  icon,
  actions,
  size = "page",
  as,
  className,
}: PageHeadingProps) {
  const Tag = as ?? (size === "page" ? "h1" : "h2");

  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="flex min-w-0 items-start gap-2">
        {icon && (
          <span aria-hidden="true" className="mt-0.5 shrink-0 text-brand dark:text-brand-on-dark">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <Tag className={cn("app-display text-ink dark:text-white", TITLE[size])}>{title}</Tag>
          {description && (
            <p
              className={cn(
                "text-ink-label dark:text-night-muted",
                GAP[size],
                DESC[size]
              )}
            >
              {description}
            </p>
          )}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
