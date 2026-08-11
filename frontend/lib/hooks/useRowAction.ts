"use client";

import { useCallback, useState } from "react";

import { extractApiError } from "@/lib/utils/apiError";

/**
 * Runs a per-row write: marks that row busy, applies the returned record, and
 * reports the outcome through the toast.
 *
 * The shape every module had already written by hand — `setBusy(id)`, a
 * try/catch that patches the row on success and shows `extractApiError` on
 * failure, and a `finally` that clears busy.
 *
 * ## Why `busy` is an id and not a boolean
 *
 * It disables the one row being written, not the whole table. A boolean would
 * either freeze every row while one status toggles, or freeze none and let the
 * same row be clicked twice — and the second click on a toggle sends it straight
 * back, which reads as the action having silently failed.
 *
 * ## Usage
 *
 *     const { busy, run } = useRowAction<ManagedUser>({ onSuccess: list.patchRow, show });
 *
 *     run(user.id, () => adminApi.approveUser(user.id), `${user.full_name} approved.`);
 *
 * and in a row action: `disabled: busy === row.id`.
 */
export function useRowAction<T>({
  onSuccess,
  show,
  errorFallback = "Action failed.",
}: {
  /** Given the record the write returned. Normally `list.patchRow`. */
  onSuccess: (next: T) => void;
  show: (message: string, tone?: "success" | "error" | "info", details?: string[]) => void;
  errorFallback?: string;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  const run = useCallback(
    async (id: string, action: () => Promise<{ data: T }>, successMessage: string) => {
      setBusy(id);
      try {
        const res = await action();
        onSuccess(res.data);
        show(successMessage);
      } catch (err) {
        show(extractApiError(err, errorFallback), "error");
      } finally {
        setBusy(null);
      }
    },
    [onSuccess, show, errorFallback]
  );

  return { busy, run, setBusy };
}

/** What every bulk endpoint answers with. Mirrors the API's bulk response. */
export interface BulkResult {
  affected: number;
  skipped: number;
  skipped_reasons?: string[];
  message: string;
}

/**
 * Runs a bulk write over the current selection.
 *
 * **The rule this exists to keep**: a partial success must never read as a total
 * one. The API answers with `affected`, `skipped` and `skipped_reasons`
 * specifically so the UI can say what it did not do — and a toast carrying
 * `details` does not auto-dismiss, so those reasons stay on screen until they are
 * read. Every module reimplementing this is a chance for one of them to show
 * `message` and drop `skipped_reasons`, at which point "12 users updated" is a
 * lie about the 3 it skipped.
 *
 * The selection is cleared and the list refetched only when something actually
 * changed. Clearing on a zero-effect call would lose the user's selection and
 * give them nothing for it.
 */
export function useBulkAction({
  show,
  onChanged,
  clearSelection,
  errorFallback = "Bulk action failed.",
}: {
  show: (message: string, tone?: "success" | "error" | "info", details?: string[]) => void;
  onChanged: () => void;
  clearSelection: () => void;
  errorFallback?: string;
}) {
  const [busy, setBusy] = useState(false);

  const run = useCallback(
    async (action: () => Promise<{ data: BulkResult }>) => {
      setBusy(true);
      try {
        const { affected, skipped, skipped_reasons, message } = (await action()).data;
        show(
          message,
          skipped > 0 ? "info" : "success",
          skipped > 0 ? skipped_reasons : undefined
        );
        if (affected > 0) {
          clearSelection();
          onChanged();
        }
      } catch (err) {
        show(extractApiError(err, errorFallback), "error");
      } finally {
        setBusy(false);
      }
    },
    [show, onChanged, clearSelection, errorFallback]
  );

  return { busy, run };
}

export default useRowAction;
