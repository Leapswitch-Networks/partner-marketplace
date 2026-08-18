"use client";

import PublicButton from "@/components/public/PublicButton";
import SectionSlab from "@/components/public/SectionSlab";

/**
 * Error boundary for the public surface.
 *
 * **Renders `error.digest`, never `error.message`** — § 20.4 and
 * `NEXTJS_STANDARDS.md` § 3. Next replaces server-side error messages with an
 * opaque digest on purpose: the message can carry a stack frame, a file path or
 * a query fragment, and this page is served to anonymous strangers. The digest
 * is what support needs and all they need.
 *
 * A client component because an error boundary has to be — it is the one
 * exception to this surface's server-first rule, and it is why it holds nothing
 * else.
 */
export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <SectionSlab className="pt-16 sm:pt-24">
      <div className="max-w-2xl">
        <h1 className="pub-display text-[2.5rem] leading-[0.95] tracking-[-0.035em] sm:text-6xl">
          Something went wrong at our end.
        </h1>
        <p className="pub-muted mt-6 text-base leading-relaxed">
          Not your fault, and nothing you did caused it. Try again — if it keeps happening, send us
          the reference below and we will find it in the logs.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <PublicButton onClick={reset} variant="primary" size="md">
            Try again
          </PublicButton>
          <PublicButton href="/" variant="secondary" size="md">
            Back to the home page
          </PublicButton>
        </div>

        {error.digest && (
          <p className="pub-muted mt-8 text-xs">
            Reference <code className="pub-bg-alt pub-ink rounded px-1.5 py-0.5">{error.digest}</code>
          </p>
        )}
      </div>
    </SectionSlab>
  );
}
