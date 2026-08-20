"use client";

import type { ReactNode } from "react";

import { Card, CardContent, CardHeader } from "@/components/common/Card";
import DataTable, { type Column } from "@/components/common/DataTable";
import type { RowId } from "@/components/vendor-datatable/types";
import VendorDataTable from "@/components/common/VendorDataTable";
import FilterBar, { type FilterDef } from "@/components/common/FilterBar";
import StatTiles, { type StatTile } from "@/components/common/StatTiles";
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

/**
 * The shape an RTK Query list hook returns, as much of it as this shell needs.
 *
 * Structural, not imported from `@reduxjs/toolkit`: it has to accept both
 * `isFetching` (what a paged query exposes, and what should drive the spinner —
 * it is true on a filter change while `isLoading` is not) and `isLoading` alone.
 */
export interface ListQueryResult<T> {
  data?: { items: T[]; total: number; pages: number };
  isFetching?: boolean;
  isLoading?: boolean;
  error?: unknown;
  refetch: () => void;
}

/**
 * The data half of the props, as an **exclusive** union: either hand over the
 * query result, or the six primitives it desugars to. Never both — `?: never` on
 * each arm is what makes passing a mixture a type error rather than a silent
 * precedence question.
 */
type ResourceIndexDataProps<T> =
  | {
      /**
       * The paged query this index renders, straight from the hook:
       * `result={useListUsersQuery(...)}`.
       *
       * Fourteen call sites were spelling out the same six lines —
       * `rows={page?.items ?? []}`, `loading={isFetching}`,
       * `total={page?.total ?? 0}` and so on — which is six chances each to read
       * `isLoading` where `isFetching` was meant, or to default a count to
       * something other than 0. Derived in one place now.
       */
      result: ListQueryResult<T>;
      /**
       * Shown when the query fails **and the server sent nothing better**.
       *
       * The transport already turns every failure into a sentence fit to show a
       * user (see `axiosBaseQuery`), and the old call sites threw that away for a
       * static string — so a 403 explaining *why* arrived as "Could not load
       * users." The server's message wins now; this is the fallback for the case
       * where there isn't one, such as a request that never landed.
       */
      errorMessage: string;

      rows?: never;
      total?: never;
      pages?: never;
      loading?: never;
      error?: never;
      onRetry?: never;
    }
  | {
      result?: never;
      errorMessage?: never;

      /**
       * The primitives. Still the contract — `result` is the adapter for the
       * standard source, not a second way of describing data — and the arm the
       * two indexes whose rows are *not* a paged server query use: `RolesModule`
       * pages a full list in the browser, and `PartnerTiersModule` reads an
       * unpaged array.
       */
      rows: T[];
      total: number;
      pages: number;
      loading?: boolean;
      error?: string | null;
      onRetry?: () => void;
    };

interface ResourceIndexBaseProps<T extends { id: RowId }, F extends FilterValues> {
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

  /**
   * Headline counts, rendered as a `StatTiles` row between the header and the
   * table. **This is the only place an index page puts stats** — before
   * 2026-08-17 `InvitationsModule` passed its tiles through `filterExtras`,
   * which put four numbers inside the filter row and left them competing with
   * Reset and the column picker for the same line.
   *
   * It costs table height, and that is the real trade-off: `DataTable` sizes its
   * scroll box from `getBoundingClientRect().top`, so the rows re-measure
   * correctly, but chrome above the table is still rows you cannot see. Pass this
   * when the numbers answer a question the table cannot; leave it off otherwise.
   */
  stats?: StatTile[];
  /** Renders `stats` as skeletons. Pass the list's own loading flag. */
  statsLoading?: boolean;

  query: ResourceQuery<F>;
  filters: FilterDef<F>[];
  /**
   * Extra controls in the filter row, before Reset. **Controls** — if it does not
   * take a click, it belongs in `stats` or in the header description.
   */
  filterExtras?: ReactNode;

  columns: Column<T>[];
  rowKey: (row: T) => string;

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
   * on 2026-08-10 and adapted by `VendorDataTable`. This began as opt-in,
   * proven on Users only — as of 2026-08-13 **all twelve index modules pass
   * `"vendor"`**, so the default arm is live code with no consumer. It stays:
   * removing the escape hatch is how the next visual regression becomes
   * unrevertable per-module.
   */
  table?: "default" | "vendor";

  /** Modals and toasts. Rendered after the card so they layer above it. */
  children?: ReactNode;
}

export type ResourceIndexProps<
  T extends { id: RowId },
  F extends FilterValues,
> = ResourceIndexBaseProps<T, F> & ResourceIndexDataProps<T>;

/**
 * Prefer the message the server sent. `axiosBaseQuery` normalises every failure
 * to `{ status, data }` where `data` is already human-readable, so the fallback
 * is for the case where there is nothing to show — most often a request that
 * never reached the server at all.
 */
function listErrorText(error: unknown, fallback: string): string {
  const data = (error as { data?: unknown } | null | undefined)?.data;
  return typeof data === "string" && data.length > 0 ? data : fallback;
}

export default function ResourceIndex<T extends { id: RowId }, F extends FilterValues>(
  props: ResourceIndexProps<T, F>
) {
  const {
    title,
    description,
    icon,
    actions,
    query,
    filters,
    filterExtras,
    columns,
    rowKey,
    selectable,
    bulkActions,
    emptyTitle,
    emptyHint,
    rowNoun,
    table = "default",
    stats,
    statsLoading,
    children,
  } = props;

  /*
    One place where a query result becomes the six values the table needs.
    `isFetching ?? isLoading` and not the other way round: `isFetching` is true
    while a filter change is in flight and `isLoading` is not, so reading
    `isLoading` here would leave the old rows on screen with no spinner during
    exactly the interaction this shell exists for.
  */
  const list = props.result
    ? {
        rows: props.result.data?.items ?? [],
        total: props.result.data?.total ?? 0,
        pages: props.result.data?.pages ?? 0,
        loading: props.result.isFetching ?? props.result.isLoading ?? false,
        error: props.result.error
          ? listErrorText(props.result.error, props.errorMessage)
          : null,
        onRetry: props.result.refetch,
      }
    : {
        rows: props.rows,
        total: props.total,
        pages: props.pages,
        loading: props.loading,
        error: props.error,
        onRetry: props.onRetry,
      };

  const Table = table === "vendor" ? VendorDataTable : DataTable;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* No outer hairline: the table draws its own frame, and the two
          together read as a box inside a box. */}
      <Card bordered={false}>
        <CardHeader title={title} description={description} icon={icon} actions={actions} />

        <CardContent>
          {/* Above the toolbar, below the heading — the one place stats go. The
              margin is on the tiles rather than the table so an index without
              stats keeps exactly the spacing it had. */}
          {stats && stats.length > 0 && (
            <StatTiles items={stats} loading={statsLoading} className="mb-2 shrink-0" />
          )}

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
            rows={list.rows}
            rowKey={rowKey}
            loading={list.loading}
            error={list.error}
            onRetry={list.onRetry}
            page={query.page}
            perPage={query.perPage}
            total={list.total}
            pages={list.pages}
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
