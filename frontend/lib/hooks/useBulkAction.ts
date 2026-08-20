"use client";

import { useCallback, useState } from "react";

import { extractApiError } from "@/lib/utils/apiError";

/*
  Split out of `useRowAction.ts` on 2026-08-20. That file held two hooks; PM-41
  § 4.5 retired the per-row one — `invalidatesTags` took over its job of applying
  the record a write returned — and this one survived on its own merits, so it
  moved rather than sitting in a file named after a deleted function.

  Why it survived the conversion: its value was never the fetching. It is the
  rule below about partial success, which no cache layer has an opinion about.
*/

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

export default useBulkAction;
