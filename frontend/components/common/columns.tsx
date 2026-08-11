"use client";

import type { ReactNode } from "react";

import Badge, { type BadgeTone } from "@/components/common/Badge";
import type { Column } from "@/components/common/DataTable";
import RowActions, { type RowAction } from "@/components/common/RowActions";
import { formatDate, formatDateTime } from "@/lib/utils/format";

/**
 * Column factories for the standard index-table columns.
 *
 * `UI_PATTERNS.md` fixes the column order — `#`, `Actions`, `Status`, then data —
 * so every module writes the same three columns before it writes anything of its
 * own. They were being written out longhand in each one, and **had already drifted
 * into two different bugs and three different colours**:
 *
 * | | `#` numbering | ink |
 * |---|---|---|
 * | Users | `index + 1` on a table that passes a page-local index — restarted at 1 on page 2 | `text-gray-400` |
 * | Invitations | page offset added to an index that already had it — jumped to 51 on page 2 | `text-ink-label` |
 * | Roles | correct, by luck of using the other table | `text-gray-400` |
 *
 * Neither bug is visible until you click to page 2, which is why both survived
 * review. That is the argument for this file: not that the code was long, but
 * that four copies of a thing are four chances to get it subtly wrong, and no
 * amount of care catches it.
 *
 * ## How to use these
 *
 * Spread them into the array in the mandated order, then add your own columns:
 *
 *     const columns = useMemo<Column<Widget>[]>(() => [
 *       numberColumn(),
 *       actionsColumn((row) => [
 *         { label: "View", onSelect: () => open("view", row) },
 *         { label: "Delete", destructive: true, visible: row.can_delete, onSelect: … },
 *       ]),
 *       badgeColumn({ id: "status", header: "Status", tone: (r) => …, label: (r) => … }),
 *       { id: "name", header: "Name", sortKey: "name", cell: (r) => r.name },
 *       dateColumn({ id: "created", header: "Created", sortKey: "created_at", value: (r) => r.created_at }),
 *     ], [open]);
 *
 * Every factory returns a plain `Column<T>`, so anything it does not cover is
 * overridden by spreading: `{ ...numberColumn(), headerClassName: "w-16" }`.
 *
 * **Cells must not set a font size.** The table owns it (`text-xs 2xl:text-sm`);
 * a cell that sets its own is what made the Status and Role columns render a
 * pixel smaller than the ones beside them. Rank with weight and colour instead.
 */

/**
 * The `#` column.
 *
 * Not hideable and as narrow as the digits allow, per `UI_PATTERNS.md` — `#` and
 * `Actions` give their room to the data columns.
 *
 * The number is `index + 1` and nothing else, because `Column.cell` guarantees
 * `index` is the row's absolute position in the result set. Do not add the page
 * offset here; that is what Invitations did, on top of an index that already
 * carried it.
 */
export function numberColumn<T>(): Column<T> {
  return {
    id: "number",
    header: "#",
    cell: (_row, index) => (
      <span className="tabular-nums text-ink-label dark:text-night-muted">{index + 1}</span>
    ),
    className: "text-center px-0.5",
    headerClassName: "w-10 text-center px-0.5",
    hideable: false,
  };
}

/**
 * The `Actions` column — a centred three-dot menu.
 *
 * `getActions` is called per row and receives the row, so entries can be gated on
 * that row's `can_*` flags. `RowActions` drops anything with `visible: false`, so
 * pass the flag straight through rather than building the array conditionally —
 * a menu must never offer an action the API will refuse.
 *
 * `!px-0 w-0` is deliberate and beats the table's cell padding: the menu is a
 * fixed-width glyph, and any padding here is width taken from the data columns.
 */
export function actionsColumn<T>(getActions: (row: T) => RowAction[]): Column<T> {
  return {
    id: "actions",
    header: "Actions",
    cell: (row) => (
      <div className="flex justify-center">
        <RowActions actions={getActions(row)} />
      </div>
    ),
    className: "text-center !px-0 w-0",
    headerClassName: "text-center !px-0 w-0",
    hideable: false,
  };
}

/**
 * A centred `Badge` column — status, type, any small closed set of values.
 *
 * Pass `onClick` to make the badge a control. It then renders as a real
 * `<button>`, which is the only reason to prefer this over a plain cell: a
 * clickable `<span>` cannot be reached with a keyboard.
 *
 * Return `undefined` from `onClick` for a given row to leave that row's badge
 * inert — that is how "you may not change this one" is expressed, rather than by
 * rendering a control that errors when used.
 */
export function badgeColumn<T>({
  id,
  header,
  sortKey,
  tone,
  label,
  onClick,
  title,
  disabled,
  width = "w-[130px]",
}: {
  id: string;
  header: ReactNode;
  sortKey?: string;
  tone: (row: T) => BadgeTone;
  label: (row: T) => ReactNode;
  onClick?: (row: T) => (() => void) | undefined;
  title?: (row: T) => string | undefined;
  disabled?: (row: T) => boolean;
  /** Header width. Give a badge column a fixed one so it stops jittering between fetches. */
  width?: string;
}): Column<T> {
  return {
    id,
    header,
    sortKey,
    cell: (row) => (
      <div className="flex justify-center">
        <Badge
          tone={tone(row)}
          onClick={onClick?.(row)}
          title={title?.(row)}
          disabled={disabled?.(row)}
        >
          {label(row)}
        </Badge>
      </div>
    ),
    className: "text-center",
    headerClassName: `text-center ${width}`,
  };
}

/**
 * A date column — `tabular-nums` so the digits line up down the page, and
 * `whitespace-nowrap` so a date never wraps into two lines and grows the row.
 *
 * `fallback` is worth thinking about rather than leaving at the em dash. "Never"
 * on a last-login column states a fact; "—" reads as missing data. They are
 * different things and the column should say which one it means.
 */
export function dateColumn<T>({
  id,
  header,
  sortKey,
  value,
  fallback = "—",
  withTime = false,
  title,
}: {
  id: string;
  header: ReactNode;
  sortKey?: string;
  value: (row: T) => string | Date | null | undefined;
  fallback?: string;
  /** `7 Aug 2026, 6:55 pm` instead of `7 Aug 2026` — for audit rows and sessions. */
  withTime?: boolean;
  /**
   * Tooltip. The audit log uses it to expose the exact ISO instant behind a
   * humanised date — the formatted value drops seconds and the timezone, which
   * are the two things you want when reconstructing what happened.
   */
  title?: (row: T) => string | undefined;
}): Column<T> {
  const format = withTime ? formatDateTime : formatDate;
  return {
    id,
    header,
    sortKey,
    cell: (row) => (
      <span
        className="whitespace-nowrap tabular-nums text-ink-label dark:text-night-muted"
        title={title?.(row)}
      >
        {format(value(row), fallback)}
      </span>
    ),
  };
}

/**
 * A two-line cell: a primary value with supporting detail under it.
 *
 * The pattern the User column uses — name over designation. Both lines take the
 * table's font size; the ranking is `font-semibold` against a lighter ink, never
 * a smaller size.
 */
export function stackedCell(primary: ReactNode, secondary?: ReactNode): ReactNode {
  return (
    <div className="min-w-0">
      <p className="truncate font-semibold text-ink dark:text-gray-100">{primary}</p>
      {secondary && (
        <p className="truncate text-ink-label dark:text-night-muted">{secondary}</p>
      )}
    </div>
  );
}
