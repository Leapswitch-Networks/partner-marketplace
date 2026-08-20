"use client";

import { headingClasses } from "@/components/common/PageHeading";
import Button from "@/components/common/Button";

/**
 * Shared body for every `error.tsx` boundary (TECH_DEBT PM-19).
 *
 * One component rather than four near-copies, so a change to how failures are
 * presented happens once. The boundaries themselves stay thin — each is only a
 * `"use client"` file exporting a default that Next can find.
 *
 * **The `error.digest` rule.** For an error thrown on the server, Next replaces
 * the message with an opaque `digest` before it reaches the browser, precisely so
 * internals do not leak. Showing the raw `message` is therefore only ever useful
 * for client-side errors, and only in development — in production it risks
 * putting an internal detail on screen for a user to screenshot. So: the digest
 * is always shown when present (it is what support asks for, and it correlates
 * with the backend's `X-Request-ID` log line), and the message only in dev.
 */
export default function ErrorState({
  error,
  reset,
  title = "Something went wrong",
  description = "This section failed to load. Retrying often works — the error has been recorded either way.",
  compact = false,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  description?: string;
  /** Sits inside the dashboard shell rather than filling the viewport. */
  compact?: boolean;
}) {
  const isDev = process.env.NODE_ENV === "development";

  return (
    <div
      className={`flex flex-col items-center justify-center px-6 text-center ${
        compact ? "py-16" : "min-h-[60vh] py-20"
      }`}
      role="alert"
    >
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
            d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z"
          />
        </svg>
      </span>

      <h2 className={`${headingClasses("section")} text-gray-900 dark:text-gray-100`}>{title}</h2>
      <p className="mt-1 max-w-md text-sm text-gray-500 dark:text-gray-400">{description}</p>

      {error.digest && (
        <p className="mt-3 font-mono text-[11px] text-gray-400 dark:text-gray-500">
          Reference: {error.digest}
        </p>
      )}

      {isDev && error.message && (
        <pre className="mt-4 max-w-xl overflow-x-auto rounded-[5px] bg-gray-50 p-3 text-left font-mono text-[11px] text-tone-danger dark:bg-night-card dark:text-tone-danger">
          {error.message}
        </pre>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" onClick={() => window.location.assign("/dashboard")}>
          Back to dashboard
        </Button>
      </div>
    </div>
  );
}
