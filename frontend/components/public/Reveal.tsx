"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A one-time entrance reveal.
 *
 * ## This is deliberately restrained, and the restraint is the point
 *
 * [`ANTI_SLOP.md`](../../../documentation/design/references/ANTI_SLOP.md) § 1
 * lists *"everything fades up 20px on scroll, staggered 100ms"* as one of ten
 * tells that a page was generated rather than designed — because motion reads as
 * "designed" without requiring a single decision. The owner asked for animation
 * to make the site feel fresher, which is a fair ask, so this exists; but it is
 * built to stay on the right side of that line:
 *
 * | Rule | Why |
 * |---|---|
 * | **8px, not 20px** | Enough to register, not enough to look like the content arrived late |
 * | **Once, never on scroll-back** | Re-animating on every pass is what makes a page feel restless |
 * | **No stagger by default** | Staggered children is the specific tell. `delay` exists for the rare case where sequence carries meaning |
 * | **Never on the hero** | The first thing a visitor reads must not fade in. It is also the LCP element, and animating it is measurable, not just tasteful |
 * | **Honours reduced motion** | Via CSS, not a branch here — see below |
 *
 * ## Why an observer rather than pure CSS
 *
 * Scroll-driven CSS animations (`animation-timeline: view()`) would do this with
 * no JavaScript, but support is still uneven and the failure mode is content
 * stuck invisible — the worst possible one. `IntersectionObserver` is a few
 * hundred bytes, universally supported, and **fails visible**: if anything goes
 * wrong the content is simply there, which is what it would have been anyway.
 *
 * ## Reduced motion is handled in CSS, deliberately
 *
 * There is no `prefers-reduced-motion` branch in this file. The block at the
 * end of `public.css` already collapses every transition on this surface to
 * 0.01ms, so for a visitor who has asked for less motion the element simply
 * appears when it comes into view — no travel, no fade, no special case here.
 *
 * The obvious alternative — checking the media query and setting state early —
 * is worse in two ways: it sets state directly inside an effect (which the
 * lint rules correctly reject), and it risks a hydration mismatch, because the
 * server cannot know the visitor's preference and would render the opposite
 * class. Letting CSS own it keeps one source of truth for motion on the whole
 * surface.
 *
 * Children are passed through untouched, so a server component wrapped in this
 * stays server-rendered — the client boundary is this wrapper alone.
 */
export default function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  /** Milliseconds. Use only where the order of arrival means something. */
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setShown(true);
        // Once. Disconnecting here is what stops it re-running on scroll-back
        // and is also why there is no cleanup cost per scroll event.
        io.disconnect();
      },
      // Fire a little before the element reaches the viewport, so it has
      // finished arriving by the time it is actually read.
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={`transition-[opacity,transform] duration-500 ease-out ${
        shown ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
      } ${className}`}
    >
      {children}
    </div>
  );
}
