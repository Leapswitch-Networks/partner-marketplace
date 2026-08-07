"use client";

import type { ReactNode } from "react";

import { Card, CardContent, CardHeader } from "@/components/common/Card";
import DataTable, { type Column } from "@/components/common/DataTable";
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

export interface ResourceIndexProps<T, F extends FilterValues> {
  /** Card heading — the resource's plural name. */
  title: string;
  /**
   * One line under the title. Usually a count plus a sentence explaining what
   * the resource is for; a bare count wastes the line.
   */
  description?: string;
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

  /** Modals and toasts. Rendered after the card so they layer above it. */
  children?: ReactNode;
}

export default function ResourceIndex<T, F extends FilterValues>({
  title,
  description,
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
  children,
}: ResourceIndexProps<T, F>) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <Card>
        <CardHeader title={title} description={description} actions={actions} />

        <CardContent>
          <FilterBar query={query} filters={filters}>
            {filterExtras}
          </FilterBar>

          <DataTable<T>
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
