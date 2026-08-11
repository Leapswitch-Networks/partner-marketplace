"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import Badge from "@/components/common/Badge";
import ErrorState from "@/components/common/ErrorState";
import Skeleton from "@/components/common/Skeleton";
import Toast, { useToast } from "@/components/common/Toast";
import { ShowPageHeader } from "@/components/common/ShowPage";
import { matrixApi, type MatrixRow, type RoleMatrix as Matrix } from "@/lib/api/rbacApi";
import usePermissions from "@/lib/hooks/usePermissions";

/**
 * Roles down, permission groups across, with a granted/total count per cell.
 *
 * **Deliberately not built on `ResourceIndex`.** The plan set this screen as the
 * test of whether the shared layer could host it "without special-casing", and
 * the honest answer is that it should not try. `ResourceIndex` renders one row
 * per record with columns fixed at author time; the matrix's columns *are* the
 * data — 11 today, more as the catalog grows — and it has no filters, no paging,
 * no sorting and no row selection. Forcing it through would mean making every
 * one of those optional for one caller.
 *
 * That is a real finding about the abstraction, not a workaround: `ResourceIndex`
 * is for index pages, and a matrix is not one. It reuses `ShowPageHeader`, which
 * is the part that genuinely generalises.
 *
 * Clicking a cell grants or revokes the whole group. All-or-nothing, because the
 * cell shows a count and a partial state has nothing to render — the same reason
 * the endpoint is all-or-nothing.
 */
export default function RoleMatrix() {
  const { can } = usePermissions();
  const { toasts, show, dismiss } = useToast();

  const [matrix, setMatrix] = useState<Matrix | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await matrixApi.get();
      setMatrix(res.data);
    } catch {
      setError("Could not load the permission matrix.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const editable = can("role-update") && can("role-permissions");

  const toggle = async (row: MatrixRow, groupId: number, granted: boolean) => {
    const key = `${row.role_id}:${groupId}`;
    setBusy(key);
    try {
      await matrixApi.setCell(row.role_id, groupId, granted);
      // Refetch rather than patching locally: the server applies the privilege
      // ceiling, so what it actually granted can be narrower than what was asked
      // for, and an optimistic cell would show a number that is not true.
      await load();
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      show(detail ?? "Could not change that role.", "error");
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !matrix) {
    return (
      <ErrorState
        error={new Error(error ?? "The matrix could not be loaded.")}
        reset={load}
        title="Could not load the permission matrix"
        compact
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ShowPageHeader
        eyebrow="Roles"
        title="Permission matrix"
        description={
          editable
            ? "Click a cell to grant or revoke that whole group for that role."
            : "Read-only — changing grants needs the role-update and role-permissions permissions."
        }
        backHref="/dashboard/roles"
        backLabel="Back to Roles"
      />

      <div className="min-h-0 flex-1 overflow-auto rounded-[5px] border border-brand/20 dark:border-night-border">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 z-10 bg-surface-wash dark:bg-night-card">
            <tr>
              <th className="sticky left-0 z-20 border-b border-r border-brand/20 bg-surface-wash px-3 py-2 font-bold text-ink dark:border-night-border dark:bg-night-card dark:text-gray-100">
                Role
              </th>
              {matrix.groups.map((group) => (
                <th
                  key={group.id}
                  className="border-b border-brand/20 px-2 py-2 text-center font-bold text-ink dark:border-night-border dark:text-gray-100"
                >
                  {/* Vertical would fit more columns but is unreadable; the
                      container scrolls horizontally instead. */}
                  <span className="block max-w-[7rem] truncate" title={group.display_name}>
                    {group.display_name}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {matrix.rows.map((row) => (
              <tr key={row.role_id} className="border-t border-brand/20 dark:border-night-border">
                <th className="sticky left-0 z-10 border-r border-brand/20 bg-surface-wash px-3 py-2 text-left font-medium dark:border-night-border dark:bg-night-card">
                  <Link
                    href={`/dashboard/roles/${row.role_id}`}
                    className="text-ink hover:text-brand dark:text-gray-200 dark:hover:text-brand-on-dark"
                  >
                    {row.display_name}
                  </Link>
                  {row.is_system && (
                    <Badge tone="brand" className="ml-1.5">
                      sys
                    </Badge>
                  )}
                </th>

                {row.cells.map((cell) => {
                  const key = `${row.role_id}:${cell.group_id}`;
                  const all = cell.total > 0 && cell.granted === cell.total;
                  const some = cell.granted > 0 && !all;
                  const tone = all
                    ? "bg-brand text-white"
                    : some
                      ? "bg-brand/25 text-ink dark:text-gray-100"
                      : "text-ink-label dark:text-night-muted";

                  return (
                    <td key={cell.group_id} className="px-1 py-1 text-center">
                      <button
                        type="button"
                        disabled={!editable || busy === key}
                        onClick={() => toggle(row, cell.group_id, !all)}
                        title={
                          editable
                            ? `${all ? "Revoke" : "Grant"} ${cell.total} permissions`
                            : `${cell.granted} of ${cell.total}`
                        }
                        className={`w-full rounded-[4px] px-2 py-1 text-[11px] font-semibold tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${tone} ${
                          editable ? "hover:ring-2 hover:ring-brand/40" : ""
                        }`}
                      >
                        {busy === key ? "…" : `${cell.granted}/${cell.total}`}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Toast toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
