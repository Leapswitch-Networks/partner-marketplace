/**
 * The page heading, revealed line by line on load.
 *
 * ## A server component, and that is the entire design
 *
 * There is no `"use client"` here and there must not be. The animation is a CSS
 * keyframe declared in `public.css`; this file only emits the markup it needs —
 * a mask per line, and a stagger expressed as an inline `animation-delay`.
 *
 * The consequence is the point: **the animation starts at first paint**, before
 * React has hydrated anything. A JavaScript-driven version of this would show
 * the heading, wait for hydration, and then animate it — which is worse than not
 * animating it at all, and is exactly what a visitor on a slow connection would
 * get.
 *
 * ## Why the lines are author-supplied
 *
 * Splitting a heading into its *visual* lines means measuring it after layout,
 * which needs JavaScript, re-measuring on resize, and produces a different split
 * at every breakpoint. Passing an array instead means the author decides where
 * the break belongs — which they are doing anyway when they write a two-sentence
 * headline — and it costs nothing at runtime.
 *
 * A single string is accepted too, and animates as one line. That keeps the call
 * sites of the ordinary pages simple.
 *
 * ## Accessibility
 *
 * The lines are plain spans inside the heading, so it is read as one continuous
 * heading. Nothing is hidden from assistive technology at any point — the
 * transform moves painted text, it does not remove it.
 */
export default function HeadingReveal({
  text,
  className,
  /** Milliseconds between lines. Small — this is one heading, not a sequence. */
  stagger = 90,
}: {
  text: string | readonly string[];
  className?: string;
  stagger?: number;
}) {
  const lines = typeof text === "string" ? [text] : text;

  return (
    <>
      {lines.map((line, i) => (
        <span key={line} className={`pub-rise-mask ${className ?? ""}`}>
          <span
            className="pub-rise-line"
            style={i > 0 ? { animationDelay: `${i * stagger}ms` } : undefined}
          >
            {line}
          </span>
        </span>
      ))}
    </>
  );
}
