"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils/cn";

export interface ComboboxOption {
  value: string;
  label: string;
}

/**
 * Searchable single-select for filter bars — the reference's `FilterCombobox`,
 * which its own docblock calls *"a Select2-like searchable dropdown"*.
 *
 * ## Why this exists rather than a `<select>`
 *
 * Our filters were native `<select>` elements. That is the right default — free
 * keyboard handling, free mobile pickers — and it is what `UI_PATTERNS.md`
 * recommends. It stops being right at the Role filter: a native select has **no
 * search**, so picking one of forty roles means scrolling a list you cannot
 * filter, and no way to see which option is selected other than the closed
 * label. The reference solved that and we did not, which is the actual UX gap.
 *
 * ## What is reproduced, and what is not
 *
 * Behaviour is the reference's, feature for feature: a search box that filters as
 * you type, a first row that clears back to "All …", a tick beside the current
 * value, an inline ✕ to clear without opening, an empty-results message, and the
 * popover matched to the trigger's width.
 *
 * The implementation is not. Theirs is Radix `Popover` + `cmdk` `Command`, and we
 * have neither — `UI_PATTERNS.md` § Tech Stack Reality Check: no shadcn/ui, no
 * Radix. So the popover, the filtering, the roving keyboard focus and the
 * outside-click handling are written here, and the styling is Viho's.
 *
 * ## Portalled, like `RowActions` and for the same reason
 *
 * `Card` is `overflow-hidden`, so a popover rendered in place is clipped at the
 * card's edge. It is rendered into `document.body` and positioned from the
 * trigger's rect. Any scroll closes it rather than letting it drift away from the
 * control it belongs to — the same trade-off `RowActions` already makes.
 */
export default function FilterCombobox({
  options,
  value,
  onChange,
  placeholder = "All",
  searchPlaceholder = "Search...",
  emptyText = "No results found.",
  label,
  disabled = false,
}: {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  /** Shown when nothing is chosen, and as the first "clear" row. */
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  /** Accessible name — these have no visible `<label>`. */
  label?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  // `aria-controls` needs a stable id that survives hydration; `useId` is the
  // supported way to get one. Without it `role="combobox"` is incomplete and a
  // screen reader cannot find the listbox this button owns.
  const listboxId = useId();

  // NOTE: no `mounted` guard before `createPortal`, unlike `Modal` and
  // `RowActions`. Those render on mount and genuinely need one. This popover
  // renders only while `open`, and `open` can only be set by a click — which
  // cannot happen on the server. The guard would be an effect that sets state
  // for no reason, which is the `set-state-in-effect` rule those two trip.

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    // A scroll invalidates the measured position, so close rather than drift.
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    // Matches the label *and* the value, mirroring the reference's `keywords`:
    // a role searched for by slug should still be findable.
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)
    );
  }, [options, query]);

  /** The clear row sits at index 0, so the option list is offset by one. */
  const rows: (ComboboxOption | null)[] = [null, ...filtered];

  const openMenu = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setCoords({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    setQuery("");
    setActive(0);
    setOpen(true);
    // The search box is the point of the control; focusing it on open is what
    // makes "click, type three letters, Enter" work.
    requestAnimationFrame(() => searchRef.current?.focus());
  };

  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, rows.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const row = rows[active];
      if (row !== undefined) pick(row === null ? "" : row.value);
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-haspopup="listbox"
        aria-label={label ?? placeholder}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-[5px] border border-surface-border bg-white px-3 text-xs transition-colors",
          "focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20",
          "disabled:cursor-not-allowed disabled:opacity-60",
          "dark:border-night-border dark:bg-night-card",
          selected ? "text-ink dark:text-white" : "text-ink-muted dark:text-night-muted"
        )}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>

        <span className="flex shrink-0 items-center gap-0.5">
          {/*
            Clearing without opening the menu. It is a `<span>` inside the
            button rather than a nested `<button>`, which is invalid HTML and
            what the reference does too — the mousedown guard stops the click
            reaching the trigger and toggling the popover open.
          */}
          {value && (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Clear filter"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onChange("");
              }}
              className="rounded-[3px] p-0.5 text-ink-muted opacity-60 transition-opacity hover:bg-brand/10 hover:opacity-100 dark:text-night-muted"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </span>
          )}
          <svg
            className="h-3.5 w-3.5 opacity-50"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4M16 15l-4 4-4-4" />
          </svg>
        </span>
      </button>

      {open &&
        createPortal(
          <>
            <button
              type="button"
              aria-label="Close filter menu"
              className="fixed inset-0 z-40 cursor-default"
              onClick={() => setOpen(false)}
            />
            {/* White, not `surface-wash`: § The Signed-In Chrome Is Green — there
                are no shadows in this design, so white-on-green is the only cue
                that something floats. */}
            <div
              id={listboxId}
              role="listbox"
              aria-label={label ?? placeholder}
              onKeyDown={onKeyDown}
              style={{ top: coords.top, left: coords.left, width: coords.width }}
              className="fixed z-50 overflow-hidden rounded-[5px] border border-surface-border bg-white shadow-lg dark:border-night-border dark:bg-night-card"
            >
              <div className="border-b border-surface-border p-1.5 dark:border-night-border">
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActive(0);
                  }}
                  onKeyDown={onKeyDown}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                  className="w-full rounded-[3px] bg-transparent px-2 py-1 text-xs text-ink outline-none placeholder:text-ink-muted dark:text-white dark:placeholder:text-night-muted"
                />
              </div>

              <div className="max-h-60 overflow-y-auto py-1 scrollbar-thin">
                {filtered.length === 0 && (
                  <p className="px-3 py-2 text-xs text-ink-muted dark:text-night-muted">{emptyText}</p>
                )}

                {rows.map((row, index) => {
                  // `null` is the clear row — "All Status" — which the reference
                  // renders first and ticks when nothing is selected.
                  if (row === null && filtered.length === 0) return null;
                  const isClear = row === null;
                  const rowValue = isClear ? "" : row.value;
                  const isSelected = value === rowValue;

                  return (
                    <button
                      key={isClear ? "__clear__" : row.value}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => pick(rowValue)}
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors",
                        index === active
                          ? "bg-brand/10 text-brand dark:bg-brand/20 dark:text-brand-on-dark"
                          : "text-ink dark:text-gray-300"
                      )}
                    >
                      <svg
                        className={cn("h-3.5 w-3.5 shrink-0", isSelected ? "opacity-100" : "opacity-0")}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                        aria-hidden="true"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="truncate">{isClear ? placeholder : row.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </>,
          document.body
        )}
    </>
  );
}
