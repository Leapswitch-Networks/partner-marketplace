"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils/cn";

/**
 * The reference's QMAS "Send Quote via Email" dialog, ported as a reusable shell.
 *
 * Read from `app-modules/qmas/resources/js/pages/Quotes/Index.tsx` (the email
 * modal at ~L2841) on 2026-08-10 at the owner's request, who wanted that exact
 * treatment for the Users create / edit / view flows.
 *
 * ## Anatomy, kept 1:1
 *
 * | Part | Theirs | Here |
 * |---|---|---|
 * | Overlay | `bg-black/10 backdrop-blur-[1px]`, click closes | same |
 * | Panel | `max-w-2xl rounded-xl border bg-card shadow-2xl` | same |
 * | Header | icon tile + title + subtitle, `X` close, `border-b` | same |
 * | Body | `overflow-y-auto p-6`, capped at `60vh` | same |
 * | Footer | `justify-end gap-3 rounded-b-xl border-t bg-muted px-6 py-3` | same |
 *
 * **The one deliberate change is the icon tile's colour.** Theirs is a hardcoded
 * palette blue; a literal copy would fail the brand-colour guard in
 * `UI_PATTERNS.md`, which is the check that keeps 242 hand-painted colours from
 * creeping back — and that guard is a grep, so it cannot tell code from prose,
 * which is why the classes are not quoted here. It is `bg-brand/10` +
 * `text-brand`, Viho's tinted-tile pattern and the same one `Input`'s `addon` uses.
 *
 * ## Why this is not `Modal`
 *
 * `Modal` already exists and is the right shell for a **confirmation**: narrow,
 * compact header, no scroll region. This one is for a **form** — it is wider,
 * has a scrolling body with a viewport cap, and carries the icon/subtitle
 * header. Merging them would give one component two layouts and a boolean to
 * pick between them, which is how a primitive becomes a fork with extra steps.
 *
 * Escape closes, the backdrop closes, and body scroll is locked — all three
 * matching `Modal`, because a second set of dialog conventions in one app is
 * worse than a second dialog.
 */
export default function FormModal({
  open,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  size = "lg",
  /** Blocks Escape and backdrop clicks — for a dialog with unsaved edits. */
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  /** Sits in the brand-tinted tile. Pass an SVG sized `h-5 w-5`. */
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg" | "xl";
  dismissible?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose, dismissible]);

  if (!open) return null;

  /**
   * The cap grows with the viewport, because a dialog frozen at 672px on a
   * 1920px screen leaves two thirds of the width unused and pushes the form into
   * a scroll it does not need.
   *
   *  | size | ≤1279px | ≥1280px (`xl`) | ≥1536px (`2xl`) |
   *  |---|---|---|---|
   *  | `md` | 448 | 448 | 448 |
   *  | `lg` | 672 | 768 | 896 |
   *  | `xl` | 896 | 1024 | 1152 |
   *
   * **`md` deliberately does not grow.** It is the confirmation size — one
   * sentence and two buttons. Stretching that to 900px puts the question at the
   * far left and the buttons at the far right with nothing between them, which
   * is harder to read than the narrow version, not easier. Width is only worth
   * taking when there is content to put in it.
   *
   * The steps stop at `2xl` rather than continuing, because past roughly 900px a
   * two-column form's fields are already wider than any of their values. The way
   * to use more width than this is more columns, not longer inputs — see the
   * card grid in `UserShow`'s modal body for that shape.
   */
  const widths = {
    md: "max-w-md",
    lg: "max-w-2xl xl:max-w-3xl 2xl:max-w-4xl",
    xl: "max-w-4xl xl:max-w-5xl 2xl:max-w-6xl",
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Their overlay is deliberately light — `black/10` with a 1px blur —
          so the table stays legible behind the dialog rather than going dark. */}
      <button
        type="button"
        aria-label="Close"
        className="fixed inset-0 cursor-default bg-black/10 backdrop-blur-[1px]"
        onClick={() => dismissible && onClose()}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative mx-auto flex w-full flex-col rounded-xl border border-brand/20 bg-surface-card shadow-2xl dark:border-night-border dark:bg-night-card",
          widths[size]
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 rounded-t-xl border-b border-brand/20 px-6 py-3 dark:border-night-border">
          <div className="flex min-w-0 items-center gap-3">
            {icon && (
              <span
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand dark:bg-brand/20 dark:text-brand-on-dark"
              >
                {icon}
              </span>
            )}
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold text-ink dark:text-white">{title}</h2>
              {subtitle && (
                <p className="truncate text-sm text-ink-label dark:text-night-muted">{subtitle}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="shrink-0 text-ink-label transition-colors hover:text-ink dark:text-night-muted dark:hover:text-white"
          >
            <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 60vh, theirs exactly: tall enough for a real form, short enough that
            the header and footer stay on screen on a laptop. */}
        <div className="overflow-y-auto p-6 scrollbar-thin" style={{ maxHeight: "60vh" }}>
          {children}
        </div>

        {footer && (
          <div className="flex shrink-0 items-center justify-end gap-3 rounded-b-xl border-t border-brand/20 bg-surface-tile px-6 py-3 dark:border-night-border dark:bg-night-body">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
