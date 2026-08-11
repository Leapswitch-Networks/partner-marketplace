"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

import { navIcon } from "@/components/dashboard/navIcons";
import {
  MIN_SEARCH_LENGTH,
  searchApi,
  type SearchGroup,
  type SearchHit,
} from "@/lib/api/searchApi";
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
  const [result, setResult] = useState<{ q: string; groups: SearchGroup[] }>({
    q: "",
    groups: [],
  });
  const [active, setActive] = useState(0);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  /** Rejects out-of-order responses — see note 1. */
  const seq = useRef(0);

  const debounced = useDebouncedValue(query, 300);
  const tooShort = debounced.trim().length < MIN_SEARCH_LENGTH;

  const term = debounced.trim();

  /**
   * Derived, not stored — see the note on `result`.
   *
   * Memoised because a bare `tooShort ? [] : result.groups` produces a fresh
   * `[]` on every render, which would make `flatItems` below recompute forever.
   */
  const groups = useMemo(
    () => (tooShort ? [] : result.groups),
    [tooShort, result.groups]
  );
  const loading = !tooShort && result.q !== term;

  useEffect(() => {
    // No `setState` in the effect body. Under the floor there is simply nothing
    // to do: `groups` already derives to `[]`, and bumping the sequence
    // discards any response still in flight from a longer query.
    if (tooShort) {
      seq.current += 1;
      return;
    }

    const mine = ++seq.current;

    searchApi
      .query(term)
      .then((res) => {
        if (mine !== seq.current) return; // a newer keystroke already won
        setResult({ q: term, groups: res.data.groups });
        setActive(0);
      })
      .catch(() => {
        if (mine !== seq.current) return;
        // A failed search shows "nothing found" rather than an error banner in
        // the chrome. The box is not the place to report an outage, and the
        // next keystroke retries anyway. Recording `q` is what stops `loading`
        // hanging true forever after a failure.
        setResult({ q: term, groups: [] });
      });
  }, [term, tooShort]);

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
    // Reset to the empty result rather than clearing a separate `groups` state,
    // so the next open does not flash the previous search's hits.
    setResult({ q: "", groups: [] });
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
            </div>
          </>,
          document.body
        )}
    </div>
  );
}
