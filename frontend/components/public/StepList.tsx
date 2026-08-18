import { cn } from "@/lib/utils/cn";

/**
 * A numbered sequence — how it works, how to apply, what verification involves.
 *
 * Three pages needed the same shape, which is the moment it becomes a component
 * rather than three near-identical grids that drift apart. The numeral is the
 * display face at a size that carries the block, so the eye lands on the
 * sequence before the prose.
 *
 * `ground` exists because the same list appears on cream and on the dark slabs,
 * and the muted-text colour has to change with it — cream's muted grey is
 * invisible on ink. Pairing them by hand at each call site is how one section
 * ends up unreadable.
 */
export default function StepList({
  steps,
  ground = "cream",
  className,
}: {
  steps: ReadonlyArray<{ step: string; title: string; body: string }>;
  ground?: "cream" | "dark";
  className?: string;
}) {
  const dark = ground === "dark";

  return (
    <ol
      className={cn(
        "grid grid-cols-1 gap-10 sm:gap-8",
        steps.length >= 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3",
        className,
      )}
    >
      {steps.map(({ step, title, body }) => (
        <li
          key={step}
          className={cn(
            "border-t-2 pt-6",
            dark ? "border-[color:var(--public-cream-30)]" : "border-[color:var(--public-ink)]",
          )}
        >
          <span
            className={cn(
              "pub-display block text-5xl leading-none tracking-[-0.03em]",
              dark ? "text-[color:var(--public-amber)]" : "pub-deep",
            )}
          >
            {step}
          </span>
          <h3 className="mt-4 text-xl font-semibold leading-snug">{title}</h3>
          <p
            className={cn(
              "mt-2.5 text-sm leading-relaxed",
              dark ? "text-[color:var(--public-cream-70)]" : "pub-muted",
            )}
          >
            {body}
          </p>
        </li>
      ))}
    </ol>
  );
}
