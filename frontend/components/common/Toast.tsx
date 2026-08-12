"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import useHydrated from "@/lib/hooks/useHydrated";
import { createPortal } from "react-dom";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

import { cn } from "@/lib/utils/cn";

export type ToastTone = "success" | "error" | "info";

export interface ToastState {
  /** Assigned by `show`. Callers never construct one of these themselves. */
  id: string;
  message: string;
  tone: ToastTone;
  /** Shown as a bullet list — used for bulk `skipped_reasons`, which must not be swallowed. */
  details?: string[];
}

/**
 * Toast notifications, ported from LeapDesk's custom toast.
 *
 * Read from `LeapReview360/resources/js/components/ui/toast.tsx` and
 * `components/toast-container.tsx` on 2026-08-11 at the owner's request, who
 * wanted that treatment here and the stack moved to the top-right corner.
 *
 * ## Anatomy, kept 1:1
 *
 * | Part | Theirs | Here |
 * |---|---|---|
 * | Position | `fixed top-0 right-0 p-4`, column, `gap-2` | same |
 * | Stack | container maps over an array, newest at the bottom | same |
 * | Panel | `rounded-xl border p-4 shadow-lg`, dark in both themes | same |
 * | Width | `min-w-[380px] max-w-[420px]` | same |
 * | Icon | filled circle, glyph inside at `strokeWidth 3` | same |
 * | Copy | bold tone title, muted message under it | same |
 * | Motion | `translate-x-full opacity-0` ↔ `translate-x-0 opacity-100`, 300ms | same |
 * | Duration | 5000ms, then a 300ms exit before unmount | same |
 * | Pointer | container `pointer-events-none`, panel `pointer-events-auto` | same |
 *
 * ## The three deliberate differences
 *
 * **1. Colours come from tokens, and the panel stays dark in both themes.**
 * Theirs is a hardcoded `zinc-900`/`zinc-800`. A literal copy would fail the
 * brand-colour guard in `UI_PATTERNS.md` — the check that keeps 242 hand-painted
 * colours from creeping back — so the panel is `night-card` on `night-border`,
 * which is the same relationship in our palette. It does **not** flip with the
 * theme, and that is the point: a transient overlay that looks identical
 * everywhere is easier to recognise than one that camouflages itself against
 * whichever page it lands on.
 *
 * The badge fills are picked for that dark panel, not for a white one:
 * `brand-on-dark` rather than `brand`, because `tailwind.config.ts` says outright
 * that brand text and icons on a dark surface must not use the base brand — it is
 * 2.83:1 there. `tone-success` is likewise unusable as a fill here; it is #1b4c43,
 * a dark teal that all but disappears on #111727.
 *
 * **2. A toast carrying `details` does NOT auto-dismiss.** Ours only. Bulk
 * actions report what they skipped and why; auto-hiding that after five seconds
 * turns a partial success into an apparent total one, which is exactly the
 * failure the API's `skipped_reasons` field exists to prevent. Theirs has no
 * equivalent, so there was nothing to copy.
 *
 * **3. Hovering pauses the timer.** Also ours only. A five-second toast with a
 * sentence and three bullets in it can outrun the person reading it, and the
 * cost of getting that wrong is a message nobody ever saw. The timer restarts on
 * leave rather than resuming, which is the forgiving direction to round.
 *
 * ## Note on the title line
 *
 * Theirs renders `{type} notification` — "success notification". Ours says
 * "Success", "Error", "Notice". Same structure, without the word that adds a line
 * of height and no information.
 */

/** LeapDesk's default. Ours was 3500ms, which is short for a full sentence. */
const DURATION_MS = 5000;

/** Matches the CSS transition below. Change both together or a toast unmounts mid-slide. */
const EXIT_MS = 300;

/**
 * Beyond three the column starts running down the page, and a toast nobody can
 * see is not a notification. Oldest is dropped, because the newest message is
 * the one describing what just happened.
 */
const MAX_VISIBLE = 3;

/**
 * Monotonic, so two toasts raised in the same millisecond cannot collide on a
 * React key. A timestamp alone can; `Math.random()` would not collide but would
 * make the ids unreadable in a debugger for no gain.
 */
let nextId = 0;

export function useToast() {
  const [toasts, setToasts] = useState<ToastState[]>([]);

  const show = useCallback(
    (message: string, tone: ToastTone = "success", details?: string[]) => {
      const next: ToastState = { id: `toast-${++nextId}`, message, tone, details };
      setToasts((prev) => [...prev, next].slice(-MAX_VISIBLE));
    },
    []
  );

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, show, dismiss };
}

export default function Toast({
  toasts,
  onDismiss,
}: {
  toasts: ToastState[];
  onDismiss: (id: string) => void;
}) {
  const mounted = useHydrated();

  if (!mounted || toasts.length === 0) return null;

  return createPortal(
    /*
      `pointer-events-none` on the column is not cosmetic. The stack sits over
      the top-right of the page, which is where the navbar keeps the account
      menu — without this, an empty 420px-wide strip would swallow clicks aimed
      at it for five seconds after every save. Each panel opts itself back in.
    */
    <div
      className="pointer-events-none fixed right-0 top-0 z-[70] flex flex-col gap-2 p-4"
      aria-live="polite"
      aria-atomic="false"
    >
      {/*
        `onDismiss` is forwarded as-is and the id is applied inside the item.
        Passing `() => onDismiss(toast.id)` here instead would mint a new function
        on every render of whichever module owns this stack — and those re-render
        constantly — which changes `close`'s identity, which re-runs the
        auto-dismiss effect, which restarts the five seconds. A toast raised on a
        busy screen would simply never leave.
      */}
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>,
    document.body
  );
}

const TONES: Record<
  ToastTone,
  { title: string; badge: string; Icon: typeof CheckCircle2 }
> = {
  success: {
    title: "Success",
    badge: "bg-brand-on-dark text-night-card",
    Icon: CheckCircle2,
  },
  error: {
    title: "Error",
    badge: "bg-tone-danger text-white",
    Icon: AlertCircle,
  },
  // Grey, not blue. Viho's own `info` is grey and `tailwind.config.ts` adopts it
  // that way deliberately — there is no blue in this palette to reach for.
  info: {
    title: "Notice",
    badge: "bg-tone-info text-white",
    Icon: Info,
  },
};

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastState;
  /** `dismiss` from `useToast`, unwrapped — it is a stable `useCallback`. */
  onDismiss: (id: string) => void;
}) {
  /**
   * Two states, because a toast has to animate on the way in as well as out. It
   * mounts off-screen and is slid in on the next frame — set it to its final
   * position on the first render and the browser has no previous value to
   * transition from, so it simply appears.
   */
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Blocked for a toast carrying `details` — see the docblock, difference 2. */
  const autoDismiss = !toast.details?.length;

  // Stable, because `onDismiss` is a `useCallback([])` in the hook and `toast.id`
  // never changes for a mounted item. The auto-dismiss effect below depends on
  // this, so an unstable `close` would keep resetting the countdown.
  const close = useCallback(() => {
    if (exitTimer.current) return; // already leaving; a second click must not queue a second unmount
    setExiting(true);
    exitTimer.current = setTimeout(() => onDismiss(toast.id), EXIT_MS);
  }, [onDismiss, toast.id]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Restarted rather than resumed on every `paused` flip: erring toward giving
  // the reader more time is the harmless direction.
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (!autoDismiss || paused) return;
    const timer = setTimeout(close, DURATION_MS);
    return () => clearTimeout(timer);
  }, [autoDismiss, paused, close]);

  useEffect(
    () => () => {
      if (exitTimer.current) clearTimeout(exitTimer.current);
    },
    []
  );

  const { title, badge, Icon } = TONES[toast.tone];

  return (
    <div
      role={toast.tone === "error" ? "alert" : "status"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className={cn(
        "pointer-events-auto flex min-w-[380px] max-w-[420px] items-start gap-3 rounded-xl border border-night-border bg-night-card p-4 shadow-lg transition-all duration-300 ease-out",
        visible && !exiting ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
      )}
    >
      <span
        aria-hidden="true"
        className={cn("flex size-5 shrink-0 items-center justify-center rounded-full", badge)}
      >
        <Icon className="size-3" strokeWidth={3} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="mb-0.5 text-sm font-semibold text-white">{title}</p>
        <p className="text-sm leading-relaxed text-night-muted">{toast.message}</p>
        {!!toast.details?.length && (
          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-night-muted">
            {toast.details.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={close}
        aria-label="Dismiss notification"
        className="flex size-5 shrink-0 items-center justify-center text-night-muted transition-colors hover:text-white"
      >
        <X className="size-5" />
      </button>
    </div>
  );
}
