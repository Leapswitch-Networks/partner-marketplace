import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * `light` is Viho's `.btn-primary-light` — a brand-tinted fill with no border
   * that inverts to solid brand on hover. Use it for secondary actions that
   * should still read as brand, e.g. the header's Log out control.
   */
  variant?: "primary" | "outline" | "light";
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
 * The primary shadow is **brand-tinted, not black** (`shadow-brand`). Viho
 * colours its shadows throughout and removes them more often than it adds them.
 */
const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      loading = false,
      fullWidth = false,
      children,
      disabled,
      className = "",
      ...props
    },
    ref
  ) => {
    const base =
      "inline-flex items-center justify-center gap-2 rounded-[5px] px-7 py-1.5 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand disabled:cursor-not-allowed disabled:opacity-60";

    const variants = {
      primary: "bg-brand text-white shadow-brand hover:bg-brand-dark",
      outline: "border border-brand bg-transparent text-brand dark:text-brand-on-dark hover:bg-brand/10",
      light: "bg-brand/10 text-brand dark:text-brand-on-dark hover:bg-brand/50 hover:text-white",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`${base} ${variants[variant]} ${fullWidth ? "w-full" : ""} ${className}`}
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
