import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";
import SurfaceCard, { groundText, type CardGround } from "./SurfaceCard";

/**
 * The full-width band that opens a page — a heading, a sentence, and somewhere to go.
 *
 * This is the back office's `SectionSlab`. On the public surface the page is a stack
 * of coloured slabs on cream, and the alternation is most of what gives that surface
 * its rhythm (`FRONTEND_PLAN.md` § 15.4, § 15.6). `WelcomeBanner` has been an
 * accidental version of this since before the port — `bg-brand text-white`, 8.86:1
 * against the chrome — and this generalises it.
 *
 * ## 🔴 Use one per page, at most
 *
 * The slab works *because* the rest of the page is lighter. A page of slabs is a
 * wall of colour and reads as louder, not richer — which is exactly why
 * `BACKOFFICE_DESIGN.md` § 4.10 refuses to turn the dashboard's stat cards ink.
 * The rhythm is the point, not the colour.
 *
 * ## The eyebrow
 *
 * Uppercase, tracked, in the ground's emphasis colour. Lifted from the public
 * surface, where an amber tracked eyebrow over a large heading is the standard
 * opening for a section (`contact/page.tsx`). On a dark ground `groundText()` makes
 * that amber automatically; on a light one it becomes the brand, because amber on a
 * light ground is 1.91:1.
 */
export interface FeatureSlabProps {
  /** Short, uppercase in render. Two or three words. */
  eyebrow?: string;
  title: string;
  /** One or two sentences. Constrained to `max-w-2xl` — a full-width line of body
   * text at 2560px is unreadable regardless of contrast. */
  description?: string;
  /** Buttons. Inside a dark slab use `variant="light"` or an outline — a lilac
   * primary on ink is legible but fights the ground, which is the reason the public
   * surface has a separate `onDeep` variant. */
  actions?: ReactNode;
  /** Figures or a badge row, on the right at `sm` and above. */
  aside?: ReactNode;
  ground?: CardGround;
  className?: string;
}

export default function FeatureSlab({
  eyebrow,
  title,
  description,
  actions,
  aside,
  ground = "brand",
  className,
}: FeatureSlabProps) {
  const t = groundText(ground);

  return (
    <SurfaceCard ground={ground} padding="lg" className={className}>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <p className={cn("text-[11px] font-semibold uppercase tracking-[0.12em]", t.emphasis)}>
              {eyebrow}
            </p>
          )}
          <h2 className={cn("app-display mt-1.5 text-[23px] leading-tight tracking-[-0.015em] sm:text-[28px]", t.body)}>
            {title}
          </h2>
          {description && (
            <p className={cn("mt-2 max-w-2xl text-sm leading-relaxed", t.muted)}>{description}</p>
          )}
          {actions && <div className="mt-5 flex flex-wrap items-center gap-3">{actions}</div>}
        </div>

        {aside && <div className="shrink-0">{aside}</div>}
      </div>
    </SurfaceCard>
  );
}
