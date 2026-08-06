"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface RowAction {
  label: string;
  onSelect: () => void;
  /** Renders in red and is grouped last — use for delete. */
  destructive?: boolean;
  /** Hidden entirely when false. Pass the row's `can_*` flag. */
  visible?: boolean;
  disabled?: boolean;
  hint?: string;
}

/**
 * Three-dot row menu.
 *
 * The dropdown is portalled to `document.body` and positioned from the trigger's
 * rect, because the table container has `overflow-auto` — a menu rendered inside
 * a row would be clipped by it.
 *
 * Actions with `visible: false` are dropped, so the caller passes the row's
 * `can_*` flags straight through and the menu never offers a forbidden action.
 */
export default function RowActions({ actions }: { actions: RowAction[] }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    // Any scroll invalidates the measured position, so close rather than drift.
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const available = actions.filter((a) => a.visible !== false);
  if (available.length === 0) {
    return <span className="text-gray-300 dark:text-gray-600">—</span>;
  }

  const toggle = () => {
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) {
      const width = 176;
      setCoords({
        top: rect.bottom + 4,
        // Keep the menu on screen when the row is near the right edge.
        left: Math.min(rect.right - width, window.innerWidth - width - 8),
      });
    }
    setOpen((o) => !o);
  };

  const ordered = [
    ...available.filter((a) => !a.destructive),
    ...available.filter((a) => a.destructive),
  ];

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Row actions"
        className="flex h-7 w-7 items-center justify-center rounded-[5px] text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="12" cy="19" r="1.8" />
        </svg>
      </button>

      {open &&
        mounted &&
        createPortal(
          <>
            <button
              type="button"
              aria-label="Close menu"
              className="fixed inset-0 z-[60] cursor-default"
              onClick={() => setOpen(false)}
            />
            <div
              role="menu"
              style={{ top: coords.top, left: coords.left }}
              className="fixed z-[61] w-44 overflow-hidden rounded-[5px] border border-surface-border bg-white py-1 shadow-lg dark:border-night-border dark:bg-night-card"
            >
              {ordered.map((action, i) => {
                const isFirstDestructive =
                  action.destructive && !ordered[i - 1]?.destructive && i > 0;
                return (
                  <div key={action.label}>
                    {isFirstDestructive && (
                      <div className="my-1 border-t border-surface-border dark:border-night-border" />
                    )}
                    <button
                      type="button"
                      role="menuitem"
                      disabled={action.disabled}
                      title={action.hint}
                      onClick={() => {
                        setOpen(false);
                        action.onSelect();
                      }}
                      className={`block w-full px-3 py-2 text-left text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                        action.destructive
                          ? "text-tone-danger hover:bg-tone-danger/10 dark:text-tone-danger dark:hover:bg-tone-danger/15"
                          : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
                      }`}
                    >
                      {action.label}
                    </button>
                  </div>
                );
              })}
            </div>
          </>,
          document.body
        )}
    </>
  );
}
