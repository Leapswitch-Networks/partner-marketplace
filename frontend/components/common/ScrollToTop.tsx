"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

/**
 * "Back to top" — the floating control in the bottom-right corner.
 *
 * **It does not scroll the window.** On an index page the window never scrolls:
 * `UI_PATTERNS.md` § Full-Page Index Layout locks the viewport and the table's own
 * box is the scroll container (`DataTable` measures it from
 * `getBoundingClientRect().top`). A `window.scrollTo(0, 0)` here would be a button
 * that visibly does nothing — so the caller hands over the element that actually
 * scrolls, and `window` is only the fallback for pages laid out the ordinary way.
 *
 * **It sits above the assistant, not on it.** `AssistantWidget` owns
 * `bottom-4 right-4` at `z-40`, and the index pager already pads around it (the
 * 2026-08-13 responsive audit found that button sitting exactly on "next page").
 * This one takes the slot above at `z-30`, so when the assistant *panel* opens —
 * also `bottom-20 right-4`, also `z-40` — the panel covers this rather than
 * fighting it. Reading the assistant and scrolling the table are not the same
 * moment.
 *
 * **Hidden until it has something to undo.** It appears past `threshold` and
 * animates in; a permanently visible up-arrow on an unscrolled page is one more
 * thing in a corner that already has something in it.
 */
export default function ScrollToTop({
  scrollRef,
  threshold = 240,
  label = "Back to top",
}: {
  /**
   * The element that scrolls. Omit only when the page scrolls the document —
   * every `ResourceIndex` page passes its table's container.
   */
  scrollRef?: RefObject<HTMLElement | null>;
  /** How far down before the button appears, in px. */
  threshold?: number;
  label?: string;
}) {
  const [visible, setVisible] = useState(false);
  // Held so the scroll listener and the click handler cannot disagree about which
  // element they are talking about across a re-render.
  const targetRef = useRef<HTMLElement | Window | null>(null);

  useEffect(() => {
    const target: HTMLElement | Window = scrollRef?.current ?? window;
    targetRef.current = target;

    const readTop = () =>
      target === window ? window.scrollY : (target as HTMLElement).scrollTop;

    const onScroll = () => setVisible(readTop() > threshold);

    // Read once on mount: the container may already be scrolled when this mounts
    // after a filter change or a page change, and waiting for an event would
    // leave the button missing on exactly the screen that needs it.
    onScroll();
    target.addEventListener("scroll", onScroll, { passive: true });
    return () => target.removeEventListener("scroll", onScroll);
  }, [scrollRef, threshold]);

  const handleClick = useCallback(() => {
    const target = targetRef.current;
    if (!target) return;
    // `scrollTo` with behavior is on both Element and Window, so one call covers
    // the container case and the document case.
    target.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={label}
      title={label}
      // `aria-hidden` + `tabIndex` while invisible: the button stays mounted so it
      // can transition, and a 0-opacity control that still takes a tab stop is a
      // focus trap for anyone not using a mouse.
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      className={`fixed bottom-20 right-4 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-brand/20 bg-white text-brand shadow-lg transition-all duration-200 hover:bg-brand hover:text-white focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 ring-offset-surface-wash dark:border-night-border dark:bg-night-card dark:text-brand-on-dark dark:ring-offset-night-card dark:hover:bg-brand dark:hover:text-white ${
        visible ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
      }`}
    >
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
      </svg>
    </button>
  );
}
