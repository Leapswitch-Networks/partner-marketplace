import type { ReactNode } from "react";

/**
 * Frame for the standalone auth pages reached from an emailed link.
 *
 * Shared so the four of them — verify email, reset password, forgot password,
 * accept invitation — cannot drift apart in width, padding or dark-mode treatment.
 * They are the first thing a new user sees, often before they have an account, so
 * four slightly different cards would be four slightly different first impressions.
 *
 * Matched to `AuthHub`'s Viho card on 2026-08-05: square corners, **no border**,
 * 30px padding, `max-w-[450px]`, no shadow — the `(auth)` layout's 10% brand wash
 * is what lifts it off the page. The orange `P` monogram that used to sit above
 * the title is gone; Viho's auth card is the card alone.
 *
 * The `(auth)` layout already centres its children and paints the page, so this
 * only owns the card itself.
 */
export default function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="w-full max-w-[450px] bg-white p-[30px] dark:bg-night-card">
      <h1 className="text-[22px] font-semibold capitalize text-ink dark:text-white">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-[5px] text-sm text-ink-muted dark:text-night-muted">{subtitle}</p>
      )}

      <div className="mt-[25px]">{children}</div>

      {footer && (
        <div className="mt-[30px] border-t border-surface-divider pt-4 text-center text-sm dark:border-night-border">
          {footer}
        </div>
      )}
    </div>
  );
}
