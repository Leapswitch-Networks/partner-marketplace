"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import useDebouncedValue from "@/lib/hooks/useDebouncedValue";

/**
 * The query state every index page owns: filters, paging and sorting.
 *
 * Extracted from `UsersModule`, which had eleven `useState` calls and three
 * `useEffect`s to coordinate them, and would have been copy-pasted into each of
 * the remaining seven modules. The reference implementation we port from does
 * exactly that — its `pages/Users/Index.tsx` is 936 lines with the filter wiring
 * inline, and it ships no shared filter abstraction at all.
 *
 * Three coordination rules it enforces, each of which was a hand-written
 * `useEffect` before and each of which is a bug when forgotten:
 *
 *  1. **A filter change resets to page 1.** Otherwise filtering while on page 4
 *     shows an empty table, because the narrowed result set has no page 4.
 *  2. **A filter change clears the selection.** Otherwise a bulk action applies
 *     to rows the user can no longer see.
 *  3. **Text filters are debounced; the rest are not.** A dropdown should act
 *     immediately; a text input should not fire a request per keystroke.
 *
 * ## URL sync, and why it is written this way
 *
 * Filters live in the query string, so a filtered list is shareable and survives
 * a reload — matching the reference implementation, whose `withQueryString()`
 * puts them there too.
 *
 * It does **not** use `useSearchParams()`. That hook opts a route into dynamic
 * rendering and throws at build time unless every consumer sits inside a
 * `<Suspense>` boundary; `next build` currently prerenders `/dashboard/*` as
 * static, so adopting it would break the build or force a Suspense wrapper into
 * eight pages. `history.replaceState` has neither problem and is not a
 * navigation, so it adds no history entry per keystroke.
 *
 * The URL is read **once, in a mount effect**, not during render. Reading
 * `window.location` during render would produce different HTML on the server and
 * the client and fail hydration. The cost is that `ready` is false for one
 * render — callers must not fetch until it is true, or every page issues a
 * throwaway request with default filters before the real one.
 */

export type FilterValues = Record<string, string>;

export type SortOrder = "asc" | "desc";

export interface UseResourceQueryOptions<F extends FilterValues> {
  /** Initial filter values. Keys are fixed by this object; it defines the shape. */
  filters: F;
  /** Filter keys to debounce — text inputs. Dropdowns must not be listed. */
  debounced?: (keyof F)[];
  defaultSortBy: string;
  defaultSortOrder?: SortOrder;
  defaultPerPage?: number;
  /**
   * Query-string prefix, for a page hosting two independent tables. Omit
   * otherwise — an unprefixed URL reads better when shared.
   */
  urlKey?: string;
}

export interface ResourceQuery<F extends FilterValues> {
  /** Live values — bind inputs to these so typing feels immediate. */
  filters: F;
  /**
   * Debounced values — send THESE to the API. Identical to `filters` for keys
   * not listed in `debounced`.
   */
  applied: F;
  setFilter: (key: keyof F, value: string) => void;
  resetFilters: () => void;
  /** True when any filter differs from its initial value. */
  filtersActive: boolean;

  page: number;
  setPage: (page: number) => void;
  perPage: number;
  setPerPage: (perPage: number) => void;

  sortBy: string;
  sortOrder: SortOrder;
  setSort: (key: string, order: SortOrder) => void;

  selected: Set<string>;
  setSelected: (next: Set<string>) => void;

  /**
   * False until the query string has been applied. **Do not fetch while false**
   * — see the note above.
   */
  ready: boolean;
}

export default function useResourceQuery<F extends FilterValues>({
  filters: initialFilters,
  debounced = [],
  defaultSortBy,
  defaultSortOrder = "desc",
  defaultPerPage = 15,
  urlKey,
}: UseResourceQueryOptions<F>): ResourceQuery<F> {
  const prefix = urlKey ? `${urlKey}_` : "";

  // Captured once, via a lazy initial state rather than a ref. `initialFilters`
  // is an object literal at most call sites, so a new identity arrives every
  // render and depending on it directly would reset the filters on each one.
  //
  // A ref would also work but is the wrong tool: reading `ref.current` during
  // render is what `react-hooks/refs` forbids, and it is right to — a value that
  // renders should be state. `useState` with no setter is the idiomatic
  // "capture once" and is safe to read anywhere.
  const [defaults] = useState(initialFilters);
  const keys = useMemo(() => Object.keys(defaults) as (keyof F)[], [defaults]);

  const [filters, setFilters] = useState<F>(defaults);
  const [page, setPageState] = useState(1);
  const [perPage, setPerPageState] = useState(defaultPerPage);
  const [sortBy, setSortBy] = useState(defaultSortBy);
  const [sortOrder, setSortOrder] = useState<SortOrder>(defaultSortOrder);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);

  // --- read the query string once, after mount ------------------------------
  //
  // `react-hooks/set-state-in-effect` is disabled for this block, deliberately
  // and only here. The rule exists to stop cascading renders, and the usual fix
  // is to derive the value during render instead — which is exactly what cannot
  // be done with `window.location`: the server has no window, so the server and
  // client would render different HTML and hydration would fail.
  //
  // This runs once, on mount, and sets `ready` at the end so callers do not
  // fetch with the pre-URL state. The alternative that satisfies the rule is
  // `useSyncExternalStore` with a server snapshot, which is more machinery than
  // a one-time read of a query string justifies.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = { ...defaults };
    let touched = false;

    for (const key of keys) {
      const value = params.get(`${prefix}${String(key)}`);
      if (value !== null) {
        fromUrl[key] = value as F[keyof F];
        touched = true;
      }
    }
    if (touched) setFilters(fromUrl);

    const urlPage = Number(params.get(`${prefix}page`));
    if (Number.isFinite(urlPage) && urlPage > 0) setPageState(urlPage);

    const urlPerPage = Number(params.get(`${prefix}per_page`));
    if (Number.isFinite(urlPerPage) && urlPerPage > 0) setPerPageState(urlPerPage);

    const urlSortBy = params.get(`${prefix}sort_by`);
    if (urlSortBy) setSortBy(urlSortBy);

    const urlSortOrder = params.get(`${prefix}sort_order`);
    if (urlSortOrder === "asc" || urlSortOrder === "desc") setSortOrder(urlSortOrder);

    setReady(true);
    // Mount only: the query string is the *initial* state, not a live source.
    // Re-running on a `defaults`/`keys` change would fight the user's own edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // --- debounce the text filters -------------------------------------------
  //
  // One debounce over a serialised snapshot rather than one hook per key: the
  // number of filters differs per module, and hooks cannot be called in a loop.
  // Serialised to a plain string first: `react-hooks/use-memo` requires simple
  // expressions in a dependency list, and `debounced` is a new array identity on
  // every render at every call site.
  const debouncedKey = debounced.map(String).sort().join("|");
  const debouncedKeys = useMemo(
    () => new Set(debouncedKey ? debouncedKey.split("|") : []),
    [debouncedKey]
  );

  const debouncedSnapshot = useMemo(() => {
    const subset: Record<string, string> = {};
    for (const key of keys) {
      if (debouncedKeys.has(String(key))) subset[String(key)] = filters[key];
    }
    return JSON.stringify(subset);
  }, [filters, keys, debouncedKeys]);

  const settledSnapshot = useDebouncedValue(debouncedSnapshot, 500);

  /** What the API should receive: debounced keys settled, the rest immediate. */
  const applied = useMemo(() => {
    const settled = JSON.parse(settledSnapshot) as Record<string, string>;
    const merged = { ...filters };
    for (const key of Object.keys(settled)) {
      merged[key as keyof F] = settled[key] as F[keyof F];
    }
    return merged;
  }, [filters, settledSnapshot]);

  const filtersActive = useMemo(
    () => keys.some((key) => applied[key] !== defaults[key]),
    [applied, keys, defaults]
  );

  // --- write the query string ----------------------------------------------
  useEffect(() => {
    if (!ready) return;

    const params = new URLSearchParams(window.location.search);
    const set = (name: string, value: string, isDefault: boolean) => {
      // Defaults are omitted so a pristine list has a clean URL rather than
      // seven redundant parameters.
      if (isDefault) params.delete(`${prefix}${name}`);
      else params.set(`${prefix}${name}`, value);
    };

    for (const key of keys) {
      set(String(key), applied[key], applied[key] === defaults[key]);
    }
    set("page", String(page), page === 1);
    set("per_page", String(perPage), perPage === defaultPerPage);
    set("sort_by", sortBy, sortBy === defaultSortBy);
    set("sort_order", sortOrder, sortOrder === defaultSortOrder);

    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      query ? `${window.location.pathname}?${query}` : window.location.pathname
    );
  }, [
    ready,
    applied,
    keys,
    defaults,
    page,
    perPage,
    sortBy,
    sortOrder,
    prefix,
    defaultPerPage,
    defaultSortBy,
    defaultSortOrder,
  ]);

  // --- rule 1 and 2: a filter change resets paging and selection ------------
  //
  // Keyed on `applied`, not `filters`: resetting on every keystroke would fight
  // the debounce and clear the selection while the user is still typing.
  const firstApplied = useRef(true);
  useEffect(() => {
    if (firstApplied.current) {
      firstApplied.current = false;
      return;
    }
    setPageState(1);
    setSelected(new Set());
  }, [applied]);

  const setFilter = useCallback((key: keyof F, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(defaults);
  }, [defaults]);

  const setPage = useCallback((next: number) => {
    setPageState(next);
    // Selection is per page: carrying it across pages makes "select all" mean
    // something different from what the user sees.
    setSelected(new Set());
  }, []);

  const setPerPage = useCallback((next: number) => {
    setPerPageState(next);
    setPageState(1);
    setSelected(new Set());
  }, []);

  const setSort = useCallback((key: string, order: SortOrder) => {
    setSortBy(key);
    setSortOrder(order);
    setPageState(1);
  }, []);

  return {
    filters,
    applied,
    setFilter,
    resetFilters,
    filtersActive,
    page,
    setPage,
    perPage,
    setPerPage,
    sortBy,
    sortOrder,
    setSort,
    selected,
    setSelected,
    ready,
  };
}
