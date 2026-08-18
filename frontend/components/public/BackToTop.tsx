"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

/**
 * "Back to top" — the floating control in the bottom-right corner.
 *
 * ## Why this is a second component rather than reusing the app's
 *
 * `components/common/ScrollToTop.tsx` exists and is good, but it solves a
 * different problem: on an index page **the window never scrolls** — the table's
 * own box is the scroll container — so it takes a `scrollRef` and treats
 * `window` as the fallback. The public pages are laid out the ordinary way and
 * always scroll the document, so that indirection would be dead weight here.
 * It also wears the signed-in green chrome, and `FRONTEND_PLAN.md` § 2 settles
 * that this surface shares no components with that one.
 *
 * ## Three behaviours worth keeping
 *
 * 1. **Hidden until it has something to undo.** A permanently visible up-arrow
 *    on an unscrolled page is clutter. It appears past `threshold`.
 * 2. **It respects `prefers-reduced-motion`** — `scrollTo` uses `smooth` only
 *    when the visitor has not asked for less motion. A forced smooth scroll of
 *    several thousand pixels is genuinely unpleasant for some people, and the
 *    CSS reduced-motion block in `public.css` cannot reach a JS scroll option.
 * 3. **It sits clear of the enquiry form's submit button.** The 2026-08-13
 *    responsive audit found the app's assistant FAB sitting exactly on "next
 *    page"; the same mistake here would put this on top of "Send enquiry" on a
 *    phone. `bottom-5 right-4` plus the form's own bottom padding keeps them
 *    apart — check this again if either moves.
 */
export default function BackToTop({ threshold = 400 }: { threshold?: number }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > threshold);
    // Read once on mount: a visitor arriving on a #hash link is already scrolled,
    // and waiting for an event would leave the button missing on exactly the
    // screen that needs it.
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  const toTop = () => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  };

  return (
    <button
      type="button"
      onClick={toTop}
      aria-label="Back to top"
      // `inert`-like: removed from the tab order while hidden, so a keyboard user
      // does not tab into an invisible control at the top of a page.
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
      className={[
        "pub-focus pub-lilac-bg pub-ink fixed bottom-5 right-4 z-40 flex h-12 w-12 items-center justify-center",
        "rounded-full border-2 border-[color:var(--public-ink)] shadow-[0_2px_0_0_var(--public-ink)]",
        "transition-all duration-300 ease-out sm:bottom-8 sm:right-8 sm:h-14 sm:w-14",
        "hover:scale-[.94] hover:shadow-none active:translate-y-0.5",
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0",
      ].join(" ")}
    >
      <ArrowUp aria-hidden className="h-5 w-5 sm:h-6 sm:w-6" />
    </button>
  );
}
