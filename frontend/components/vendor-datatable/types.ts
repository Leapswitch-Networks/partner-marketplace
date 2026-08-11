import { ReactNode } from 'react';

/**
 * PATCHED 2026-08-10. Upstream types row identity as `number`, because the
 * reference's models use bigint primary keys. Ours are UUID strings
 * (`users.id` is `String(36)`), so every id here is widened. Comparison and
 * `includes` behave identically for strings — this is a type change, not a
 * behaviour change.
 */
export type RowId = string | number;

export interface ColumnDef<T = any> {
    id: string;
    header: string | ReactNode;
    accessorKey?: keyof T;
    cell?: (row: T, index: number) => ReactNode;
    sortable?: boolean;
    className?: string;
    headerClassName?: string;
    enableHiding?: boolean;
}

export interface PaginationData {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number;
    to: number;
    data: any[];
    links: PaginationLink[];
}

export interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

export interface DataTableProps<T = any> {
    columns: ColumnDef<T>[];
    data: PaginationData;
    selectable?: boolean;
    isRowSelectable?: (row: T) => boolean;
    onRowSelect?: (selectedIds: RowId[]) => void;
    selectedIds?: RowId[];
    bulkActions?: (
        selectedIds: RowId[],
        clearSelection: () => void,
    ) => ReactNode;
    rowActions?: (row: T) => ReactNode;
    emptyState?: ReactNode;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    onSort?: (column: string) => void;
    onPageChange?: (url: string) => void;
    onPerPageChange?: (perPage: number) => void;
    perPage?: number;
    className?: string;
    hideColumnToggle?: boolean;
    hidePagination?: boolean;
    hideTopPagination?: boolean;
    headerRowClassName?: string;
    /**
     * Render at natural content height instead of capping to the viewport.
     * Use when the table is embedded in an already-scrollable container (e.g.
     * a dashboard) so it doesn't create a nested vertical scrollbar.
     */
    fitContent?: boolean;
    /**
     * Fixed cap for the scroll container (any CSS length — prefer `rem` so it
     * scales with the root font ladder). Rows scroll inside it while the header
     * stays pinned, and the page behind does not move.
     *
     * Use for a table embedded in an already-scrolling page (e.g. a dashboard
     * card), where the default viewport-relative sizing would measure the wrong
     * thing. Takes precedence over `fitContent`.
     */
    maxBodyHeight?: string;
}
