"use client";

import { useRef, useState } from "react";
import Button from "@/components/common/Button";
import settingsApi from "@/lib/api/settingsApi";
import type { Branding } from "@/lib/branding";
import { API_BASE_URL } from "@/lib/utils/constants";
import { extractApiError } from "@/lib/utils/apiError";

/**
 * Upload or remove one brand image.
 *
 * **No client-side validation of the file's contents**, on purpose. The type is
 * decided by the server from the file's magic bytes (`core/images.py`), and a
 * duplicate check here would only be a convenience that could disagree with the
 * authority. `accept` on the input is a file-picker filter, not a check — the browser
 * lets a user override it, which is exactly why the server does not trust it.
 *
 * The parent owns the resulting `Branding`, so a successful upload updates the whole
 * form's state and the preview at once rather than this component holding a copy.
 */
export default function BrandAssetUpload({
  asset,
  label,
  hint,
  currentUrl,
  square,
  onChanged,
  onNeedsPassword,
}: {
  asset: "logo" | "favicon";
  label: string;
  hint: string;
  currentUrl: string | null;
  /** Favicons are square and tiny; a logo may be a wide wordmark. */
  square?: boolean;
  onChanged: (branding: Branding) => void;
  /**
   * Called with a retryable thunk when the API demands password confirmation.
   * Lifted to the parent so one prompt serves the whole page rather than three.
   */
  onNeedsPassword: (retry: () => Promise<void>) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<void>) => {
    setError(null);
    setBusy(true);
    try {
      await action();
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } }).response?.status;
      if (status === 403) {
        // 403 with X-Password-Confirmation-Required — not a dead session. Treating it
        // as 401 would sign the user out mid-upload.
        onNeedsPassword(action);
      } else {
        // 413 and 422 both carry a message written for a user: the size limit, or
        // which formats are allowed. Showing it beats a generic failure.
        setError(extractApiError(err, "That upload failed."));
      }
    } finally {
      setBusy(false);
    }
  };

  const upload = (file: File) =>
    run(async () => {
      const form = new FormData();
      form.append("file", file);
      const res = await settingsApi.uploadAsset(asset, form);
      onChanged(res.data);
      // Cleared so re-picking the same file fires `onChange` again — otherwise a
      // failed-then-retried upload of one file looks like nothing happened.
      if (inputRef.current) inputRef.current.value = "";
    });

  const remove = () =>
    run(async () => {
      const res = await settingsApi.deleteAsset(asset);
      onChanged(res.data);
    });

  return (
    <div>
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</p>
      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{hint}</p>

      <div className="mt-3 flex items-center gap-3">
        <div
          className={`flex items-center justify-center overflow-hidden border border-surface-border bg-surface-wash dark:border-night-border dark:bg-night-body ${
            square ? "h-12 w-12" : "h-12 w-24"
          }`}
        >
          {currentUrl ? (
            // A plain <img> rather than `next/image` — see BrandMark for the reasoning.
            // The directive must be the LAST line before the element or ESLint applies
            // it to the comment instead.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`${API_BASE_URL}${currentUrl}`}
              alt={`Current ${asset}`}
              className="h-full w-full object-contain p-1"
            />
          ) : (
            <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
              None
            </span>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? "Working…" : currentUrl ? "Replace" : "Upload"}
          </Button>
          {currentUrl && (
            <Button variant="outline" disabled={busy} onClick={remove}>
              Remove
            </Button>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          className="hidden"
          // A picker filter only. The server decides from the bytes.
          accept={
            asset === "favicon"
              ? "image/svg+xml,image/png,image/x-icon,.svg,.ico"
              : "image/svg+xml,image/png,image/jpeg,image/webp,.svg"
          }
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
        />
      </div>

      {error && (
        <p className="mt-2 text-sm text-tone-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
