"use client";

import { useState, type ReactNode } from "react";

export interface PickableColumn {
  id: string;
  header: ReactNode;
  /** false for `#`/Actions — hiding them would break the row shape. */
  hideable?: boolean;
}

/**
 * The `Cols` button and its checkbox popover.
 *
 * Extracted from `DataTable` on 2026-08-11 because the Users index had **no
 * column picker at all**. That page runs on `VendorDataTable`, which renders the
 * filter row itself and passes `hideColumnToggle` to suppress the vendor's own
 * dropdown — so the control existed in one table and nowhere near the other, and
 * the only visible symptom was a missing button after Reset.
 *
 * Copying the markup into the second table would have made that two things to
 * keep in step. This is one thing, used twice; the tables keep their own `hidden`
 * set, which is the only part that legitimately differs.
 *
 * Sizing is matched to the Reset button it sits beside — `h-9`, `px-3`,
 * `text-xs`, `text-ink-label`, `border-brand/20`. It was `h-7 px-2 text-[11px]`
 * before the two shared a row, which read as a stray control in a line of proper
 * ones.
 *
 * The hover is `brand/10` + `text-brand`, never a grey: `UI_PATTERNS.md` § The
 * Signed-In Chrome Is Green forbids it outright — *"never hover to a grey, it
 * reads as a smudge on green"*.
 */
export default function ColumnPicker({
  columns,
  hidden,
  onToggle,
}: {
  columns: PickableColumn[];
  hidden: Set<string>;
  onToggle: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const hideable = columns.filter((c) => c.hideable !== false);
  // Every column is structural — there is nothing to offer, and a button that
  // opens an empty menu reads as broken rather than as unavailable.
  if (hideable.length === 0) return null;

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex h-9 shrink-0 items-center gap-1 rounded-[5px] border border-brand/20 px-3 text-xs font-medium text-ink-label transition-colors hover:bg-brand/10 hover:text-brand dark:border-night-border dark:text-gray-400 dark:hover:bg-brand/20 dark:hover:text-brand-on-dark"
      >
        Cols
        <span className={`transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close column menu"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
          />
          {/* Keeps `surface-border`: this popover is one of the few surfaces
              still white, and #e6edef reads correctly there. The green surfaces
              moved to `border-brand/20` because #e6edef on `surface-wash` is
              1.02:1 — invisible. */}
          <div className="absolute right-0 top-full z-20 mt-1 w-48 overflow-hidden rounded-[5px] border border-surface-border bg-white py-1 shadow-lg dark:border-night-border dark:bg-night-card">
            {hideable.map((c) => (
              <label
                key={c.id}
                className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-brand/10 hover:text-brand dark:text-gray-300 dark:hover:bg-brand/20 dark:hover:text-brand-on-dark"
              >
                <input
                  type="checkbox"
                  checked={!hidden.has(c.id)}
                  onChange={() => onToggle(c.id)}
                  className="h-3.5 w-3.5 accent-brand"
                />
                <span className="truncate">
                  {typeof c.header === "string" ? c.header : c.id}
                </span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * The `hidden` set and its toggle, so both tables get the same semantics rather
 * than each writing the three lines their own way.
 */
export function useHiddenColumns() {
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return { hidden, toggle };
}
