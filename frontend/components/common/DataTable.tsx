"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Badge from "./Badge";
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
  className = "",
}: DataTableProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [maxHeight, setMaxHeight] = useState<number | undefined>(undefined);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [colsOpen, setColsOpen] = useState(false);

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

  const toggleHidden = (id: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

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
        {selectable && (selected?.size ?? 0) > 0 && (
          <Badge tone="brand">{selected?.size} selected</Badge>
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
        <span className="px-1 text-[11px] tabular-nums text-gray-500 dark:text-gray-400">
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
      {/* Column visibility — trailing control, shrink-0 */}
      <div className="flex shrink-0 items-center justify-end pb-1">
        <div className="relative">
          <button
            type="button"
            onClick={() => setColsOpen((o) => !o)}
            aria-expanded={colsOpen}
            className="flex h-7 items-center gap-1 rounded-[5px] border border-brand/20 px-2 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-night-border dark:text-gray-400 dark:hover:bg-gray-800"
          >
            Cols
            <span className={`transition-transform ${colsOpen ? "rotate-180" : ""}`}>▾</span>
          </button>
          {colsOpen && (
            <>
              <button
                type="button"
                aria-label="Close column menu"
                className="fixed inset-0 z-10 cursor-default"
                onClick={() => setColsOpen(false)}
              />
              {/* Keeps `surface-border`: this popover is one of the few surfaces
                  still white, and #e6edef reads correctly there. The green
                  surfaces moved to `border-brand/20` because #e6edef on
                  `surface-wash` is 1.02:1 — invisible. */}
              <div className="absolute right-0 top-full z-20 mt-1 w-48 overflow-hidden rounded-[5px] border border-surface-border bg-white py-1 shadow-lg dark:border-night-border dark:bg-night-card">
                {columns
                  .filter((c) => c.hideable !== false)
                  .map((c) => (
                    <label
                      key={c.id}
                      className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                      <input
                        type="checkbox"
                        checked={!hidden.has(c.id)}
                        onChange={() => toggleHidden(c.id)}
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
      </div>

      {pager}

      <div
        ref={scrollRef}
        style={{ maxHeight }}
        className="min-h-0 flex-1 overflow-auto rounded-[5px] border border-brand/20 scrollbar-thin dark:border-night-border"
      >
        <table className="w-full border-collapse text-left text-xs 2xl:text-sm">
          <thead className="sticky top-0 z-10 bg-brand/10 dark:bg-night-card">
            <tr>
              {selectable && (
                <th className="w-8 px-2 py-2">
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
                    className={`whitespace-nowrap px-2 py-2 font-bold text-gray-900 dark:text-gray-100 ${
                      c.headerClassName ?? ""
                    }`}
                  >
                    {c.sortKey ? (
                      <button
                        type="button"
                        onClick={() => handleSort(c)}
                        className="inline-flex items-center gap-1 hover:text-brand dark:hover:text-brand-on-dark"
                      >
                        {c.header}
                        <span className="text-[9px] text-gray-400">
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
                  {selectable && <td className="px-2 py-2" />}
                  {visible.map((c) => (
                    <td key={c.id} className="px-2 py-2">
                      <span className="block h-3 w-full max-w-[160px] animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                    </td>
                  ))}
                </tr>
              ))}

            {!loading &&
              rows.map((row, index) => {
                const key = rowKey(row);
                return (
                  <tr
                    key={key}
                    className={`border-t border-brand/20 transition-colors hover:bg-brand/10/40 dark:border-night-border dark:hover:bg-brand/20 ${
                      index % 2 === 0 ? "" : "bg-gray-50/50 dark:bg-night-card/20"
                    }`}
                  >
                    {selectable && (
                      <td className="px-2 py-2">
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
                        className={`px-2 py-2 text-gray-700 dark:text-gray-300 ${c.className ?? ""}`}
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
      className="flex h-7 w-7 items-center justify-center rounded-[5px] border border-brand/20 text-xs text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-night-border dark:text-gray-400 dark:hover:bg-gray-800"
    >
      {children}
    </button>
  );
}
