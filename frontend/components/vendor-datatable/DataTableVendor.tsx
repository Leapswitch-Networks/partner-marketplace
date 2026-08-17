'use client';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    ChevronDown,
    ChevronsUpDown,
    ChevronUp,
    Settings2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
// PATCHED: ours, not the reference's — the reference has no back-to-top.
import ScrollToTop from '@/components/common/ScrollToTop';
import type { DataTableProps, RowId } from './types';

// PATCHED: RowId, not number — see types.ts
const EMPTY_IDS: RowId[] = [];

// PATCHED: see the per-page Select below.
const PER_PAGE_STEPS = [10, 15, 25, 50, 100];

// PATCHED: `id: RowId`, not `id: number` — see types.ts
export function DataTable<T extends { id: RowId }>({
    columns,
    data,
    selectable = false,
    isRowSelectable,
    onRowSelect,
    selectedIds = EMPTY_IDS,
    bulkActions,
    rowActions,
    emptyState,
    sortBy,
    sortOrder,
    onSort,
    onPageChange,
    onPerPageChange,
    perPage = 15,
    className = '',
    hideColumnToggle = false,
    hidePagination = false,
    hideTopPagination = false,
    headerRowClassName = '',
    fitContent = false,
    maxBodyHeight,
}: DataTableProps<T>) {
    const [localSelectedIds, setLocalSelectedIds] =
        useState<RowId[]>(selectedIds);
    const [visibleColumns, setVisibleColumns] = useState<
        Record<string, boolean>
    >(columns.reduce((acc, col) => ({ ...acc, [col.id]: true }), {}));

    // Dynamic table height based on position in viewport
    const tableContainerRef = useRef<HTMLDivElement>(null);
    const [tableMaxHeight, setTableMaxHeight] = useState<string>('auto');

    // Activity-Log deep link: ?highlight=<id> scrolls to + flashes that row
    // for 2.5s. Silent no-op if the row isn't in the current page slice.
    const [highlightId, setHighlightId] = useState<number | null>(null);
    const [flashOn, setFlashOn] = useState(false);
    const highlightRowRef = useRef<HTMLTableRowElement | null>(null);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const params = new URLSearchParams(window.location.search);
        const raw = params.get('highlight');
        if (!raw) return;
        const id = Number(raw);
        if (Number.isFinite(id)) setHighlightId(id);
    }, []);

    const rowsData = Array.isArray((data as { data?: T[] }).data)
        ? ((data as { data: T[] }).data as T[])
        : ([] as T[]);

    useEffect(() => {
        if (highlightId === null) return;
        const found = rowsData.some((r) => r.id === highlightId);
        if (!found) return;
        const t = window.setTimeout(() => {
            highlightRowRef.current?.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
            });
            setFlashOn(true);
            window.setTimeout(() => setFlashOn(false), 2500);
        }, 150);
        return () => window.clearTimeout(t);
    }, [highlightId, rowsData]);

    useEffect(() => {
        // Explicit cap: rows scroll inside this fixed height while the sticky
        // header stays pinned. Set by the caller, so it works inside a page that
        // is already scrolling, where measuring against the viewport would size
        // the table from the wrong reference point.
        if (maxBodyHeight) {
            setTableMaxHeight(maxBodyHeight);
            return;
        }

        // Embedded mode: render at natural height, let the outer container scroll.
        if (fitContent) {
            setTableMaxHeight('none');
            return;
        }

        const calculateHeight = () => {
            if (tableContainerRef.current) {
                const rect = tableContainerRef.current.getBoundingClientRect();
                // visualViewport, not innerHeight, where it exists: on mobile
                // the layout is h-dvh while innerHeight tracks the URL-bar
                // state, and the mismatch clipped the bottom pager below the
                // visible area (2026-08-13 responsive audit).
                const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
                // 76px reserve: mt-2 (8) + a pager row that WRAPS to two lines
                // on narrow screens (2×28 + 8). The old 60px assumed one line
                // and clipped the second behind the card's overflow-hidden.
                const available = viewportHeight - rect.top - 76;
                setTableMaxHeight(`${Math.max(available, 200)}px`);
            }
        };

        calculateHeight();
        window.addEventListener('resize', calculateHeight);
        window.visualViewport?.addEventListener('resize', calculateHeight);
        // Re-measure when anything ABOVE the table changes height — filters
        // wrapping, the bulk bar mounting, a stat row loading in. `rect.top`
        // moves 30-60px on each of those, and a resize listener alone left the
        // stored height stale (the audit's #3).
        const observer = new ResizeObserver(calculateHeight);
        if (tableContainerRef.current?.parentElement) {
            observer.observe(tableContainerRef.current.parentElement);
        }
        return () => {
            window.removeEventListener('resize', calculateHeight);
            window.visualViewport?.removeEventListener('resize', calculateHeight);
            observer.disconnect();
        };
    }, [fitContent, maxBodyHeight]);

    // Sync local selection with prop (compare by content to avoid infinite loops)
    const prevSelectedIdsRef = useRef(selectedIds);
    useEffect(() => {
        const prev = prevSelectedIdsRef.current;
        const changed =
            prev.length !== selectedIds.length ||
            prev.some((id, i) => id !== selectedIds[i]);
        if (changed) {
            prevSelectedIdsRef.current = selectedIds;
            setLocalSelectedIds(selectedIds);
        }
    }, [selectedIds]);

    // Get selectable rows
    const selectableRows = data.data.filter((row) =>
        isRowSelectable ? isRowSelectable(row) : true,
    );

    const isAllSelected =
        selectable &&
        selectableRows.length > 0 &&
        selectableRows.every((row) => localSelectedIds.includes(row.id));

    const isSomeSelected =
        selectable &&
        selectableRows.some((row) => localSelectedIds.includes(row.id)) &&
        !isAllSelected;

    const handleSelectAll = (checked: boolean) => {
        const newSelectedIds = checked
            ? selectableRows.map((row) => row.id)
            : [];
        setLocalSelectedIds(newSelectedIds);
        onRowSelect?.(newSelectedIds);
    };

    const handleSelectRow = (rowId: number, checked: boolean) => {
        const newSelectedIds = checked
            ? [...localSelectedIds, rowId]
            : localSelectedIds.filter((id) => id !== rowId);
        setLocalSelectedIds(newSelectedIds);
        onRowSelect?.(newSelectedIds);
    };

    const clearSelection = () => {
        setLocalSelectedIds([]);
        onRowSelect?.([]);
    };

    const handleSort = (columnId: string) => {
        if (onSort) {
            onSort(columnId);
        }
    };

    const SortIcon = ({ column }: { column: string }) => {
        if (sortBy !== column) {
            return <ChevronsUpDown className="size-3.5 shrink-0 2xl:size-4" />;
        }
        return sortOrder === 'asc' ? (
            <ChevronUp className="size-3.5 shrink-0 2xl:size-4" />
        ) : (
            <ChevronDown className="size-3.5 shrink-0 2xl:size-4" />
        );
    };

    const isEmpty = !data.data || data.data.length === 0;
    const visibleColumnsList = columns.filter((col) => visibleColumns[col.id]);
    const hasHideableColumns = columns.some(
        (col) => col.enableHiding !== false,
    );

    const PaginationBar = () => (
        <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-4">
                {/* Phones get the count in short form rather than nothing —
                    "how many results" is exactly the question a filter answers,
                    and hiding it below sm made a phone user page blind
                    (2026-08-13, the responsive pass). The long form and the
                    per-page control stay sm+. */}
                <p className="whitespace-nowrap text-xs text-muted-foreground sm:hidden">
                    {data.from}–{data.to} of {data.total}
                </p>
                <p className="hidden whitespace-nowrap text-xs text-muted-foreground sm:block 2xl:text-sm">
                    Showing {data.from} to {data.to} of {data.total}{' '}
                    results
                </p>
                {onPerPageChange && (
                    <div className="hidden items-center gap-2 sm:flex">
                        <span className="text-xs text-muted-foreground 2xl:text-sm">
                            Per page:
                        </span>
                        <Select
                            value={perPage.toString()}
                            onValueChange={(value) =>
                                onPerPageChange(parseInt(value))
                            }
                        >
                            <SelectTrigger className="h-7 w-[60px] text-xs">
                                <SelectValue placeholder={perPage.toString()} />
                            </SelectTrigger>
                            {/*
                              PATCHED: options are derived, not hardcoded.

                              Upstream lists 10/15/25/50/100 literally. Our
                              `useAutoPerPage()` sizes the page to the viewport —
                              `floor((h - 433) / 38)`, clamped 5-50 — so it hands
                              down values like 7, 11 or 12, which matched no item.
                              Radix renders an EMPTY trigger when the value has no
                              matching option, so the field simply looked blank.

                              Folding the current value into the list keeps the
                              standard steps and makes the real page size visible.
                            */}
                            <SelectContent>
                                {Array.from(new Set([...PER_PAGE_STEPS, perPage]))
                                    .sort((a, b) => a - b)
                                    .map((n) => (
                                        <SelectItem key={n} value={n.toString()}>
                                            {n}
                                        </SelectItem>
                                    ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </div>
            {onPageChange && data.links && (
                <div className="flex shrink-0 gap-1">
                    {(() => {
                        const prevLink = data.links[0];
                        const nextLink = data.links[data.links.length - 1];
                        const pageLinks = data.links.slice(1, -1);
                        const totalPages = pageLinks.length;

                        // Sliding window: 1 … current-2 current-1 [current] current+1 current+2 … last
                        let visibleIndices: (number | 'ellipsis')[];
                        const SIBLINGS = 2; // pages on each side of current
                        if (totalPages <= 7) {
                            visibleIndices = pageLinks.map((_, i) => i);
                        } else {
                            const currentIdx = Math.max(0, pageLinks.findIndex((l) => l.active));
                            const first = 0;
                            const last = totalPages - 1;
                            const windowStart = Math.max(first + 1, currentIdx - SIBLINGS);
                            const windowEnd = Math.min(last - 1, currentIdx + SIBLINGS);

                            const indices = new Set<number>();
                            indices.add(first);
                            for (let i = windowStart; i <= windowEnd; i++) {
                                indices.add(i);
                            }
                            indices.add(last);

                            const sorted = Array.from(indices).sort((a, b) => a - b);
                            visibleIndices = [];
                            for (let i = 0; i < sorted.length; i++) {
                                if (i > 0 && sorted[i] - sorted[i - 1] > 1) {
                                    visibleIndices.push('ellipsis');
                                }
                                visibleIndices.push(sorted[i]);
                            }
                        }

                        return (
                            <>
                                {/* Touch sizing: 36px minimum below sm (the 28px
                                    buttons were the app's worst touch targets),
                                    settling to the compact 28px from sm up. */}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-9 min-w-9 border-transparent bg-brand/10 px-2.5 text-xs font-semibold text-brand transition-colors hover:bg-brand hover:text-white disabled:cursor-not-allowed disabled:opacity-40 sm:h-7 sm:min-w-0 dark:bg-brand/20 dark:text-brand-on-dark dark:hover:bg-brand dark:hover:text-white"
                                    onClick={() => prevLink.url && onPageChange(prevLink.url)}
                                    disabled={!prevLink.url}
                                    dangerouslySetInnerHTML={{ __html: prevLink.label }}
                                />
                                {/* Numbered window is sm+ only. Nine 28px buttons
                                    need ~380px the pager doesn't have on a phone —
                                    they wrapped into a second line that the card's
                                    overflow-hidden then CLIPPED, making the last
                                    pages unreachable (audit #2). Phones get
                                    prev / "n of m" / next, which always fits. */}
                                <span className="flex items-center px-1.5 text-xs tabular-nums text-muted-foreground sm:hidden">
                                    {(pageLinks.findIndex((l) => l.active) + 1) || 1} / {totalPages || 1}
                                </span>
                                {visibleIndices.map((item, i) =>
                                    item === 'ellipsis' ? (
                                        <span key={`ellipsis-${i}`} className="hidden items-center px-1.5 text-xs text-muted-foreground sm:flex">
                                            &hellip;
                                        </span>
                                    ) : (
                                        <Button
                                            key={item}
                                            variant="ghost"
                                            size="sm"
                                            className={`hidden sm:inline-flex ${pageLinks[item].active ? 'h-7 border-transparent bg-brand/10 px-2.5 text-xs font-bold text-brand dark:bg-brand/20 dark:text-brand-on-dark' : 'h-7 border-transparent bg-transparent px-2.5 text-xs font-semibold text-ink transition-colors hover:bg-brand/10 hover:text-brand dark:text-white dark:hover:bg-brand/20 dark:hover:text-brand-on-dark'}`}
                                            onClick={() => pageLinks[item].url && onPageChange(pageLinks[item].url!)}
                                            disabled={!pageLinks[item].url}
                                        >
                                            {pageLinks[item].label}
                                        </Button>
                                    ),
                                )}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-9 min-w-9 border-transparent bg-brand/10 px-2.5 text-xs font-semibold text-brand transition-colors hover:bg-brand hover:text-white disabled:cursor-not-allowed disabled:opacity-40 sm:h-7 sm:min-w-0 dark:bg-brand/20 dark:text-brand-on-dark dark:hover:bg-brand dark:hover:text-white"
                                    onClick={() => nextLink.url && onPageChange(nextLink.url)}
                                    disabled={!nextLink.url}
                                    dangerouslySetInnerHTML={{ __html: nextLink.label }}
                                />
                            </>
                        );
                    })()}
                </div>
            )}
        </div>
    );

    return (
        <div className={`flex flex-col ${className}`}>
            {/* Column Visibility Dropdown - Only shown if not hidden and has hideable columns */}
            {!hideColumnToggle && hasHideableColumns && (
                <div className="mb-4 flex justify-end">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                                <Settings2 className="mr-2 size-4" />
                                Columns
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuLabel>
                                Toggle columns
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {columns
                                .filter((col) => col.enableHiding !== false)
                                .map((column) => (
                                    <DropdownMenuCheckboxItem
                                        key={column.id}
                                        checked={visibleColumns[column.id]}
                                        onCheckedChange={(checked) =>
                                            setVisibleColumns({
                                                ...visibleColumns,
                                                [column.id]: checked,
                                            })
                                        }
                                    >
                                        {typeof column.header === 'string'
                                            ? column.header
                                            : column.id}
                                    </DropdownMenuCheckboxItem>
                                ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            )}

            {/* Bulk Actions Bar */}
            {selectable && localSelectedIds.length > 0 && bulkActions && (
                <div className="mb-4">
                    {bulkActions(localSelectedIds, clearSelection)}
                </div>
            )}

            {/* Top Pagination */}
            {!isEmpty && !hidePagination && !hideTopPagination && (
                <div className="mb-2">
                    <PaginationBar />
                </div>
            )}

            {/* Table */}
            <div ref={tableContainerRef} className={`flex-1 rounded-md border ${fitContent && !maxBodyHeight ? 'overflow-x-auto' : 'overflow-auto'}`} style={{ maxHeight: tableMaxHeight }}>
                <Table>
                    <TableHeader>
                        <TableRow className={`bg-brand [&>th]:text-white [&>th]:font-bold ${headerRowClassName}`}>
                            {/* PATCHED: no `border-x` on any header cell below.
                                The header row is filled `bg-brand` and the
                                hairline between cells is a near-white — see the
                                TableHead docblock in components/ui/table.tsx. */}
                            {selectable && (
                                <TableHead className="w-[50px] px-0.5 text-center [&:has([role=checkbox])]:pr-2">
                                    {/* PATCHED: white hairline, not brand. This one
                                        sits on the brand-green header row, where the
                                        default `border-brand` would be invisible
                                        against its own background. */}
                                    <Checkbox
                                        className="border-white data-[state=checked]:border-white data-[state=checked]:bg-white data-[state=checked]:text-brand"
                                        checked={
                                            isAllSelected ||
                                            (isSomeSelected
                                                ? 'indeterminate'
                                                : false)
                                        }
                                        onCheckedChange={handleSelectAll}
                                        aria-label="Select all"
                                    />
                                </TableHead>
                            )}
                            {/* PATCHED: the sortable hover is `brand-dark`, and it
                                lives on the button rather than the cell. Upstream
                                used `muted/50` on the `th` — a grey wash over
                                green, which `UI_PATTERNS.md` § The Signed-In
                                Chrome Is Green forbids and which only muddied a
                                filled header. The brand's own hover shade reads
                                as a press target instead. */}
                            {visibleColumnsList.map((column) => {
                                const sortKey =
                                    column.sortable && onSort && column.accessorKey
                                        ? (column.accessorKey as string)
                                        : null;
                                return (
                                    <TableHead
                                        key={column.id}
                                        /*
                                          PATCHED: `aria-sort`, and the click target
                                          is a real button below.

                                          Upstream hangs `onClick` on the `<th>` with
                                          `cursor-pointer` and nothing else. That is a
                                          control you cannot reach with a keyboard and
                                          which announces nothing — and it stayed
                                          unnoticed because, until the adapter started
                                          setting `accessorKey`, none of these headers
                                          did anything at all.

                                          The button carries the click instead of the
                                          `th`, rather than both: a click inside the
                                          button bubbles to the cell, so keeping the
                                          old handler too would sort twice and land
                                          back where it started.
                                        */
                                        aria-sort={
                                            sortKey && sortBy === sortKey
                                                ? sortOrder === 'asc'
                                                    ? 'ascending'
                                                    : 'descending'
                                                : undefined
                                        }
                                        className={column.headerClassName || ''}
                                    >
                                        {sortKey ? (
                                            <button
                                                type="button"
                                                onClick={() => handleSort(sortKey)}
                                                title={`Sort by ${typeof column.header === 'string' ? column.header : column.id}`}
                                                className="flex w-full items-center justify-between gap-1 rounded-[3px] py-0.5 transition-colors hover:bg-brand-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                                            >
                                                <span className="truncate">{column.header}</span>
                                                <SortIcon column={sortKey} />
                                            </button>
                                        ) : (
                                            column.header
                                        )}
                                    </TableHead>
                                );
                            })}
                            {rowActions && (
                                <TableHead className="w-0 px-0 text-center">
                                    Actions
                                </TableHead>
                            )}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isEmpty ? (
                            <TableRow>
                                <TableCell
                                    colSpan={
                                        visibleColumnsList.length +
                                        (selectable ? 1 : 0) +
                                        (rowActions ? 1 : 0)
                                    }
                                    className="h-24 text-center"
                                >
                                    {emptyState || (
                                        <p className="text-muted-foreground">
                                            No data found
                                        </p>
                                    )}
                                </TableCell>
                            </TableRow>
                        ) : (
                            data.data.map((row, index) => {
                                const canSelect = isRowSelectable
                                    ? isRowSelectable(row)
                                    : true;

                                const isHighlighted = row.id === highlightId;
                                /*
                                  PATCHED: the row below no longer carries
                                  `hover:bg-muted/50`. `TableBody` owns both the
                                  stripe and the hover now, and the two selectors
                                  — `.body tr:hover` and
                                  `tr.hover\:bg-muted\/50:hover` — carry IDENTICAL
                                  specificity (0,2,1), so which one won came down
                                  to the order Tailwind happened to emit them in.
                                  One owner, no race.

                                  The flash fill is `!bg-yellow-100` for the same
                                  reason, and this one WAS a live bug: the stripe
                                  selector is (0,2,1) and a plain utility class on
                                  the row is (0,1,0), so on every even-numbered row
                                  the yellow never painted at all — the Activity-Log
                                  `?highlight=` deep link landed you on a row marked
                                  only by its ring. `!` is the narrowest fix that
                                  does not give the stripe a specificity war to win.
                                */
                                return (
                                    <TableRow
                                        key={row.id}
                                        ref={
                                            isHighlighted
                                                ? highlightRowRef
                                                : undefined
                                        }
                                        data-highlighted={
                                            isHighlighted ? 'true' : undefined
                                        }
                                        className={`transition-colors duration-700 ${
                                            isHighlighted && flashOn
                                                ? '!bg-yellow-100 ring-2 ring-yellow-400 dark:!bg-yellow-950/40 dark:ring-yellow-600'
                                                : ''
                                        }`}
                                    >
                                        {selectable && (
                                            <TableCell className="border-x px-0.5 text-center [&:has([role=checkbox])]:pr-2">
                                                <Checkbox
                                                    checked={localSelectedIds.includes(
                                                        row.id,
                                                    )}
                                                    onCheckedChange={(
                                                        checked,
                                                    ) =>
                                                        handleSelectRow(
                                                            row.id,
                                                            !!checked,
                                                        )
                                                    }
                                                    aria-label={`Select row ${row.id}`}
                                                    disabled={!canSelect}
                                                />
                                            </TableCell>
                                        )}
                                        {visibleColumnsList.map((column) => (
                                            <TableCell
                                                key={column.id}
                                                className={`border-x ${column.className || ''}`}
                                            >
                                                {column.cell
                                                    ? column.cell(row, index)
                                                    : column.accessorKey
                                                      ? (row[
                                                            column.accessorKey
                                                        ] as any)
                                                      : null}
                                            </TableCell>
                                        ))}
                                        {rowActions && (
                                            <TableCell className="border-x px-0 text-center">
                                                {rowActions(row)}
                                            </TableCell>
                                        )}
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Bottom Pagination. pr-12 clears the assistant's floating button,
                which sits fixed at bottom-right exactly over this bar's "next"
                control on every index page (audit #14). */}
            {!isEmpty && !hidePagination && (
                <div className="mt-2 pr-12">
                    <PaginationBar />
                </div>
            )}

            {/* PATCHED: back-to-top, scrolling `tableContainerRef` rather than the
                window — on an index page the window never scrolls. Mounted here so
                the vendor table and ours behave the same; `DataTable` mounts the
                identical component against its own scroll box. */}
            <ScrollToTop scrollRef={tableContainerRef} />
        </div>
    );
}

export * from './types';
