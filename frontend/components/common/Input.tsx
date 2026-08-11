import { InputHTMLAttributes, ReactNode, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  /** Helper text under the field. Hidden while an `error` is showing, so the
   *  two never stack and compete for the same spot. */
  hint?: string;
  /** Leading icon in a brand-tinted tile — Viho's `.input-group-text`. Pass an
   *  SVG sized `h-4 w-4`; the tile handles fill and centring. */
  addon?: ReactNode;
  /**
   * Leading icon **inside** the field, on its own background — no tile, no
   * divider. For filter bars, where a bordered `addon` tile reads as a second
   * control sitting next to a row of single controls. The reference's search
   * field uses exactly this. Ignored when `addon` is also passed.
   */
  leadingIcon?: ReactNode;
  /** Trailing control inside the field, e.g. the password `Show` toggle. Keep it
   *  to text or a small button — it sits on the input's own background. */
  trailing?: ReactNode;
}

/**
 * Text field — Viho's `.form-group` + `.input-group`.
 *
 * Everything renders through one group wrapper whether or not an `addon` is
 * passed, so a field with an icon and a field without cannot drift apart in
 * height, radius or focus treatment.
 *
 * **The focus ring is ours, deliberately.** Viho's login stylesheet sets
 * `:focus { box-shadow: none }` and removes the indicator outright. That is
 * exception E4 in `documentation/design/VIHO_ADOPTION_PLAN.md` — removing it
 * breaks keyboard navigation, and `UI_PATTERNS.md` forbids `outline-none`
 * without a replacement. The ring is on the *group* rather than the input, so
 * the addon tile is enclosed by it.
 */
const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, addon, leadingIcon, trailing, id, className = "", ...props }, ref) => {
    const inputId = id ?? label.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-[5px]">
        {/* An empty label is a deliberate opt-out for filter bars, where the
            placeholder carries the meaning and a visible label wastes a row. */}
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-semibold text-ink dark:text-white"
          >
            {label}
          </label>
        )}

        <div
          className={`flex items-stretch overflow-hidden rounded-[5px] border transition-colors
            focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20
            ${
              error
                ? "border-tone-danger bg-tone-danger/5 dark:border-tone-danger"
                : "border-surface-border bg-white dark:border-night-border dark:bg-night-card"
            }`}
        >
          {addon && (
            <span
              aria-hidden="true"
              className="flex w-11 shrink-0 items-center justify-center border-r border-surface-border bg-brand/10 text-brand dark:text-brand-on-dark dark:border-night-border dark:bg-brand/20"
            >
              {addon}
            </span>
          )}

          {!addon && leadingIcon && (
            <span
              aria-hidden="true"
              className="flex shrink-0 items-center pl-3 text-ink-muted dark:text-night-muted"
            >
              {leadingIcon}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            aria-invalid={error ? true : undefined}
            className={`w-full min-w-0 border-0 bg-transparent py-2.5 pr-3.5 text-sm text-ink outline-none
              ${!addon && leadingIcon ? "pl-2" : "pl-3.5"}
              placeholder:text-ink-muted focus:ring-0
              dark:text-white dark:placeholder:text-night-muted
              ${className}`}
            {...props}
          />

          {trailing && (
            <span className="flex shrink-0 items-center pr-3.5">{trailing}</span>
          )}
        </div>

        {error ? (
          <p className="text-xs text-tone-danger">{error}</p>
        ) : (
          hint && <p className="text-xs text-ink-muted dark:text-night-muted">{hint}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
export default Input;
