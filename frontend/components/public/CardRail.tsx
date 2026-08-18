"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * A horizontal card rail — the carousel, done with CSS scroll-snap.
 *
 * ## Why not a carousel library
 *
 * The public surface is L1: CSS only, under a 150 kB first-load budget
 * (`FRONTEND_PLAN.md` § 15.5). Every carousel library brings its own touch
 * handling, its own virtual scroller and its own accessibility opinions, and
 * replaces something the browser already does natively and better.
 *
 * **The rail itself is `overflow-x: auto` with `scroll-snap-type: x mandatory`.**
 * That gives real momentum scrolling on touch, real trackpad swiping, real
 * keyboard scrolling and real find-in-page — for nothing. This component adds
 * only what CSS cannot: knowing whether there is more to the left or right, so
 * the arrows can disable themselves and the edge fades can come and go.
 *
 * ## Why the arrows are not the only way to move
 *
 * A carousel where content is reachable *only* by clicking an arrow is a trap
 * for anyone not using a mouse. Here the arrows are an accelerator over a rail
 * that is already scrollable, focusable and readable in source order — so
 * hiding the arrows entirely would lose convenience, not access.
 *
 * ## What it deliberately does not do
 *
 * **No autoplay.** Content that moves on its own is the fastest way to make a
 * page feel like an advert, it steals focus mid-read, and it is a WCAG 2.2.2
 * problem the moment it runs longer than five seconds without a pause control.
 * **No dot pagination** either: dots are a fine affordance for five hero slides
 * and useless for a rail of cards whose count changes with the data.
 */
export default function CardRail({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  const railRef = useRef<HTMLUListElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const measure = useCallback(() => {
    const el = railRef.current;
    if (!el) return;
    // 2px of slack: sub-pixel layout means scrollLeft rarely hits the exact
    // maximum, and without it the right arrow never disables.
    setAtStart(el.scrollLeft <= 2);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    // Re-measure on resize as well as scroll: rotating a phone changes how many
    // cards fit, and a rail that fitted everything in landscape is scrollable in
    // portrait. Watching only `scroll` leaves the arrows wrong until you touch it.
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", measure);
      ro.disconnect();
    };
  }, [measure]);

  const nudge = (direction: 1 | -1) => {
    const el = railRef.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Scroll by roughly one card rather than a fixed pixel count, so the step
    // stays right from a 360px phone to a 2560px desktop.
    const step = el.firstElementChild?.clientWidth ?? el.clientWidth * 0.8;
    el.scrollBy({ left: direction * (step + 20), behavior: reduced ? "auto" : "smooth" });
  };

  return (
    <div className="relative">
      <div className="flex items-center justify-between gap-4">
        <p className="pub-muted text-xs sm:hidden">Swipe for more</p>
        {/* Arrows are decoration on touch, so they only appear where a pointer
            is likely. `sm:` rather than a hover media query because a hybrid
            laptop has both, and hiding them there would be worse. */}
        <div className="ml-auto hidden gap-2 sm:flex">
          {([-1, 1] as const).map((dir) => {
            const disabled = dir === -1 ? atStart : atEnd;
            const Icon = dir === -1 ? ChevronLeft : ChevronRight;
            return (
              <button
                key={dir}
                type="button"
                onClick={() => nudge(dir)}
                disabled={disabled}
                aria-label={dir === -1 ? `Scroll ${label} left` : `Scroll ${label} right`}
                className="pub-focus pub-bg pub-ink flex h-10 w-10 items-center justify-center rounded-full border-2 border-[color:var(--public-ink)] transition-all duration-200 hover:scale-[.94] disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:scale-100"
              >
                <Icon aria-hidden className="h-4 w-4" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Edge fades. Purely a cue that there is more — they sit above the rail
          and must not swallow clicks, hence `pointer-events-none`. */}
      <div className="relative mt-5">
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-[color:var(--public-bg)] to-transparent transition-opacity duration-300 ${atStart ? "opacity-0" : "opacity-100"}`}
        />
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-[color:var(--public-bg)] to-transparent transition-opacity duration-300 ${atEnd ? "opacity-0" : "opacity-100"}`}
        />
        <ul
          ref={railRef}
          aria-label={label}
          tabIndex={0}
          className="pub-focus pub-rail flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 sm:gap-5"
        >
          {children}
        </ul>
      </div>
    </div>
  );
}
