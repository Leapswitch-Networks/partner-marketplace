import type { ReactNode } from "react";

/**
 * Frame for the standalone auth pages reached from an emailed link.
 *
 * Shared so the four of them — verify email, reset password, forgot password,
 * accept invitation — cannot drift apart in width, padding or dark-mode treatment.
 * They are the first thing a new user sees, often before they have an account, so
 * four slightly different cards would be four slightly different first impressions.
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
    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 sm:p-8 dark:bg-gray-900 dark:ring-gray-800">
      <div className="mb-6">
        <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-[#F97316] text-base font-bold text-white">
          P
        </span>
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
        )}
      </div>

      {children}

      {footer && (
        <div className="mt-6 border-t border-gray-100 pt-4 text-center text-sm dark:border-gray-800">
          {footer}
        </div>
      )}
    </div>
  );
}
