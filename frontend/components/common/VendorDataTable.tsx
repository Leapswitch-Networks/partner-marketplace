"use client";

import { useMemo, type ReactNode } from "react";

import ColumnPicker, { useHiddenColumns } from "@/components/common/ColumnPicker";
import ErrorState from "@/components/common/ErrorState";
import Skeleton from "@/components/common/Skeleton";
import { DataTable as DataTableVendor } from "@/components/vendor-datatable/DataTableVendor";
import type { ColumnDef, PaginationData, PaginationLink, RowId } from "@/components/vendor-datatable/types";
import type { Column, DataTableProps } from "@/components/common/DataTable";

/**
 * Adapter: our `DataTable` props in, the reference's DataTable out.
 *
 * The vendor component under `components/vendor-datatable/` is the reference's
 * file, copied on 2026-08-10 with the owner's approval and patched only where it
 * could not run here (row ids widened to `string | number`). Everything that made
 * it incompatible is reconciled in this file rather than by editing it further,
 * so the fork stays close to upstream and re-copying it later is cheap.
 *
 * ## The three mismatches, and how each is resolved
 *
 * **1. Pagination is Laravel-shaped.** It takes a `PaginationData` carrying
 * `links: [prev, 1, 2, …, n, next]` — Laravel paginator output, where each link
 * holds a *URL* — and calls `onPageChange(url)`. Our API returns
 * `{items, page, per_page, total, pages}` and we page by number. The links array
 * is synthesised below with the page number in the `url` slot, and the callback
 * parses it back. Its sliding-window pager (1 … 4 5 [6] 7 8 … 20) then works
 * untouched, which is the part worth having.
 *
 * **2. It has no loading, error or retry state.** Ours does, and
 * `CORE_COMPLETION_PLAN.md` § 4.1 measured that as the gap where ours is ahead.
 * A straight swap would have dropped them, so they are handled here, before the
 * vendor renders.
 *
 * **3. It cannot tell "no data" from "filters hid everything".** Also ours.
 * The distinction is composed into the `emptyState` node passed down.
 *
 * ## What is deliberately NOT forwarded
 *
 * `useAutoPerPage`'s viewport measurement. The vendor measures its own scroll box
 * from `window.innerHeight`, so passing ours as well would give two components
 * an opinion about the same number. Its `perPage` select drives the value instead.
 *
 * ## 4. It has a column toggle, and we do not use it
 *
 * `hideColumnToggle` suppresses the vendor's own dropdown — a `Settings2` +
 * "Columns" button that renders in a row of its own above the table, styled to
 * match nothing else here. Ours goes in the toolbar row beside Reset instead.
 *
 * **For a while it suppressed the vendor's and supplied nothing**, so the Users
 * index — the only page on this table — had no column picker at all. Fixed
 * 2026-08-11 by rendering the shared `ColumnPicker` in the toolbar row and
 * filtering the columns before they reach the vendor, which is why the vendor's
 * own visibility state never has to be reached into.
 */
export default function VendorDataTable<T extends { id: RowId }>({
  columns,
  rows,
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
  toolbar,
  className = "",
}: DataTableProps<T>) {
  /**
   * Laravel's link array, rebuilt from a page count.
   *
   * Shape matters: the vendor reads `links[0]` as previous, `links.at(-1)` as
   * next, and everything between as the numbered pages — so the array must have
   * those bookends even when there is one page. `url` is `null` at the bounds,
   * which is what disables the arrows. Labels go through
   * `dangerouslySetInnerHTML` upstream because Laravel sends `&laquo; Previous`;
   * ours are plain text, which renders identically and carries no markup.
   */
  const links: PaginationLink[] = useMemo(() => {
    const pageUrl = (n: number) => String(n);
    const out: PaginationLink[] = [
      { url: page > 1 ? pageUrl(page - 1) : null, label: "‹", active: false },
    ];
    for (let n = 1; n <= Math.max(pages, 1); n++) {
      out.push({ url: pageUrl(n), label: String(n), active: n === page });
    }
    out.push({ url: page < pages ? pageUrl(page + 1) : null, label: "›", active: false });
    return out;
  }, [page, pages]);

  const data: PaginationData = useMemo(
    () => ({
      current_page: page,
      last_page: Math.max(pages, 1),
      per_page: perPage,
      total,
      from: total === 0 ? 0 : (page - 1) * perPage + 1,
      to: Math.min(page * perPage, total),
      data: rows,
      links,
    }),
    [page, pages, perPage, total, rows, links]
  );

  const { hidden, toggle: toggleHidden } = useHiddenColumns();

  /**
   * Our `Column` is theirs with two fields renamed — plus the hidden ones
   * removed here rather than inside the vendor.
   *
   * The vendor keeps its own `visibleColumns` map, seeded once from the first
   * `columns` array it is handed. Since nothing is hidden on that first render
   * every id is seeded `true` and stays true, so filtering upstream simply
   * shortens the list it renders. Reaching into that state instead would mean
   * driving a component's internals from outside it, and the whole point of this
   * adapter is that the vendor file stays close to upstream.
   */
  const vendorColumns: ColumnDef<T>[] = useMemo(
    () =>
      columns
        .filter((c: Column<T>) => !hidden.has(c.id))
        .map((c: Column<T>) => ({
          id: c.id,
          header: c.header,
          /*
            The index is rebased to the **whole result set**, because that is what
            our `DataTable` passes and a `Column` must mean the same thing on both.

            It did not. Ours passes `(page - 1) * perPage + index`; the vendor
            passes the position within the page. A `#` column written for one is
            wrong on the other, and both spellings were in the codebase — Users
            restarted its numbering at 1 on every page, and Invitations added the
            page offset to an index that already had it and jumped to 51 on page 2.
            Neither is visible until you click to page 2, which is why both
            survived.

            Correcting it here rather than in the vendor keeps that file close to
            upstream, and means the contract is stated once: **the second argument
            to `cell` is the row's absolute 0-based position.**
          */
          cell: (row: T, index: number) => c.cell(row, (page - 1) * perPage + index),
          sortable: Boolean(c.sortKey),
          /*
            **This line is why the sort arrows never appeared.** Every sort branch
            in the vendor is gated on `column.sortable && onSort && column.accessorKey`
            — the header icon, the active-direction icon, and the click handler,
            all three. `sortable` was being set and `accessorKey` never was, so
            all three were permanently false: no arrows, and a header that looked
            clickable (`cursor-pointer`) and did nothing. Fixed 2026-08-11.

            It carries the **sort key**, not the column id, because the vendor
            hands this same value to `onSort` *and* compares it against `sortBy`
            to decide which direction to draw. `sortBy` is the server's key
            (`last_login_at`), not ours (`last_login`), so anything else would
            leave every column drawing the neutral both-ways chevron even while
            it was the one being sorted on.

            The cast is the honest part of this. Upstream types the field
            `keyof T` because it doubles as a value accessor — `row[accessorKey]`
            when a column has no `cell`. Ours always has a `cell` (the type makes
            it required), so that branch is unreachable and this is only ever a
            sort identifier. A sort key need not be a field at all; a future one
            could be a joined column.
          */
          accessorKey: c.sortKey as keyof T | undefined,
          className: c.className,
          headerClassName: c.headerClassName,
          enableHiding: c.hideable !== false,
        })),
    [columns, hidden, page, perPage]
  );

  /**
   * One row of chrome, shared by all three returns below.
   *
   * The loading and error branches return early, and if they rendered the
   * filters without the picker the row would reflow the moment data arrived —
   * controls shifting under the cursor as a fetch lands.
   *
   * `justify-end` matches our own `DataTable`: `FilterBar` claims the width with
   * `flex-1` and the picker stays hard right, immediately after Reset.
   */
  const toolbarRow = (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 pb-2">
      {toolbar}
      <ColumnPicker columns={columns} hidden={hidden} onToggle={toggleHidden} />
    </div>
  );

  /**
   * Their `onSort` passes one string and expects the parent to work out the
   * direction; ours takes an explicit pair. Same toggle rule as our own table: a
   * second click on the active column flips it, a new column starts descending.
   *
   * The string arriving here is the **sort key**, because that is what
   * `accessorKey` above carries. It used to look the argument up by `c.id`,
   * which would have found nothing even once the arrows started working —
   * `last_login` is a column id, `last_login_at` is a sort key, and the lookup
   * silently returned `undefined` and swallowed the click.
   *
   * The `some` guard stays so an unknown key cannot reach the API: the server's
   * `ListSpec.sortable` map rejects it anyway, but failing here costs nothing
   * and turns a 422 into a no-op.
   */
  const handleSort = (sortKey: string) => {
    if (!onSortChange || !columns.some((c) => c.sortKey === sortKey)) return;
    const next = sortBy === sortKey && sortOrder === "desc" ? "asc" : "desc";
    onSortChange(sortKey, next);
  };

  if (loading && rows.length === 0) {
    return (
      <div className={`flex min-h-0 flex-1 flex-col gap-2 ${className}`}>
        {toolbarRow}
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex min-h-0 flex-1 flex-col gap-2 ${className}`}>
        {toolbarRow}
        <ErrorState error={new Error(error)} reset={onRetry ?? (() => window.location.reload())} title="Could not load this list" compact />
      </div>
    );
  }

  const emptyState: ReactNode = filtersActive ? (
    <div className="flex flex-col items-center gap-2">
      <p className="text-sm text-muted-foreground">No records match your filters</p>
      {onResetFilters && (
        <button
          type="button"
          onClick={onResetFilters}
          className="text-xs font-medium text-brand underline-offset-2 hover:underline dark:text-brand-on-dark"
        >
          Reset filters
        </button>
      )}
    </div>
  ) : (
    <div className="flex flex-col items-center gap-2">
      <p className="text-sm text-muted-foreground">{emptyTitle}</p>
      {emptyHint}
    </div>
  );

  return (
    /*
      `flex-1` here is load-bearing, and leaving it off was a real bug.
      `CardContent` is `flex min-h-0 flex-1 flex-col`, so this wrapper must claim
      that height — without it the wrapper sizes to its content, the vendor's
      `flex-1` container has nothing bounding it, and its
      `innerHeight - rect.top - 60` measurement resolves against an unconstrained
      parent. The table then stretched to the bottom of the window with only a
      couple of rows in it. `min-h-0` is what lets it shrink below content height;
      `UI_PATTERNS.md` § Full-Page Index Layout calls that pair load-bearing and
      this is exactly the failure it warns about.
    */
    <div className={`flex min-h-0 flex-1 flex-col ${className}`}>
      {/*
        The toolbar must sit in its own HORIZONTAL, `shrink-0` row.

        `FilterBar` renders `FilterRow`, which is `flex min-w-0 flex-1 flex-wrap`
        — that `flex-1` is meant to claim *width* beside the Cols button. Dropped
        straight into this vertical column it claimed **height** instead, growing
        to fill and squeezing the table down to about two visible rows. Our own
        `DataTable` never hit this because it always wrapped the toolbar in a row.
      */}
      {toolbarRow}
      <DataTableVendor<T>
        className="min-h-0 flex-1"
        columns={vendorColumns}
        data={data}
        selectable={selectable}
        selectedIds={selected ? Array.from(selected) : undefined}
        onRowSelect={(ids: RowId[]) => onSelectedChange?.(new Set(ids.map(String)))}
        bulkActions={bulkActions ? () => bulkActions : undefined}
        emptyState={emptyState}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
        onPageChange={(url: string) => onPageChange(Number(url))}
        onPerPageChange={onPerPageChange}
        perPage={perPage}
        hideColumnToggle
      />
    </div>
  );
}
