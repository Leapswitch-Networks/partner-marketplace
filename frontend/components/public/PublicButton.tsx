import { AnchorHTMLAttributes, ButtonHTMLAttributes, forwardRef } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils/cn";

/**
 * The public surface's button — the signature component of the reference.
 *
 * Measured from wisprflow.ai and recorded in `FRONTEND_PLAN.md` § 15.4:
 *
 * ```css
 * background: #f0d7ff;      border: 2px solid #1a1a1a;   border-radius: .5rem;
 * padding: 1rem 1.5rem;     font-weight: 600;            line-height: 1;
 * :hover { transform: scale(.98) }
 * ```
 *
 * ## Three things that look like details and are not
 *
 * 1. **The border is 2px, and it is on every variant including the filled ones.**
 *    Borders at 2px instead of 1px are most of why the reference reads as
 *    confident rather than delicate. Dropping it to 1px here would quietly undo
 *    the whole look.
 * 2. **Hover shrinks — `scale(.98)`.** It does not lift, glow, or change colour.
 *    That is the surface's entire motion vocabulary (§ 15.5), so a one-off hover
 *    elsewhere reads as a different site.
 * 3. **No shadow.** § 15.6: the reference and our own token set agree — surfaces
 *    are separated with borders, not elevation. This matches `Button.tsx`'s note
 *    for the signed-in app, arrived at independently.
 *
 * ## Contrast, from the audit in § 15.10
 *
 * `primary` is ink on lilac at **13.15:1** and `deep` is cream on pine at
 * **9.39:1** — both clear AA with enormous margin. There is deliberately no
 * amber or coral variant: those measure 1.88:1 and 2.77:1 on cream and may never
 * carry text on this surface.
 *
 * ## Why it renders an `<a>` when given `href`
 *
 * Every button on the home page navigates. A `<button>` that routes is
 * unreachable by middle-click, "open in new tab", and by anyone reading the page
 * with assistive tech that lists links. `NEXTJS_STANDARDS.md` makes the same
 * point for the app shell; it matters more here because this surface is read by
 * strangers and crawlers.
 */
type Variant = "primary" | "secondary" | "deep" | "outline" | "onDeep" | "dark" | "text";
type Size = "md" | "sm" | "lg";

const BASE =
  "pub-focus inline-flex items-center justify-center gap-2 rounded-lg font-semibold leading-none " +
  "text-center no-underline transition-transform duration-200 hover:scale-[.98] active:scale-[.96] " +
  "disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100";

const VARIANTS: Record<Variant, string> = {
  // The default. Lavender fill, near-black 2px border.
  primary: "pub-lilac-bg pub-ink border-2 border-[color:var(--public-ink)]",
  // `.is-secondary` — cream fill, same border. For the second action in a pair.
  secondary: "pub-bg pub-ink border-2 border-[color:var(--public-ink)]",
  // `.is-secondary` green variant — used ON cream, and as the primary action
  // inside a dark or pine slab where lilac would fight the ground.
  deep: "pub-deep-bg pub-cream border-2 border-[color:var(--public-bg)]",
  // `.green-outline` — quiet tertiary action, on cream.
  outline: "bg-transparent pub-deep border-2 border-[color:var(--public-deep)]",
  // `.is-secondary.is-transparent` — the SECOND action inside a pine or ink
  // slab. A variant rather than a className override on `secondary` because
  // these classes are plain CSS scoped under `.public-root` (see `public.css`):
  // two of them setting the same property tie on specificity, and stylesheet
  // order decides the winner rather than the call site.
  onDeep: "bg-transparent pub-cream border-2 border-[color:var(--public-bg)]",
  // `.is-dark`.
  dark: "pub-ink-bg pub-cream border-2 border-[color:var(--public-ink)]",
  // `.is-text` — reserves its border transparent so nothing shifts on hover.
  text: "bg-transparent pub-ink border-2 border-transparent underline-offset-4 hover:underline",
};

// ⚠️ Touch targets ≥36px below `sm` — `UI_PATTERNS.md` § Responsive Contract.
// `sm` here is still 40px tall, which clears it; `md` and `lg` are well over.
const SIZES: Record<Size, string> = {
  sm: "min-h-9 px-3 py-2 text-sm",
  md: "min-h-11 px-5 py-3 text-[0.9375rem] sm:px-6 sm:py-4",
  lg: "min-h-12 px-6 py-4 text-base sm:text-lg",
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  className?: string;
  children: React.ReactNode;
}

type LinkProps = CommonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof CommonProps> & { href: string };
type BtnProps = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps> & { href?: undefined };

export type PublicButtonProps = LinkProps | BtnProps;

const PublicButton = forwardRef<HTMLAnchorElement | HTMLButtonElement, PublicButtonProps>(
  function PublicButton(
    { variant = "primary", size = "md", fullWidth, className, children, ...rest },
    ref,
  ) {
    const classes = cn(
      BASE,
      VARIANTS[variant],
      SIZES[size],
      fullWidth && "w-full",
      className,
    );

    if (typeof rest.href === "string") {
      const { href, ...anchorRest } = rest as LinkProps;
      return (
        <Link
          href={href}
          ref={ref as React.Ref<HTMLAnchorElement>}
          className={classes}
          {...anchorRest}
        >
          {children}
        </Link>
      );
    }

    const buttonRest = rest as BtnProps;
    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        type={buttonRest.type ?? "button"}
        className={classes}
        {...buttonRest}
      >
        {children}
      </button>
    );
  },
);

export default PublicButton;
