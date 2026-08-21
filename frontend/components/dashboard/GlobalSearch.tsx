"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

import { navIcon } from "@/components/dashboard/navIcons";
import {
  MIN_SEARCH_LENGTH,
  type SearchGroup,
  type SearchHit,
} from "@/lib/api/searchApi";
import { useSearchQuery } from "@/lib/api/endpoints/searchEntitiesEndpoints";
import useDebouncedValue from "@/lib/hooks/useDebouncedValue";

/**
 * The global search box — a debounced input with a portalled results popover.
 *
 * **Not a table, so not the module contract.** `UI_PATTERNS.md` § "Parity means
 * the same vocabulary, not the same feature list" governs: this is chrome, and
 * `ResourceIndex` would be wrong for it. What it does follow is the house
 * popover pattern from `FilterCombobox` — measure the trigger, portal the panel,
 * close on scroll/resize/outside-click, and drive a roving `active` index from
 * the keyboard. That file is the reference for every decision below; this one
 * cannot reuse it directly because a combobox picks from a fixed option list and
 * this fetches grouped results per keystroke.
 *
 * ## Three things that are easy to get wrong here
 *
 * 1. **A stale response must not overwrite a newer one.** Requests are fired per
 *    keystroke and can land out of order, so each carries a sequence number and
 *    anything but the latest is discarded. Without it, typing "ali" then "alice"
 *    can leave you looking at the results for "ali".
 * 2. **Under two characters, do not call the API at all.** The server returns
 *    nothing below that floor, so a request would be a guaranteed-empty round
 *    trip on the first letter of every search.
 * 3. **The results are a flat keyboard list across groups.** Users think in one
 *    list; the grouping is visual. `flatItems` is that list, and the arrow keys
 *    walk it straight through a group boundary.
 */
export default function GlobalSearch({
  placeholder = "Search…",
}: {
  placeholder?: string;
}) {
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  /**
   * The last settled response **and the query it answered**, as one value.
   *
   * Storing the query alongside the groups is what lets `loading` be *derived*
   * rather than another piece of state — and deriving it is not a style
   * preference: clearing state synchronously inside the effect is the
   * `react-hooks/set-state-in-effect` violation this shape avoids, and the two
   * booleans it replaces could disagree with each other while a request was in
   * flight.
   */
  /**
   * The roving highlight, stored **with the term it belongs to**.
   *
   * It has to return to the first row whenever the results change, and the
   * obvious way — `setActive(0)` in an effect on `term` — is what
   * `react-hooks/set-state-in-effect` refuses. Pairing the index with its term
   * and deriving instead means a new search reads as row 0 without anything
   * having to reset it.
   */
  const [cursorState, setCursorState] = useState({ term: "", index: 0 });
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const debounced = useDebouncedValue(query, 300);
  const tooShort = debounced.trim().length < MIN_SEARCH_LENGTH;

  const term = debounced.trim();

  const active = cursorState.term === term ? cursorState.index : 0;
  const setActive = (next: number | ((current: number) => number)) =>
    setCursorState({
      term,
      index: typeof next === "function" ? next(active) : next,
    });

  /**
   * ## The cache key does what the sequence counter used to
   *
   * Converted 2026-08-21. This component kept a `seq` ref and discarded any
   * response that was not from the newest keystroke, because a slow request for
   * "ab" can land after a fast one for "abcd" and overwrite the better answer.
   *
   * Keying the query on the term makes that structural rather than defended: the
   * hook only ever returns data for the argument it was last called with, so a
   * late response for an older term cannot be rendered. Backspacing to a term
   * already typed is now instant instead of a fresh round trip.
   *
   * `skip` below the floor rather than a guard inside an effect — no request is
   * made at all, which is what the old early-return was approximating.
   */
  const { data, isFetching } = useSearchQuery({ q: term }, { skip: tooShort });

  /**
   * Memoised because a bare `?? []` produces a fresh array on every render,
   * which would make `flatItems` below recompute forever.
   */
  const groups = useMemo<SearchGroup[]>(
    () => (tooShort ? [] : (data?.groups ?? [])),
    [tooShort, data]
  );

  /**
   * Below the floor nothing was searched, so naming areas as "not searched"
   * would be false.
   */
  const hiddenAreas = useMemo<string[]>(
    () => (tooShort ? [] : (data?.hidden_areas ?? [])),
    [tooShort, data]
  );

  // `isFetching`, so the spinner shows while a *new* term is in flight even
  // though a previous term's results are still on screen — which is exactly the
  // window the old `result.q !== term` comparison was detecting.
  const loading = !tooShort && isFetching;


  // Position, and close on anything that invalidates the measurement. Same rule
  // as `FilterCombobox`: a scroll would otherwise leave the panel drifting.
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const measure = () => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (rect) setCoords({ top: rect.bottom + 4, left: rect.left, width: rect.width });
  };

  /** One flat list across every group — see note 3. */
  const flatItems = useMemo(
    () => groups.flatMap((g) => g.items.map((item) => ({ item, group: g }))),
    [groups]
  );

  const go = (hit: SearchHit) => {
    setOpen(false);
    setQuery("");
    // Clearing the query is enough: the term falls below the floor, `skip` turns
    // the query off and `groups` derives to `[]`, so the next open cannot flash
    // the previous search's hits. That is what the explicit reset used to do.
    router.push(hit.url);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      setActive((i) => Math.min(i + 1, Math.max(flatItems.length - 1, 0)));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const hit = flatItems[active];
      if (hit) go(hit.item);
    }
  };

  const showPanel = open && (tooShort || loading || flatItems.length > 0 || debounced.trim() !== "");

  // A running index across groups, so the flat keyboard list and the rendered
  // rows agree about which one is active. Computed during render rather than
  // stored: two sources for one number is how they drift.
  let cursor = -1;

  return (
    <div ref={wrapRef} className="relative w-full max-w-md">
      <div className="flex items-stretch overflow-hidden rounded-[5px] border border-surface-border bg-white transition-colors focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20 dark:border-night-border dark:bg-night-card">
        <span
          aria-hidden="true"
          className="flex shrink-0 items-center pl-3 text-ink-muted dark:text-night-muted"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
          </svg>
        </span>
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listboxId}
          aria-haspopup="listbox"
          aria-label="Search"
          autoComplete="off"
          value={query}
          placeholder={placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) {
              measure();
              setOpen(true);
            }
          }}
          onFocus={() => {
            measure();
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          className="w-full min-w-0 border-0 bg-transparent py-2 pl-2 pr-3.5 text-sm text-ink outline-none placeholder:text-ink-muted focus:ring-0 dark:text-white dark:placeholder:text-night-muted"
        />
      </div>

      {showPanel &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            {/*
              Outside-click. A real button so it is not a click target that
              screen readers announce as content — the same shape
              `FilterCombobox` uses.
            */}
            <button
              type="button"
              aria-label="Close search results"
              className="fixed inset-0 z-40 cursor-default"
              onClick={() => setOpen(false)}
            />
            <div
              id={listboxId}
              role="listbox"
              aria-label="Search results"
              style={{ top: coords.top, left: coords.left, width: Math.max(coords.width, 320) }}
              className="fixed z-50 max-h-[70vh] overflow-auto rounded-[5px] border border-surface-border bg-white py-1 dark:border-night-border dark:bg-night-card"
            >
              {tooShort ? (
                <p className="px-3 py-3 text-sm text-ink-label dark:text-night-muted">
                  Type at least {MIN_SEARCH_LENGTH} characters.
                </p>
              ) : loading && flatItems.length === 0 ? (
                <p className="px-3 py-3 text-sm text-ink-label dark:text-night-muted">
                  Searching…
                </p>
              ) : flatItems.length === 0 ? (
                <p className="px-3 py-3 text-sm text-ink-label dark:text-night-muted">
                  {/*
                    "Nothing you can see" rather than "nothing exists": results
                    are permission-gated and row-scoped, so an empty result is
                    genuinely not proof the record is absent.
                  */}
                  No results you have access to.
                </p>
              ) : (
                groups.map((group) => (
                  <div key={`${group.group}-${group.label}`}>
                    <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-ink-label dark:text-night-muted">
                      {group.label}
                    </p>
                    {group.items.map((item) => {
                      cursor += 1;
                      const isActive = cursor === active;
                      const index = cursor;
                      return (
                        <button
                          key={`${group.label}-${item.id}`}
                          type="button"
                          role="option"
                          aria-selected={isActive}
                          onMouseEnter={() => setActive(index)}
                          onClick={() => go(item)}
                          className={`flex w-full items-center gap-2 px-3 py-2 text-left transition-colors ${
                            isActive
                              ? "bg-brand/10 text-brand dark:bg-brand/20"
                              : "text-ink hover:bg-brand/10 hover:text-brand dark:text-gray-100 dark:hover:bg-brand/20"
                          }`}
                        >
                          {item.icon && (
                            <span aria-hidden className="shrink-0 text-ink-label dark:text-night-muted">
                              {navIcon(item.icon)}
                            </span>
                          )}
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">
                              {item.title}
                            </span>
                            {item.subtitle && (
                              <span className="block truncate text-xs text-ink-label dark:text-night-muted">
                                {item.subtitle}
                              </span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ))
              )}

              {/*
                **Outside the empty/loading branch on purpose.** A withheld area
                misleads just as badly when something *did* match: five partners
                and a silently skipped Quotes reads as a complete answer. It
                renders whenever anything was withheld, results or not.
              */}
              {hiddenAreas.length > 0 && !tooShort && (
                <p
                  className="border-t border-surface-border px-3 py-2 text-xs text-ink-label dark:border-night-border dark:text-night-muted"
                  role="note"
                >
                  {hiddenAreas.join(", ")}{" "}
                  {hiddenAreas.length === 1 ? "was" : "were"} not searched — you
                  do not have access.
                </p>
              )}
            </div>
          </>,
          document.body
        )}
    </div>
  );
}
