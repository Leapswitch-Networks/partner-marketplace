"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Badge from "./Badge";
import ColumnPicker, { useHiddenColumns } from "./ColumnPicker";
import ScrollToTop from "./ScrollToTop";
import Select from "./Select";

/**
 * Index-page DataTable, following LeapDesk's mandatory standard.
 *
 * What it guarantees, and why each matters:
 *
 *  1. **Only the rows scroll.** The container's `maxHeight` is measured from its
 *     own position on screen, so the page itself never scrolls and the filters,
 *     header and pagination stay put. Recalculated on resize.
 *  2. **Sticky table header** with an opaque background, so rows don't show
 *     through as they scroll under it.
 *  3. **Pagination top and bottom**, both outside the scroll area — on a long
 *     page you should never have to scroll to reach the pager.
 *  4. **Fixed column order** is the caller's job: `#`, `Actions`, `Status`, then
 *     data. `#` and `Actions` are as narrow as possible so data gets the room.
 *  5. `text-xs` base, `2xl:text-sm` on large screens. Cells must not override it.
 */

export interface Column<T> {
  id: string;
  header: ReactNode;
  /**
   * Renders one cell.
   *
   * `index` is the row's **absolute 0-based position in the whole result set**,
   * not its position within the page — so row 1 of page 2 at 25/page is `25`.
   * Both tables guarantee this; `VendorDataTable` rebases the vendor's
   * page-local index to match. Use `numberColumn()` rather than open-coding it.
   */
  cell: (row: T, index: number) => ReactNode;
  /** Column key the server sorts by. Omit to make the column unsortable. */
  sortKey?: string;
  className?: string;
  headerClassName?: string;
  /** false for `#`/Actions — hiding them would break the row shape. */
  hideable?: boolean;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;

  // pagination (server-driven)
  page: number;
  perPage: number;
  total: number;
  pages: number;
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: number) => void;

  // sorting (server-driven)
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  onSortChange?: (key: string, order: "asc" | "desc") => void;

  // selection
  selectable?: boolean;
  selected?: Set<string>;
  onSelectedChange?: (next: Set<string>) => void;
  bulkActions?: ReactNode;

  emptyTitle?: string;
  emptyHint?: ReactNode;
  /** Distinguishes "no data at all" from "filters hid everything". */
  filtersActive?: boolean;
  onResetFilters?: () => void;
  /** Singular noun for the selection count — "user", "role". Defaults to "record". */
  rowNoun?: string;
  /**
   * Controls sharing the column picker's row — in practice the `FilterBar`.
   * Takes the leading space; the `Cols` button stays hard right.
   */
  toolbar?: ReactNode;
  className?: string;
}

const PER_PAGE_OPTIONS = [10, 15, 25, 50, 100].map((n) => ({
  value: String(n),
  label: `${n} / page`,
}));

/** 60px reserves the bottom pagination strip. */
const BOTTOM_RESERVE = 60;

export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  error,
  onRetry,
  page,
  perPage,
  total,
  pages,
  onPageChange,
  onPerPageChange,
  sortBy,
  sortOrder = "desc",
  onSortChange,
  selectable,
  selected,
  onSelectedChange,
  bulkActions,
  emptyTitle = "Nothing here yet",
  emptyHint,
  filtersActive,
  onResetFilters,
  rowNoun = "record",
  toolbar,
  className = "",
}: DataTableProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [maxHeight, setMaxHeight] = useState<number | undefined>(undefined);
  const { hidden, toggle: toggleHidden } = useHiddenColumns();

  // Measure available height so ONLY this container scrolls.
  useEffect(() => {
    const measure = () => {
      const node = scrollRef.current;
      if (!node) return;
      const top = node.getBoundingClientRect().top;
      setMaxHeight(Math.max(160, window.innerHeight - top - BOTTOM_RESERVE));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [rows.length]);

  const visible = columns.filter((c) => !hidden.has(c.id));

  const handleSort = (column: Column<T>) => {
    if (!column.sortKey || !onSortChange) return;
    const nextOrder = sortBy === column.sortKey && sortOrder === "desc" ? "asc" : "desc";
    onSortChange(column.sortKey, nextOrder);
  };

  const pageKeys = rows.map(rowKey);
  const allOnPageSelected = pageKeys.length > 0 && pageKeys.every((k) => selected?.has(k));

  const toggleAllOnPage = useCallback(() => {
    if (!onSelectedChange) return;
    const next = new Set(selected);
    if (allOnPageSelected) pageKeys.forEach((k) => next.delete(k));
    else pageKeys.forEach((k) => next.add(k));
    onSelectedChange(next);
  }, [allOnPageSelected, onSelectedChange, pageKeys, selected]);

  const toggleOne = (key: string) => {
    if (!onSelectedChange) return;
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onSelectedChange(next);
  };

  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);

  const pager = (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 py-2">
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-gray-500 dark:text-gray-400">
          {total === 0 ? "No records" : `${from}–${to} of ${total}`}
        </span>
        {/* Reference wording: "3 of 137 user(s) selected". The denominator is
            the point — it says how much of the result set is still unpicked. */}
        {selectable && (selected?.size ?? 0) > 0 && (
          <Badge tone="brand">
            {selected?.size} of {total} {rowNoun}(s) selected
          </Badge>
        )}
        {bulkActions && (selected?.size ?? 0) > 0 && (
          <div className="flex items-center gap-1.5">{bulkActions}</div>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <Select
          aria-label="Rows per page"
          options={PER_PAGE_OPTIONS}
          value={String(perPage)}
          onChange={(e) => onPerPageChange(Number(e.target.value))}
          className="!h-8 !w-[104px]"
        />
        <PagerButton onClick={() => onPageChange(1)} disabled={page <= 1} label="First">
          «
        </PagerButton>
        <PagerButton onClick={() => onPageChange(page - 1)} disabled={page <= 1} label="Previous">
          ‹
        </PagerButton>
        {/* The current page sits between the arrows and carries the brand
            colour, matching the active page number in the vendor pager. */}
        <span className="px-1 text-[11px] font-bold tabular-nums text-brand dark:text-brand-on-dark">
          {pages === 0 ? 0 : page} / {pages}
        </span>
        <PagerButton
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pages}
          label="Next"
        >
          ›
        </PagerButton>
        <PagerButton onClick={() => onPageChange(pages)} disabled={page >= pages} label="Last">
          »
        </PagerButton>
      </div>
    </div>
  );

  return (
    <div className={`flex min-h-0 flex-col ${className}`}>
      {/*
        Filters and the column picker share one row.

        They were two stacked rows until 2026-08-10 — filters above, a lone `Cols`
        button right-aligned below it. Merging them is not only tidier: the table's
        scroll box is **viewport-measured**, so every row of chrome above it comes
        straight out of the number of records on screen. `useAutoPerPage()` divides
        by a 38px row, so one reclaimed ~40px row is roughly one more visible
        record at every window size.

        The filters arrive through `toolbar` rather than being rendered by
        `ResourceIndex` above the table, because the column picker's state lives in
        this component. Lifting `hidden` into `useResourceQuery` would be the
        alternative — worth doing when column visibility should persist in the URL
        like the other query state, and not before.
      */}
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 pb-2">
        {toolbar}
        <ColumnPicker columns={columns} hidden={hidden} onToggle={toggleHidden} />
      </div>

      {pager}

      <div
        ref={scrollRef}
        style={{ maxHeight }}
        className="min-h-0 flex-1 overflow-auto rounded-[5px] border border-brand/20 scrollbar-thin dark:border-night-border"
      >
        <table className="w-full border-collapse text-left text-xs 2xl:text-sm">
          {/*
            The fill lives on the `<th>` cells, not on `<thead>`, and it is opaque.
            Both halves of that matter and both were wrong:

            * It was `bg-brand/10` — **translucent**. `UI_PATTERNS.md` § Full-Page
              Index Layout mandates "sticky thead (top-0 z-10, **opaque bg**)", and
              without it rows scroll visibly *through* the header, which reads as a
              rendering fault rather than a style choice.
            * A background painted on `<thead>` is unreliable under `position:
              sticky` — several engines do not paint a table section's own
              background for a stuck row. Putting it on the cells is the portable
              fix and is why the class moved down here.

            ⚠️ The shade is approximate, and deliberately so. Over the green card
            (`surface-wash`) the old translucent fill composited to ≈`#d6e2e0`, and
            **no token holds that value** — the nearest are `surface-tile` (brand@8%
            over white) and `surface-border`. Minting the exact one means editing
            `tailwind.config.ts`, which is a Protected File. `surface-tile` keeps the
            header brand-tinted and opaque using only existing tokens; the hairline
            below carries the separation, which is what this design does everywhere
            else. Same shape as the `surface-border` retint already waiting on the
            owner in PLANNING.md § 3.1.
          */}
          <thead className="sticky top-0 z-10">
            <tr>
              {selectable && (
                <th className="w-8 border-b border-brand/20 bg-brand px-3 py-2.5 dark:border-night-border">
                  <input
                    type="checkbox"
                    aria-label="Select all on this page"
                    checked={allOnPageSelected}
                    onChange={toggleAllOnPage}
                    className="h-3.5 w-3.5 accent-brand"
                  />
                </th>
              )}
              {visible.map((c) => {
                const active = c.sortKey && sortBy === c.sortKey;
                return (
                  <th
                    key={c.id}
                    className={`whitespace-nowrap border-b border-brand/20 bg-brand px-3 py-2.5 font-bold text-white dark:border-night-border ${
                      c.headerClassName ?? ""
                    }`}
                  >
                    {c.sortKey ? (
                      <button
                        type="button"
                        onClick={() => handleSort(c)}
                        className="inline-flex items-center gap-1 hover:text-white/80"
                      >
                        {c.header}
                        <span className="text-[9px] text-white/60">
                          {active ? (sortOrder === "desc" ? "▼" : "▲") : "↕"}
                        </span>
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {loading &&
              Array.from({ length: Math.min(perPage, 8) }).map((_, i) => (
                <tr key={`sk-${i}`} className="border-t border-brand/20 dark:border-night-border">
                  {/* Same padding as a real row — a skeleton that is shorter than
                      what replaces it makes the table jump on every fetch. */}
                  {selectable && <td className="px-3 py-2" />}
                  {visible.map((c) => (
                    <td key={c.id} className="px-3 py-2">
                      <span className="block h-3 w-full max-w-[160px] animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                    </td>
                  ))}
                </tr>
              ))}

            {!loading &&
              rows.map((row, index) => {
                const key = rowKey(row);
                /*
                  Two fixes on the row below, matching the vendor table so the
                  four index pages agree:

                  * The stripe was `bg-gray-50/50` — a **grey** over the green
                    `surface-wash` card, which `UI_PATTERNS.md` § The Signed-In
                    Chrome Is Green rules out. `bg-muted` is #eff3f2, the brand
                    teal at 8%, so the alternate row is a lighter green than the
                    one above rather than a grey smudge across it.
                  * `hover:bg-brand/10/40` is not a class. Tailwind takes one
                    opacity modifier; a second makes the whole token unparseable,
                    so it emitted nothing and rows had no hover at all in light
                    mode. Only the dark variant was ever working.
                */
                return (
                  <tr
                    key={key}
                    className={`border-t border-brand/20 transition-colors hover:bg-brand/10 dark:border-night-border dark:hover:bg-brand/20 ${
                      index % 2 === 0 ? "" : "bg-muted"
                    }`}
                  >
                    {selectable && (
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          aria-label="Select row"
                          checked={selected?.has(key) ?? false}
                          onChange={() => toggleOne(key)}
                          className="h-3.5 w-3.5 accent-brand"
                        />
                      </td>
                    )}
                    {visible.map((c) => (
                      <td
                        key={c.id}
                        className={`px-3 py-2 text-gray-700 dark:text-gray-300 ${c.className ?? ""}`}
                      >
                        {c.cell(row, (page - 1) * perPage + index)}
                      </td>
                    ))}
                  </tr>
                );
              })}
          </tbody>
        </table>

        {!loading && !error && rows.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
            {/* Good news reads as good news; a filtered-out list says so and offers a way back. */}
            {filtersActive ? (
              <>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  No matches for these filters
                </p>
                {onResetFilters && (
                  <button
                    type="button"
                    onClick={onResetFilters}
                    className="text-xs font-semibold text-brand dark:text-brand-on-dark hover:underline"
                  >
                    Clear filters
                  </button>
                )}
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {emptyTitle}
                </p>
                {emptyHint && (
                  <p className="text-xs text-gray-400 dark:text-gray-500">{emptyHint}</p>
                )}
              </>
            )}
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
            <p className="text-sm font-semibold text-tone-danger dark:text-tone-danger">{error}</p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="text-xs font-semibold text-brand dark:text-brand-on-dark hover:underline"
              >
                Try again
              </button>
            )}
          </div>
        )}
      </div>

      {pager}

      {/* Scrolls the box above, not the window — see `ScrollToTop`. Mounted here
          rather than per module so every index page gets it from one place, the
          same argument `ResourceIndex` itself is built on. */}
      <ScrollToTop scrollRef={scrollRef} />
    </div>
  );
}

function PagerButton({
  children,
  onClick,
  disabled,
  label,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-7 w-7 items-center justify-center rounded-[5px] bg-brand/10 text-xs font-semibold text-brand transition-colors hover:bg-brand hover:text-white disabled:cursor-not-allowed disabled:opacity-40 dark:bg-brand/20 dark:text-brand-on-dark dark:hover:bg-brand dark:hover:text-white"
    >
      {children}
    </button>
  );
}
