"use client";

import { useEffect, type ReactNode } from "react";
import useHydrated from "@/lib/hooks/useHydrated";
import { createPortal } from "react-dom";

/**
 * Portal-mounted modal.
 *
 * Rendered into `document.body` so it overlays the whole viewport rather than
 * being clipped by the dashboard's `overflow-hidden` panel — a modal rendered
 * in place inside that panel gets cut off.
 *
 * Closes on Escape and on backdrop click, and locks body scroll while open.
 */
export default function Modal({
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = "md",
}: {
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg" | "xl";
}) {
  const mounted = useHydrated();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  if (!mounted) return null;

  /**
   * Same responsive caps as `FormModal`, and they must stay in step — a Send
   * Email dialog and an Edit User dialog opened from the same table should not
   * be different widths on the same screen. See the table in that file.
   *
   * `md` stays fixed at 448px, which matters more here than there: `md` is this
   * shell's default and `ConfirmDialog` is its main caller. A delete
   * confirmation is one sentence; widening it separates the question from the
   * button that answers it.
   */
  const widths = {
    md: "max-w-md",
    lg: "max-w-2xl xl:max-w-3xl 2xl:max-w-4xl",
    xl: "max-w-4xl xl:max-w-5xl 2xl:max-w-6xl",
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 cursor-default bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={`relative flex max-h-[90vh] w-full ${widths[size]} flex-col overflow-hidden rounded-none bg-white shadow-2xl ring-1 ring-surface-border dark:bg-night-card dark:ring-night-border`}
      >
        <div className="flex shrink-0 items-start justify-between border-b border-surface-border px-5 py-4 dark:border-night-border">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">{title}</h3>
            {subtitle && (
              <p className="mt-0.5 truncate text-[11px] text-gray-400 dark:text-gray-500">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="ml-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-[5px] text-gray-400 transition-colors hover:bg-gray-100 dark:text-gray-500 dark:hover:bg-gray-800"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 scrollbar-thin">{children}</div>

        {footer && (
          <div className="flex shrink-0 justify-end gap-2 border-t border-surface-border px-5 py-3 dark:border-night-border">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
