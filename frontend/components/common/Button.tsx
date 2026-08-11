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
const BASE =
  "inline-flex items-center justify-center gap-2 rounded-[5px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ring-offset-surface-wash dark:ring-offset-night-card disabled:cursor-not-allowed disabled:opacity-60";

const SIZES = {
  // Viho's `.375rem 1.75rem` — see the padding note above.
  md: "px-7 py-1.5 text-sm",
  sm: "px-3 py-1 text-[11px]",
};

const VARIANTS = {
  primary: "bg-brand text-white hover:bg-brand-dark focus:ring-brand",
  outline:
    "border border-brand bg-transparent text-brand dark:text-brand-on-dark hover:bg-brand/10 focus:ring-brand",
  light:
    "bg-brand/10 text-brand dark:text-brand-on-dark hover:bg-brand/50 hover:text-white focus:ring-brand",
  danger: "bg-tone-danger text-white hover:bg-tone-danger/85 focus:ring-tone-danger",
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
