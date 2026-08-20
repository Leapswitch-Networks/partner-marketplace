import type { ReactNode } from "react";

export type BadgeTone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "brand"
  | "info"
  | "pending";

const TONES: Record<BadgeTone, string> = {
  neutral:
    "border-surface-border bg-gray-50 text-gray-600 dark:border-night-border dark:bg-night-card dark:text-gray-300",
  success:
    "border-tone-success/40 bg-tone-success/10 text-tone-success dark:border-tone-success/50 dark:bg-tone-success/15 dark:text-brand-on-dark",
  warning:
    "border-tone-warning/40 bg-tone-warning/15 text-ink dark:border-tone-warning/40 dark:bg-tone-warning/15 dark:text-tone-warning",
  danger:
    "border-tone-danger/40 bg-tone-danger/10 text-tone-danger dark:border-tone-danger/50 dark:bg-tone-danger/15 dark:text-tone-danger",
  brand:
    "border-brand bg-brand/10 text-brand dark:text-brand-on-dark dark:border-brand/40 dark:bg-brand/20 dark:text-brand-on-dark",
  info: "border-brand/30 bg-brand/10 text-brand dark:border-brand/40 dark:bg-brand/15 dark:text-brand-on-dark",
  // Added 2026-08-20. **The one place the action colour is not an action.**
  //
  // `VerificationBadge` on the public surface is a three-tier scale — pine ground
  // for the top tier, lilac ground for the middle, cream for the base — so lilac
  // carrying a *status* rather than a control is the reference's own usage
  // (`BACKOFFICE_DESIGN.md` § 4.4). Use it for pending / in-review / awaiting
  // states: the things that are neither settled-good (`success`) nor wrong
  // (`danger`), which previously had to borrow `warning` and so read as a problem.
  //
  // Solid rather than tinted, unlike every tone above it. `bg-primary/10` over a
  // white card is very nearly white, and the whole point of lilac is that it is
  // recognisably the marketing site's colour. Ink on lilac is **11.01:1**, and
  // both are absolute colours, so one declaration serves light and dark — hence no
  // `dark:` fill. The border is `ink`, matching the button, because a lilac fill
  // has almost no edge of its own against a light ground.
  pending: "border-ink/25 bg-primary text-ink dark:border-ink/50 dark:text-ink",
};

/**
 * Outlined status/label badge, following LeapDesk's badge standard — every tone
 * carries an explicit dark variant, and colour never conveys meaning on its own
 * (the label always says it too).
 *
 * Pass `onClick` to make it a toggle. It then renders as a real `<button>` so it
 * is keyboard reachable — a clickable `<span>` is not.
 */
export default function Badge({
  children,
  tone = "neutral",
  onClick,
  disabled,
  title,
  className = "",
}: {
  children: ReactNode;
  tone?: BadgeTone;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  // `text-xs 2xl:text-sm` matches the table's own scale exactly. It was a
  // hardcoded `text-[11px]`, so a Status, Role or Type cell rendered one pixel
  // smaller than the Email and Last-login cells beside it — close enough to look
  // like a rendering fault rather than a deliberate hierarchy. Emphasis inside a
  // row is carried by `font-semibold` and by colour, never by size.
  const base =
    "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold whitespace-nowrap 2xl:text-sm";

  if (!onClick) {
    return (
      <span title={title} className={`${base} ${TONES[tone]} ${className}`}>
        {children}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`${base} ${TONES[tone]} ${
        disabled
          ? "cursor-not-allowed opacity-60"
          : "cursor-pointer transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      } ${className}`}
    >
      {children}
    </button>
  );
}
