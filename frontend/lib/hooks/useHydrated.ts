"use client";

import { useSyncExternalStore } from "react";

/** Nothing ever changes, so the subscription is a no-op that never fires. */
const subscribe = () => () => {};

/**
 * True once the client has hydrated, false on the server and on the first render.
 *
 * Three components needed this to guard `createPortal`: a portal targets
 * `document.body`, which does not exist during SSR, and rendering one before
 * hydration produces a markup mismatch. All three did it the same way —
 * `const [mounted, setMounted] = useState(false); useEffect(() => setMounted(true), [])`
 * — which works and is what `react-hooks/set-state-in-effect` exists to stop:
 * a synchronous setState in an effect body schedules a second render pass for
 * something React can answer without one.
 *
 * `useSyncExternalStore` answers it directly. Its server snapshot is `false` and
 * its client snapshot is `true`, so the value is correct in the render it is
 * read in, with no effect and no extra pass.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}

export default useHydrated;
