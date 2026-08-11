import { cn } from "@/lib/utils/cn";
import { getInitials } from "@/lib/utils/user";
import type { CurrentUser, ManagedUser } from "@/types";

/**
 * The initials disc.
 *
 * Four screens drew this by hand before this component existed — the Users table,
 * the header account badge, the mobile drawer and the profile card — at four sizes
 * with four type scales, and `getInitials()` sat in `lib/utils/user.ts` **unused by
 * any of them**. Each had reimplemented "first two characters, uppercased" inline
 * or leaned on the server's `initials` field without a fallback.
 *
 * There is no image variant, and that is not an oversight: the account model has no
 * avatar upload. When one lands, it belongs here — an `src` prop that falls back to
 * these initials — rather than as a fifth hand-rolled disc.
 *
 * ## Accessibility
 *
 * Decorative by default. In every current use the person's name is either rendered
 * beside the disc or already on the wrapping control's `aria-label`, so announcing
 * "A M" as well is noise. Pass `label` where the disc is genuinely the only
 * identifier and it becomes a labelled image instead.
 *
 * ## No `dark:` variant, deliberately
 *
 * `UI_PATTERNS.md` § Dark Mode Rules requires a `dark:` counterpart for every
 * colour utility *"unless it is genuinely identical in both themes"*, and this is
 * that exception: a solid `bg-brand` fill with white text, the same treatment the
 * active sidebar item uses in both themes. White on `#24695c` measures 5.9:1, so
 * it passes AA on either canvas. Stated here so the absence reads as a decision
 * rather than the most common miss in the codebase.
 */
export default function Avatar({
  user,
  initials,
  size = "sm",
  label,
  className = "",
}: {
  /** Derives the initials, with the `getInitials` fallback for a missing server value. */
  user?: CurrentUser | ManagedUser | null;
  /** Explicit initials, for callers that have no user object. Wins over `user`. */
  initials?: string;
  size?: "sm" | "md" | "lg";
  /** Announce the disc to screen readers with this name instead of hiding it. */
  label?: string;
  className?: string;
}) {
  const text = initials ?? getInitials(user ?? null);

  const sizes = {
    sm: "h-7 w-7 text-[10px]",
    md: "h-8 w-8 text-xs",
    lg: "h-14 w-14 text-lg",
  };

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-brand font-bold text-white",
        sizes[size],
        className
      )}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      {text}
    </span>
  );
}
