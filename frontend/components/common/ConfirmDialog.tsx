"use client";

import { useState, type ReactNode } from "react";

import Button from "@/components/common/Button";
import Modal from "@/components/common/Modal";
import { extractApiError } from "@/lib/utils/apiError";

/**
 * Confirm-then-act dialog — the convention for every destructive action.
 *
 * `UI_PATTERNS.md` § Pending listed *"no toast/confirm convention for destructive
 * actions … improvised per screen today"*, and it was right: Users and Roles each
 * carried their own delete modal, and the two had drifted in four ways — different
 * button padding (`px-5 py-2.5` vs the primitive's `px-7 py-1.5`), different
 * disabled opacity, a hand-copied error banner, and `hover:bg-tone-danger` on a
 * `bg-tone-danger` button, which is not a hover state at all. Every new module
 * would have made a third copy.
 *
 * ## What it owns, and why that is the useful split
 *
 * The dialog owns the parts that were being got wrong: the in-flight flag, the
 * error message, and disabling the button while the request is running. The caller
 * owns only what is genuinely per-action — the words, and the promise.
 *
 * `onConfirm` is **awaited**, and a rejection is caught and rendered in place
 * rather than closing the dialog. That is the behaviour worth standardising: a
 * failed delete that closed its own dialog would look exactly like a successful
 * one, and the row would still be there after the refresh with no explanation.
 * `onConfirmed` fires only after `onConfirm` resolves.
 *
 * ```tsx
 * <ConfirmDialog
 *   title="Delete user"
 *   subtitle={user.email}
 *   confirmLabel="Delete user"
 *   onConfirm={() => adminApi.deleteUser(user.id)}
 *   onConfirmed={() => { show(`${user.full_name} deleted.`); refresh(); }}
 *   onClose={close}
 * >
 *   Permanently delete <strong>{user.full_name}</strong>? This cannot be undone.
 * </ConfirmDialog>
 * ```
 */
export default function ConfirmDialog({
  title,
  subtitle,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  busyLabel,
  tone = "danger",
  confirmDisabled = false,
  errorFallback = "The action could not be completed.",
  onConfirm,
  onConfirmed,
  onClose,
}: {
  title: string;
  subtitle?: string;
  /** The question, and any warning that belongs with it. */
  children: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Defaults to `"{confirmLabel}…"`, which reads correctly for verb labels. */
  busyLabel?: string;
  /** `danger` for anything irreversible; `primary` for a confirmation that merely wants a beat. */
  tone?: "danger" | "primary";
  /**
   * Blocks the action while a precondition fails — a role that still has holders,
   * for instance. Explain why in `children`; a disabled button with no reason is
   * indistinguishable from a broken one.
   */
  confirmDisabled?: boolean;
  errorFallback?: string;
  onConfirm: () => Promise<unknown>;
  onConfirmed?: () => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      onConfirmed?.();
    } catch (err) {
      // Stays open, showing why. See the note above.
      setError(extractApiError(err, errorFallback));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      footer={
        <>
          <Button variant="outline" onClick={onClose} type="button" disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone}
            type="button"
            onClick={confirm}
            loading={busy}
            disabled={confirmDisabled}
          >
            {busy ? (busyLabel ?? `${confirmLabel}…`) : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm text-gray-600 dark:text-gray-400">{children}</div>

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-[5px] border border-tone-danger/40 bg-tone-danger/10 px-3 py-2 text-sm text-tone-danger dark:border-tone-danger/50 dark:bg-tone-danger/15"
        >
          {error}
        </p>
      )}
    </Modal>
  );
}
