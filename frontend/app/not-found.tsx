import Link from "next/link";

/**
 * 404 page (TECH_DEBT PM-19).
 *
 * A server component — it holds no state and needs no interactivity, so there is
 * no reason to ship it to the client. `next/link` rather than `window.location`
 * for the same reason: it navigates without a full document reload.
 *
 * Both destinations are offered because an unauthenticated visitor hitting a bad
 * URL would otherwise be sent to `/dashboard` and bounced straight back to
 * `/sign-in` by `middleware.ts` — two redirects to reach a page they could have
 * been given directly.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-20 text-center">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-none bg-brand/10 dark:bg-brand/20">
        <svg
          className="h-7 w-7 text-brand dark:text-brand-on-dark"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </span>

      <p className="font-mono text-xs font-semibold uppercase tracking-widest text-brand dark:text-brand-on-dark">
        404
      </p>
      <h1 className="mt-1 text-base font-bold text-gray-900 dark:text-gray-100">Page not found</h1>
      <p className="mt-1 max-w-md text-sm text-gray-500 dark:text-gray-400">
        That address does not exist. It may have been renamed, or the link that brought you here may
        be out of date.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center gap-2 rounded-[5px] bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2"
        >
          Go to dashboard
        </Link>
        <Link
          href="/sign-in"
          className="inline-flex items-center justify-center gap-2 rounded-[5px] border border-brand px-5 py-2.5 text-sm font-semibold text-brand dark:text-brand-on-dark transition-colors hover:bg-brand/10 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 dark:hover:bg-brand/20"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
