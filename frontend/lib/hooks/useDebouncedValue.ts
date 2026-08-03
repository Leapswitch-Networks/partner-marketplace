"use client";

import { useEffect, useState } from "react";

/**
 * Debounced mirror of a value. 500ms matches LeapDesk's search-input standard.
 *
 * Used so typing in a search box doesn't fire a request per keystroke. Keep the
 * input bound to the raw state and the query bound to this.
 */
export function useDebouncedValue<T>(value: T, delay = 500): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

export default useDebouncedValue;
