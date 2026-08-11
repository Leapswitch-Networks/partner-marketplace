"use client";

import type { ReactNode } from "react";

import { Card, CardContent, CardHeader } from "@/components/common/Card";
import DataTable, { type Column } from "@/components/common/DataTable";
import type { RowId } from "@/components/vendor-datatable/types";
import VendorDataTable from "@/components/common/VendorDataTable";
import FilterBar, { type FilterDef } from "@/components/common/FilterBar";
import type { FilterValues, ResourceQuery } from "@/lib/hooks/useResourceQuery";

/**
 * The index-page shell: header, filters, table, paging.
 *
 * A module supplies its columns, its filter definitions and its handlers. It does
 * not supply the layout, and it must not — the class combinations in
 * `UI_PATTERNS.md` § Full-Page Index Layout are load-bearing, and every module
 * that rewrites them is another chance to get `min-h-0` wrong and have the page
 * scroll instead of the table.
 *
 * This is the component that keeps our index pages short. The reference
 * implementation has no equivalent, and its Users index is 936 lines as a direct
 * result; ours should stay in the low hundreds, almost all of it columns and
 * handlers.
 *
 * **It owns layout and wiring only.** No fetching, no Redux, no business rules —
 * `NEXTJS_STANDARDS.md` § Component Primitives keeps these dumb. The module
 * fetches, and passes the result down.
 */

export interface ResourceIndexProps<T extends { id: RowId }, F extends FilterValues> {
  /** Card heading — the resource's plural name. */
  title: string;
  /**
   * One line under the title. Usually a count plus a sentence explaining what
   * the resource is for; a bare count wastes the line.
   */
  description?: string;
  /** Glyph before the title. `navIcon("users")` and friends. */
  icon?: ReactNode;
  /** Header-right actions — normally the create button, permission-gated. */
  actions?: ReactNode;

  query: ResourceQuery<F>;
  filters: FilterDef<F>[];
  /** Extra controls in the filter row, before Reset. */
  filterExtras?: ReactNode;

  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;

  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;

  total: number;
  pages: number;

  /** Enables the selection column. Omit for a read-only table. */
  selectable?: boolean;
  /**
   * Bulk controls, shown only while rows are selected. Gate each one on its own
   * permission — a bulk bar offering an action that 403s is worse than one that
   * omits it.
   */
  bulkActions?: ReactNode;

  emptyTitle?: string;
  emptyHint?: ReactNode;
  /** Singular noun for the selection count — "user", "role". */
  rowNoun?: string;
  /**
   * Which table renders the rows.
   *
   * `"default"` is ours. `"vendor"` is the reference implementation's, copied in
   * on 2026-08-10 and adapted by `VendorDataTable` — **opt-in per module, on
   * purpose.** It is proven on Users only; the other modules stay on ours until
   * that one has been looked at in a browser and signed off.
   */
  table?: "default" | "vendor";

  /** Modals and toasts. Rendered after the card so they layer above it. */
  children?: ReactNode;
}

export default function ResourceIndex<T extends { id: RowId }, F extends FilterValues>({
  title,
  description,
  icon,
  actions,
  query,
  filters,
  filterExtras,
  columns,
  rows,
  rowKey,
  loading,
  error,
  onRetry,
  total,
  pages,
  selectable,
  bulkActions,
  emptyTitle,
  emptyHint,
  rowNoun,
  table = "default",
  children,
}: ResourceIndexProps<T, F>) {
  const Table = table === "vendor" ? VendorDataTable : DataTable;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* No outer hairline: the table draws its own frame, and the two
          together read as a box inside a box. */}
      <Card bordered={false}>
        <CardHeader title={title} description={description} icon={icon} actions={actions} />

        <CardContent>
          {/*
            The filters go *into* the table's toolbar row rather than above it, so
            they share the line with the column picker. See the note in
            `DataTable` for why that row is worth reclaiming — the scroll box is
            viewport-measured, so chrome above it costs visible records.
          */}
          <Table<T>
            toolbar={
              <FilterBar query={query} filters={filters}>
                {filterExtras}
              </FilterBar>
            }
            columns={columns}
            rows={rows}
            rowKey={rowKey}
            loading={loading}
            error={error}
            onRetry={onRetry}
            page={query.page}
            perPage={query.perPage}
            total={total}
            pages={pages}
            onPageChange={query.setPage}
            onPerPageChange={query.setPerPage}
            sortBy={query.sortBy}
            sortOrder={query.sortOrder}
            onSortChange={query.setSort}
            selectable={selectable}
            selected={query.selected}
            onSelectedChange={query.setSelected}
            bulkActions={bulkActions}
            emptyTitle={emptyTitle}
            emptyHint={emptyHint}
            rowNoun={rowNoun}
            // Lets the table distinguish "nothing exists yet" from "your filters
            // hid everything", which are different problems with different fixes.
            filtersActive={query.filtersActive}
            onResetFilters={query.resetFilters}
          />
        </CardContent>
      </Card>

      {children}
    </div>
  );
}
