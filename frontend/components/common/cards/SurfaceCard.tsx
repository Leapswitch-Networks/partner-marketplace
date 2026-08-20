import type { ReactNode } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils/cn";

/**
 * The card engine — **one place owns what a card looks like.**
 *
 * Built 2026-08-20 from `BACKOFFICE_DESIGN.md` § 2.2 and § 5. Before it there were
 * five hand-rolled card surfaces (`StatCard`, `QuickActionsCard`,
 * `PartnerOverview`'s tiles, `StatTiles`, `EmptyState`), and three of them had
 * drifted onto a border colour that is invisible on the chrome — the same class of
 * bug three times, because there was no single definition to fix.
 *
 * ## Why a card is defined by its GROUND
 *
 * The public marketing surface never picks an emphasis colour by hand. It picks a
 * ground, and the ground decides the body text, the muted text, the hairline and
 * the accent — as a set (`SectionSlab.tsx`, `StepList.tsx`). This component makes
 * that mechanical: pass a `ground`, and `groundText()` hands you the matching
 * foregrounds. **A call site cannot mix one ground's fill with another's text.**
 *
 * ## The border is structural, not decoration
 *
 * Measured 2026-08-20 — every ground has one mode where its fill cannot separate
 * it from the page behind it:
 *
 * | ground | vs the light chrome | vs `night.body` |
 * |---|---|---|
 * | `paper` / `sunken` | **1.07:1** | 14.63 / 12.80 |
 * | `ink` | 13.58 | **1.00:1** — identical |
 * | `brand` | 8.86 | **1.54:1** |
 * | `amber` | **1.78:1** | 7.67 |
 * | `lilac` | **1.23:1** | 11.05 |
 *
 * So in each mode either the fill or the border does the separating, and which one
 * flips per ground. **Every card therefore always carries a border.** That is the
 * measurement behind this design separating surfaces with borders rather than
 * elevation — it is not only a stylistic inheritance from Viho.
 *
 * ## Squared surfaces, rounded controls
 *
 * `rounded-none`, deliberately. Viho's rule, recorded in `common/Button.tsx`:
 * *"squared surfaces with rounded controls — cards get radius 0 while buttons stay
 * curved."* `Card`, `StatCard` and `QuickActionsCard` all already do this. The
 * public surface's 2–5rem slab radius does **not** port; see § 5 — a 2rem corner
 * eats a table cell, and a marketing page is looked at for forty seconds where a
 * tool is used for eight hours.
 *
 * ## No shadow, ever
 *
 * Not even on `interactive`. A shadow here would mean "this floats", which a card
 * does not. Interactivity is signalled by the border darkening — the same thing the
 * reference's own cards do on hover. Hover does **not** shrink either: that is
 * reserved for buttons (§ 7), because a card that shrinks under the cursor in a
 * grid of eight reads as a glitch.
 */

/** Every ground a card may take. Ordered light → dark → highlight. */
export type CardGround = "paper" | "sunken" | "ink" | "brand" | "amber" | "lilac";

/**
 * The grounds that may carry a metric with a delta.
 *
 * `amber` and `lilac` are highlight grounds for a callout, and a red or green
 * delta on top of them has no honest colour — the ground is already carrying the
 * emphasis. Restricting the type is how that stays a compile error rather than a
 * judgement call at each call site.
 */
export type MetricGround = Extract<CardGround, "paper" | "sunken" | "ink" | "brand">;

const FILL: Record<CardGround, string> = {
  paper: "bg-white dark:bg-night-card",
  sunken: "bg-surface-tile dark:bg-night-border",
  // Absolute colours: an ink slab is the same slab in both themes. `StatTiles`
  // is the one exception and documents why (it sits *inside* a dark card).
  ink: "bg-ink",
  brand: "bg-brand",
  amber: "bg-accent",
  lilac: "bg-primary",
};

const BORDER: Record<CardGround, string> = {
  paper: "border-brand/20 dark:border-night-border",
  sunken: "border-brand/20 dark:border-night-border",
  // A light hairline: ink is 1.00:1 against `night.body`, so in dark mode this
  // border is the *only* thing separating the card from the page.
  ink: "border-white/15",
  brand: "border-white/20",
  // A dark hairline, for the same reason in reverse — amber and lilac are 1.78:1
  // and 1.23:1 against the light chrome.
  amber: "border-ink/20",
  lilac: "border-ink/25",
};

/** Applied only when `interactive`. Always a border shift — never a shadow. */
const HOVER: Record<CardGround, string> = {
  paper: "hover:border-brand/45",
  sunken: "hover:border-brand/45",
  ink: "hover:border-white/35",
  brand: "hover:border-white/45",
  amber: "hover:border-ink/45",
  lilac: "hover:border-ink/50",
};

/**
 * The focus ring, per ground.
 *
 * `ring-offset-*` **must** carry a colour or Tailwind defaults it to white and
 * draws a halo on the tinted chrome — a live violation `UI_PATTERNS.md` § The
 * Signed-In Chrome Is Green calls out by name. On the dark grounds the offset is
 * the card's own fill, so the ring reads as a gap rather than a white outline.
 */
const FOCUS: Record<CardGround, string> = {
  paper: "focus-visible:ring-brand ring-offset-surface-wash dark:ring-offset-night-card",
  sunken: "focus-visible:ring-brand ring-offset-surface-wash dark:ring-offset-night-card",
  ink: "focus-visible:ring-accent ring-offset-ink",
  brand: "focus-visible:ring-accent ring-offset-brand",
  amber: "focus-visible:ring-ink ring-offset-accent",
  lilac: "focus-visible:ring-ink ring-offset-primary",
};

/**
 * The foregrounds that belong to each ground. **Take a whole row; never mix two.**
 *
 * This is `BACKOFFICE_DESIGN.md` § 2.2 expressed as code. `emphasis` is the one
 * that catches people out: on a light ground it is the brand, and on a dark ground
 * it is amber — which is the marketing surface's own rule (`StepList`:
 * `dark ? amber : pub-deep`).
 *
 * ⚠️ `amber` may never be text on a light ground — 1.91:1. That is why `paper` and
 * `sunken` reach for `accent-dark` and the dark grounds reach for `accent`.
 */
export function groundText(ground: CardGround): {
  body: string;
  muted: string;
  emphasis: string;
  success: string;
  danger: string;
} {
  switch (ground) {
    case "ink":
      return {
        body: "text-white",
        muted: "text-white/70", // 7.90:1
        emphasis: "text-accent", // amber, 7.64:1
        success: "text-brand-on-dark", // 5.40:1
        danger: "text-[rgb(var(--tone-danger-on-dark))]",
      };
    case "brand":
      return {
        body: "text-white", // 9.50:1
        muted: "text-white/75", // 6.10:1
        emphasis: "text-accent", // 4.98:1
        // A green "up" on a green ground says nothing. White carries it and the
        // arrow glyph carries the direction.
        success: "text-white",
        danger: "text-[rgb(var(--tone-danger-on-dark))]",
      };
    case "amber":
      return {
        body: "text-ink", // 7.64:1
        muted: "text-ink/80", // 5.00:1
        emphasis: "text-brand", // 4.98:1
        success: "text-brand",
        danger: "text-ink",
      };
    case "lilac":
      return {
        body: "text-ink", // 11.01:1
        muted: "text-ink/70",
        emphasis: "text-brand", // 7.18:1
        success: "text-brand",
        danger: "text-tone-danger",
      };
    default:
      // `paper` and `sunken` share a row: 5.82 and 5.09 for `ink-label`, both AA.
      // ⚠️ NOT `ink-muted` — 4.83 on white but 4.19 on a tinted card, an AA fail.
      return {
        body: "text-ink dark:text-white",
        muted: "text-ink-label dark:text-night-muted",
        emphasis: "text-brand dark:text-brand-on-dark",
        success: "text-tone-success dark:text-brand-on-dark",
        danger: "text-tone-danger dark:text-[rgb(var(--tone-danger-on-dark))]",
      };
  }
}

/** Compact by default. `lg` matches the dashboard cards' existing `p-6`. */
const PADDING = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
} as const;

export interface SurfaceCardProps {
  ground?: CardGround;
  padding?: keyof typeof PADDING;
  /**
   * Adds the hover and focus treatment. Set it automatically by passing `href` or
   * `onClick` — pass it explicitly only for a card whose interactive element is
   * nested inside.
   */
  interactive?: boolean;
  /** Renders a real `<Link>`. A card that navigates must be an anchor: a `<div>` with
   * an onClick has no middle-click, no open-in-new-tab and nothing for a screen
   * reader to announce as a destination. */
  href?: string;
  onClick?: () => void;
  /** Accessible name, required when the card is interactive and its text is not enough. */
  ariaLabel?: string;
  className?: string;
  children: ReactNode;
}

export default function SurfaceCard({
  ground = "paper",
  padding = "md",
  interactive,
  href,
  onClick,
  ariaLabel,
  className,
  children,
}: SurfaceCardProps) {
  const isInteractive = interactive ?? Boolean(href || onClick);

  const classes = cn(
    // `rounded-none` — squared surfaces, rounded controls. See the docblock.
    "relative flex h-full flex-col overflow-hidden rounded-none border text-left",
    "transition-colors duration-200",
    FILL[ground],
    BORDER[ground],
    PADDING[padding],
    isInteractive && [
      HOVER[ground],
      "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
      FOCUS[ground],
    ],
    className
  );

  if (href) {
    return (
      <Link href={href} aria-label={ariaLabel} className={cn(classes, "no-underline")}>
        {children}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-label={ariaLabel} className={cn(classes, "w-full")}>
        {children}
      </button>
    );
  }

  return <div className={classes}>{children}</div>;
}
