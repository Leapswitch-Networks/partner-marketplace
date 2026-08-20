import { ButtonHTMLAttributes, forwardRef } from "react";

import { cn } from "@/lib/utils/cn";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * `light` is Viho's `.btn-primary-light` — a brand-tinted fill with no border
   * that inverts to solid brand on hover. Use it for secondary actions that
   * should still read as brand, e.g. the header's Log out control.
   *
   * `danger` is the destructive action, added 2026-08-10. See the note below on
   * why it is filled rather than outlined.
   */
  variant?: "primary" | "outline" | "light" | "danger";
  /**
   * `sm` is for controls inside a dense row — the bulk-action bar above a table,
   * where a full-size button would set the row height. It is **not** a general
   * "less important" size; importance is `variant`'s job.
   */
  size?: "sm" | "md";
  loading?: boolean;
  fullWidth?: boolean;
}

/**
 * Button — Viho's `.btn`.
 *
 * Radius is `5px`, not our old `rounded-lg`. Viho's system is **squared surfaces
 * with rounded controls**: cards get `radius: 0` while buttons stay curved, so a
 * control keeping its radius is the rule rather than an exception to it.
 *
 * Padding is `.375rem 1.75rem` — wide horizontally relative to its height, which
 * is where the theme's buttons get their proportions. Those come from Bootstrap's
 * scale rather than Tailwind's, so they are arbitrary values on purpose.
 *
 * **No shadow.** `app.css` does define `box-shadow: 0 5px 10px 2px
 * rgba(36,105,92,.19)` for `.btn-primary`, and an earlier version of this file
 * applied it — but it does not render. Sampling the pixels directly below and
 * beside real Viho buttons (`auth-login-light.png`, `file-manager-light.png`)
 * gives pure `#ffffff`. The theme's 69 `box-shadow: none` rules win, which is
 * what "removes shadows more than it adds them" in the reference doc means in
 * practice. Buttons are flat.
 *
 * ## The `danger` variant, added 2026-08-10
 *
 * `UI_PATTERNS.md` had carried *"Need a destructive action? **Add one here** using
 * `tone-danger`, don't write one-off red classes at the call site"* since the Viho
 * migration, and the call sites had been inventing their own red anyway — the
 * delete-user confirm button and the bulk-delete control each shipped a private
 * `bg-tone-danger` string, with different padding, different radius and different
 * hover behaviour from each other. Two of them had **no hover state at all**
 * (`hover:bg-tone-danger` is the same colour), so the most dangerous button in the
 * app was the only one that did not respond to the pointer.
 *
 * It is **filled, not outlined**, matching `primary`. A destructive confirm is the
 * primary action of the dialog it sits in; making it quieter than the Cancel beside
 * it would be a decision about emphasis dressed up as a decision about safety. The
 * safety comes from `ConfirmDialog` requiring the click at all.
 *
 * ## The focus ring carries the variant's colour
 *
 * Every variant previously drew `focus:ring-brand`, which on a red button is a
 * teal halo. The ring is now per-variant. The **offset colour is also set**, which
 * fixes a live violation of `UI_PATTERNS.md` § The Signed-In Chrome Is Green:
 * `focus:ring-offset-2` with no `ring-offset-*` colour defaults to white, and on
 * the green chrome that draws a white halo around every focused button.
 */
// `hover:scale-[.98]` / `active:scale-[.96]` is the public surface's entire motion
// vocabulary, ported 2026-08-20 (BACKOFFICE_DESIGN.md § 7). **Buttons only** — a
// table row or sidebar item that shrinks under the cursor reads as a glitch, and
// the public cards darken their border instead for the same reason.
// `transition-colors` became an explicit list because `transform` has to be in it
// or the scale snaps; and `motion-reduce` neutralises it rather than speeding it up.
const BASE =
  "inline-flex items-center justify-center gap-2 rounded-[5px] font-semibold " +
  "transition-[color,background-color,border-color,transform] duration-200 " +
  "hover:scale-[.98] active:scale-[.96] motion-reduce:transform-none " +
  "focus:outline-none focus:ring-2 focus:ring-offset-2 ring-offset-surface-wash dark:ring-offset-night-card " +
  "disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100";

const SIZES = {
  // Viho's `.375rem 1.75rem` — see the padding note above.
  md: "px-7 py-1.5 text-sm",
  sm: "px-3 py-1 text-[11px]",
};

/**
 * ## `primary` is lilac, not the brand — changed 2026-08-20
 *
 * `--primary` is the marketing site's action colour (`#f0d7ff`) and `--brand` is
 * pine, which carries structure. That is the split the public surface already
 * runs, and porting it is what makes the two surfaces read as one product
 * (`BACKOFFICE_DESIGN.md` § 2.1, § 4.2).
 *
 * 🔴 **The border on `primary` is load-bearing, not decoration.** A lilac fill
 * measures **1.11:1 against the chrome ground** — it has essentially no edge of
 * its own, and WCAG 1.4.11 wants 3:1 for a component boundary. Ink on the chrome
 * is 12.27:1, so the border is what makes the button a shape. Remove it and the
 * primary action dissolves into the page.
 *
 * 🔴 **Never `text-white` here.** White on lilac is 1.32:1;
 * `text-primary-foreground` resolves to ink at 11.01:1.
 *
 * **Every variant now carries a border, transparent where it is not wanted**, so
 * all four render the same box. Before this, `outline` had one and `primary`,
 * `light` and `danger` did not — so a primary button was 2px smaller than the
 * outline button beside it, which is the kind of difference nobody chooses.
 *
 * Hover does not recolour `primary`: the reference's buttons shrink and hold their
 * colour, and `BASE` supplies that. The other three keep their colour hover,
 * because a tinted fill inverting on hover is Viho's own behaviour.
 *
 * The focus ring stays `brand` on `primary` — a lilac ring on a lilac fill would
 * be invisible, and pine is the house focus colour.
 */
const VARIANTS = {
  primary:
    "border border-ink bg-primary text-primary-foreground focus:ring-brand",
  outline:
    "border border-brand bg-transparent text-brand dark:text-brand-on-dark hover:bg-brand/10 focus:ring-brand",
  light:
    "border border-transparent bg-brand/10 text-brand dark:text-brand-on-dark hover:bg-brand/50 hover:text-white focus:ring-brand",
  danger:
    "border border-transparent bg-tone-danger text-white hover:bg-tone-danger/85 focus:ring-tone-danger",
};

/**
 * The button's classes, for the one case a `<button>` cannot serve: **a navigation
 * that must be a real link.**
 *
 * A `<Link>` styled by hand is how the Users detail page ended up with an Edit
 * control that was `h-9 … text-xs` while every other primary button on the same
 * screen was `py-1.5 … text-sm` — visibly a different size, for no reason anyone
 * chose. The alternative of `<Button onClick={() => router.push(…)}>` looks
 * identical but is not a link: no middle-click, no open-in-new-tab, no status-bar
 * URL, and nothing for a screen reader to announce as a destination.
 *
 * So: navigation gets an anchor wearing these classes; actions get `<Button>`.
 * Exported rather than inlined so the two cannot drift again.
 */
export function buttonClasses(
  variant: keyof typeof VARIANTS = "primary",
  size: keyof typeof SIZES = "md",
  className = ""
): string {
  return cn(BASE, SIZES[size], VARIANTS[variant], className);
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      fullWidth = false,
      children,
      disabled,
      className = "",
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={buttonClasses(
          variant,
          size,
          cn(fullWidth && "w-full", className)
        )}
        {...props}
      >
        {loading && (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
export default Button;
