"use client";

import { useEffect, useState } from "react";

/**
 * Rows per page, sized to the viewport.
 *
 * Ported from LeapDesk's mandatory index-page behaviour: a fixed page size wastes
 * most of a 32" monitor and forces constant scrolling on a 14" laptop. The
 * formula is `floor((viewportHeight - overhead) / rowHeight)`, clamped.
 *
 * A user's explicit per-page choice must override this — callers seed state from
 * it once rather than binding to it, so changing the dropdown sticks.
 */
const ROW_HEIGHT = 38;
const CHROME_OVERHEAD = 433; // header + filters + both paginations + page padding
const MIN_ROWS = 5;
const MAX_ROWS = 50;

export function calcAutoPerPage(viewportHeight: number): number {
  const rows = Math.floor((viewportHeight - CHROME_OVERHEAD) / ROW_HEIGHT);
  return Math.max(MIN_ROWS, Math.min(MAX_ROWS, rows));
}

export function useAutoPerPage(): number {
  // 15 on the server so the first paint matches a typical laptop rather than
  // rendering 5 rows and jumping.
  const [perPage, setPerPage] = useState(15);

  useEffect(() => {
    const update = () => setPerPage(calcAutoPerPage(window.innerHeight));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return perPage;
}

export default useAutoPerPage;
