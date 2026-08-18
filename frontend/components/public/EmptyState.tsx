import PublicButton from "./PublicButton";

/**
 * The empty state — a designed screen, not an accident.
 *
 * `FRONTEND_PLAN.md` § 1: **empty is the launch condition, not the edge case.**
 * The database holds zero partners today, so this is not defensive coding for an
 * unlikely branch — it is what the directory looked like this morning and may
 * look like again for any filter a visitor tries.
 *
 * § 20.4 sets the rule it implements: *"never a bare 0 results"*. Every empty
 * state offers a way out, because a dead end reads as broken software and a
 * visitor who concludes that does not come back to check whether it filled up.
 *
 * Illustration-free on purpose — a shrugging cartoon is the moment a directory
 * stops looking like a professional index (`ANTI_SLOP.md` § 1).
 */
export default function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="pub-border-thick flex flex-col items-start rounded-[1.5rem] p-8 sm:rounded-[2rem] sm:p-12">
      <h2 className="pub-display text-2xl leading-tight tracking-[-0.02em] sm:text-3xl">{title}</h2>
      <p className="pub-muted mt-3 max-w-lg text-[0.9375rem] leading-relaxed">{body}</p>
      {action && (
        <div className="mt-6">
          <PublicButton href={action.href} variant="primary" size="md">
            {action.label}
          </PublicButton>
        </div>
      )}
    </div>
  );
}
