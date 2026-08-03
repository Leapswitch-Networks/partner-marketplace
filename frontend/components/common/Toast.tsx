"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type ToastTone = "success" | "error" | "info";

export interface ToastState {
  message: string;
  tone: ToastTone;
  /** Shown as a bullet list — used for bulk `skipped_reasons`, which must not be swallowed. */
  details?: string[];
}

/**
 * Minimal toast, with one behaviour that matters: a toast carrying `details`
 * does NOT auto-dismiss.
 *
 * Bulk actions report what they skipped and why. Auto-hiding that after three
 * seconds turns a partial success into an apparent total one, which is exactly
 * the failure the API's `skipped_reasons` exists to prevent.
 */
export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((message: string, tone: ToastTone = "success", details?: string[]) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ message, tone, details });
    if (!details?.length) {
      timer.current = setTimeout(() => setToast(null), 3500);
    }
  }, []);

  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setToast(null);
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return { toast, show, dismiss };
}

export default function Toast({
  toast,
  onDismiss,
}: {
  toast: ToastState | null;
  onDismiss: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!toast || !mounted) return null;

  const tones: Record<ToastTone, string> = {
    success:
      "border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-300",
    error:
      "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300",
    info: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300",
  };

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-5 right-5 z-[70] max-w-sm rounded-xl border px-4 py-3 shadow-lg ${tones[toast.tone]}`}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold">{toast.message}</p>
          {!!toast.details?.length && (
            <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-[11px] opacity-90">
              {toast.details.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="shrink-0 opacity-60 transition-opacity hover:opacity-100"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>,
    document.body
  );
}
