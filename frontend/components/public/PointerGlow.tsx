"use client";

import { useEffect, useRef } from "react";

/**
 * A soft glow that trails the pointer.
 *
 * ## What it is, and the four rules that keep it from being a gimmick
 *
 * A cursor follower is the easiest effect in web design to get wrong: it is
 * decoration by definition, it costs a `pointermove` listener on every page, and
 * a badly-built one janks the moment anything else is happening. Built to these
 * constraints it earns its place; drop any one of them and it should come out.
 *
 * **1. Pointer devices only.** Guarded by `(pointer: fine)`. On a phone there is
 * no cursor to trail, so the whole thing — element, listener and animation frame
 * — never exists. This is not a CSS `display: none`; nothing is created at all.
 *
 * **2. Reduced motion means gone, not slower.** Somebody who has asked for less
 * motion is not asking for a gentler chase animation. The component returns
 * without mounting anything.
 *
 * **3. Transform only, and only inside an animation frame.** `pointermove` fires
 * far faster than the screen refreshes. Writing to the DOM on every event would
 * do the same work several times per painted frame; instead the handler only
 * records coordinates, and a single `requestAnimationFrame` loop moves the
 * element with `translate3d` — a compositor-only property that never triggers
 * layout or paint.
 *
 * **4. The loop stops when the pointer does.** A permanently-running `rAF` is a
 * background battery drain on a page nobody is interacting with. Once the glow
 * has caught up to within a pixel, the loop cancels itself and does not restart
 * until the next movement.
 *
 * ## Why it lags
 *
 * It interpolates toward the pointer at 12% per frame rather than tracking it
 * exactly. Something pinned precisely to the cursor reads as a second cursor and
 * is faintly unpleasant to look at; something that follows a moment later reads
 * as *response*, which is the intent. It is also why this sits behind everything
 * — it is ambient light in the page, not an object in it.
 *
 * ## Why it is not visible on the dark slabs
 *
 * **Paint order, primarily — not the blend mode.** This element is the first
 * child of the layout, so every later sibling paints over it: the ink and pine
 * slabs carry their own opaque backgrounds and simply cover it. The glow is only
 * ever seen against the cream page behind the content.
 *
 * `mix-blend-mode: multiply` then decides how it looks *there* — a soft darkening
 * of the cream rather than a lavender disc sitting on top of it. Both are doing
 * work; if the blend is ever removed the effect gets heavier on cream, and if the
 * element is ever moved later in the DOM it will start appearing over the dark
 * slabs, which is not what this is for.
 */
export default function PointerGlow() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Rule 1 and 2 — never mount on touch, never for reduced motion.
    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduced) return;

    const el = ref.current;
    if (!el) return;

    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let x = targetX;
    let y = targetY;
    let frame = 0;
    let running = false;

    const draw = () => {
      // Ease toward the pointer. 0.12 is the whole personality of the effect:
      // higher feels twitchy and pinned, lower feels like lag rather than grace.
      x += (targetX - x) * 0.12;
      y += (targetY - y) * 0.12;
      el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;

      // Rule 4 — stop once there is nothing left to do.
      if (Math.abs(targetX - x) < 1 && Math.abs(targetY - y) < 1) {
        running = false;
        return;
      }
      frame = requestAnimationFrame(draw);
    };

    const onMove = (e: PointerEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
      // First movement reveals it. Without this the glow sits in the middle of
      // the screen on load, before the visitor has touched anything.
      el.style.opacity = "1";
      if (!running) {
        running = true;
        frame = requestAnimationFrame(draw);
      }
    };

    // Hide when the pointer leaves the window entirely — a glow parked at the
    // edge of an unfocused tab is just a smudge.
    const onLeave = () => {
      el.style.opacity = "0";
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      // `pointer-events: none` is not optional — without it this swallows every
      // click on the page, and it is exactly the kind of bug that only shows up
      // once somebody tries to use the site rather than look at it.
      className="pub-pointer-glow pointer-events-none fixed left-0 top-0 z-0 opacity-0"
    />
  );
}
