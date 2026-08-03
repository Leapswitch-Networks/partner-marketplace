import type { ReactNode } from "react";

export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "brand" | "info";

const TONES: Record<BadgeTone, string> = {
  neutral:
    "border-gray-300 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300",
  success:
    "border-green-300 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-950 dark:text-green-400",
  warning:
    "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-400",
  danger:
    "border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-400",
  brand:
    "border-[#F97316] bg-orange-50 text-[#F97316] dark:border-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
  info: "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-400",
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
  const base =
    "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap";

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
          : "cursor-pointer transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316]/40"
      } ${className}`}
    >
      {children}
    </button>
  );
}
