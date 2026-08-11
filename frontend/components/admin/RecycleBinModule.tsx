"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import Badge from "@/components/common/Badge";
import Button from "@/components/common/Button";
import { Card, CardContent, CardHeader } from "@/components/common/Card";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import ErrorState from "@/components/common/ErrorState";
import FilterCombobox from "@/components/common/FilterCombobox";
import Skeleton from "@/components/common/Skeleton";
import Toast, { useToast } from "@/components/common/Toast";
import { navIcon } from "@/components/dashboard/navIcons";
import recycleBinApi, { type BinnedItem } from "@/lib/api/recycleBinApi";
import useModalState from "@/lib/hooks/useModalState";
import { extractApiError } from "@/lib/utils/apiError";
import { formatDateTime } from "@/lib/utils/format";

/**
 * Recycle Bin — restore or permanently remove deleted records.
 *
 * **Not `ResourceIndex`.** Rows here are not compared against one another; you
 * arrive knowing what you deleted and looking for it. `UI_PATTERNS.md` § The
 * module CRUD contract allows this — *parity means the same vocabulary, not the
 * same feature list* — and the reference does not use a table here either.
 *
 * ## Restore is the quiet action; purge is not
 *
 * Restore happens on one click with no confirmation: it is **reversible** — you
 * can delete the thing again — and a dialog in front of an undo button is
 * friction protecting nothing.
 *
 * Purge confirms, names the record, and says plainly that it cannot be undone,
 * because it is **the only irreversible delete left in the core**. Everything
 * else now lands here first.
 */
const ALL_TYPES = "";

export default function RecycleBinModule() {
  const { toasts, show, dismiss } = useToast();

  const [items, setItems] = useState<BinnedItem[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [types, setTypes] = useState<{ value: string; label: string }[]>([]);
  const [typeFilter, setTypeFilter] = useState(ALL_TYPES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const modal = useModalState<"purge", BinnedItem>();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await recycleBinApi.list();
      setItems(res.data.items);
      setCounts(res.data.counts);
      setTypes(res.data.types);
    } catch (err) {
      setError(extractApiError(err, "Could not load the recycle bin."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Filtered in the browser: the whole bin is already here, and re-fetching to
  // hide rows would be a round trip that buys nothing. The API takes `?type=`
  // anyway, for a caller that wants one type without the rest.
  const visible = useMemo(
    () => (typeFilter ? items.filter((i) => i.type === typeFilter) : items),
    [items, typeFilter]
  );

  const total = items.length;

  const restore = async (item: BinnedItem) => {
    setBusy(`${item.type}:${item.id}`);
    try {
      const res = await recycleBinApi.restore(item.type, item.id);
      show(res.data.message);
      await load();
    } catch (err) {
      show(extractApiError(err, "Could not restore that record."), "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Card bordered={false}>
        <CardHeader
          icon={navIcon("recycleBin")}
          title="Recycle Bin"
          description="Deleted records, recoverable until they are purged. Restoring is safe; purging is not."
        />

        <CardContent>
          <div className="flex shrink-0 flex-wrap items-center gap-2 pb-3">
            <div className="w-[240px]">
              <FilterCombobox
                options={types.map((t) => ({
                  value: t.value,
                  label: `${t.label} (${counts[t.value] ?? 0})`,
                }))}
                value={typeFilter}
                onChange={setTypeFilter}
                placeholder={`All types (${total})`}
                searchPlaceholder="Search types..."
                label="Filter by record type"
              />
            </div>
          </div>

          <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
            {loading && (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            )}

            {!loading && error && (
              <ErrorState
                error={new Error(error)}
                reset={load}
                title="Could not load the recycle bin"
                compact
              />
            )}

            {!loading && !error && visible.length === 0 && (
              <div className="py-12 text-center">
                <p className="text-sm font-semibold text-ink dark:text-gray-200">
                  {/* An empty bin is good news and reads as such — not as an
                      error, and not as "no results for your filter" unless one
                      is actually applied. */}
                  {typeFilter ? "Nothing deleted of this type" : "The recycle bin is empty"}
                </p>
                <p className="mt-2 text-xs text-ink-label dark:text-night-muted">
                  Deleted users, invitations, grants and search entities appear here.
                </p>
              </div>
            )}

            {!loading && !error && visible.length > 0 && (
              <div className="flex flex-col gap-2">
                {visible.map((item) => {
                  const key = `${item.type}:${item.id}`;
                  return (
                    <div
                      key={key}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-[5px] border border-brand/20 bg-white p-3 dark:border-night-border dark:bg-night-card"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-semibold text-ink dark:text-gray-100">
                            {item.label}
                          </span>
                          <Badge tone="neutral">{item.type_label}</Badge>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-ink-label dark:text-night-muted">
                          {item.subtitle && `${item.subtitle} · `}
                          deleted {formatDateTime(item.deleted_at)}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        {/* No confirmation: restoring is reversible, and a dialog
                            in front of an undo button is friction protecting
                            nothing. */}
                        <Button
                          size="sm"
                          variant="outline"
                          loading={busy === key}
                          disabled={busy !== null}
                          onClick={() => void restore(item)}
                        >
                          Restore
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={busy !== null}
                          onClick={() => modal.open("purge", item)}
                        >
                          Delete forever
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {modal.is("purge") && modal.target && (
        <ConfirmDialog
          title="Delete forever"
          subtitle={modal.target.type_label}
          confirmLabel="Delete forever"
          busyLabel="Deleting…"
          errorFallback="Could not delete that record."
          onConfirm={() => recycleBinApi.purge(modal.target!.type, modal.target!.id)}
          onConfirmed={() => {
            const label = modal.target!.label;
            modal.close();
            show(`${label} permanently deleted.`);
            void load();
          }}
          onClose={modal.close}
        >
          Permanently delete{" "}
          <span className="font-semibold text-ink dark:text-gray-100">{modal.target.label}</span>?
          {/* Stated because it is the one delete in the product with no undo,
              and the alternative — leaving it here — costs nothing. */}
          <p className="mt-2 text-xs text-ink-label dark:text-night-muted">
            This cannot be undone. It is the only irreversible delete in the system — everything
            else lands in this bin first. Leaving it here costs nothing.
          </p>
        </ConfirmDialog>
      )}

      <Toast toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
