import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils/cn";
import SurfaceCard, { groundText, type CardGround } from "./SurfaceCard";

/**
 * A card that goes somewhere. Icon, what it is, what it does, and an arrow.
 *
 * ## The arrow nudges; the card does not move
 *
 * `group-hover:translate-x-0.5 -translate-y-0.5` — two pixels, diagonally, toward
 * the direction of travel. It is lifted from the public surface's `pub-nudge`
 * (`PartnerCard`), and it is the *only* motion here: `BACKOFFICE_DESIGN.md` § 7
 * reserves the hover-shrink for buttons, because a card that shrinks under the
 * cursor in a grid of six reads as a glitch. The border darkening is the card's own
 * hover signal, and `SurfaceCard` supplies it.
 *
 * Two pixels is also chosen so nothing reflows — the arrow has its own box and the
 * transform does not participate in layout.
 *
 * ## It renders an anchor when given `href`
 *
 * Every quick action navigates. `<div onClick>` has no middle-click, no
 * open-in-new-tab, no status-bar URL and nothing for assistive tech to announce as
 * a destination — the same argument `common/Button.tsx` and the public
 * `PublicButton` both make. `SurfaceCard` handles it; this component only has to
 * pass `href` down.
 */
export interface ActionCardProps {
  title: string;
  description?: string;
  /** A `lucide-react` icon. Rendered at `h-5 w-5` inside a squared tile. */
  icon?: ReactNode;
  href?: string;
  onClick?: () => void;
  ground?: CardGround;
  /** Replaces the arrow — for "3 waiting" or a `Badge`. */
  trailing?: ReactNode;
  className?: string;
}

export default function ActionCard({
  title,
  description,
  icon,
  href,
  onClick,
  ground = "paper",
  trailing,
  className,
}: ActionCardProps) {
  const t = groundText(ground);

  return (
    <SurfaceCard
      ground={ground}
      padding="md"
      href={href}
      onClick={onClick}
      className={cn("group", className)}
    >
      <div className="flex items-start gap-3">
        {icon && (
          <span
            aria-hidden="true"
            className={cn(
              // A squared tile, matching the card. The fill is the ground's own
              // emphasis at low opacity, so it reads as belonging rather than as a
              // second colour introduced here.
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-none",
              "[&>svg]:h-5 [&>svg]:w-5",
              ground === "ink" || ground === "brand"
                ? "bg-white/10"
                : ground === "amber" || ground === "lilac"
                  ? "bg-ink/10"
                  : "bg-brand/10",
              t.emphasis
            )}
          >
            {icon}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <p className={cn("text-sm font-semibold leading-snug", t.body)}>{title}</p>
          {description && (
            <p className={cn("mt-1 text-xs leading-relaxed", t.muted)}>{description}</p>
          )}
        </div>

        <span className={cn("shrink-0", t.emphasis)}>
          {trailing ?? (
            <ArrowUpRight
              aria-hidden="true"
              className="h-4 w-4 -translate-y-0.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-1 motion-reduce:transform-none"
            />
          )}
        </span>
      </div>
    </SurfaceCard>
  );
}
