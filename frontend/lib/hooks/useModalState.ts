"use client";

import { useCallback, useState } from "react";

/**
 * The `(which dialog, which row)` pair every index module keeps.
 *
 * Two `useState`s and four `setModal(null); setTarget(null);` pairs per module,
 * written out three times. Splitting them is what makes the bug possible: close
 * the dialog but forget the target and the next open flashes the previous row's
 * data for a frame; clear the target but not the mode and the dialog renders
 * against `null`.
 *
 * They move together here, always, so neither can be forgotten.
 *
 * ## Usage
 *
 *     type Mode = "create" | "edit" | "view" | "delete";
 *     const modal = useModalState<Mode, ManagedUser>(initialModal);
 *
 *     modal.open("edit", row);
 *     modal.close();
 *
 *     {modal.is("edit") && modal.target && <UserForm … onDone={modal.close} />}
 *
 * `is()` rather than `mode ===` because the common case is "this dialog, with a
 * row", and `modal.is("edit") && modal.target` reads as one thought.
 *
 * A create dialog has no row, so `open("create")` leaves `target` null — which is
 * exactly what the form reads to tell create from edit.
 */
export function useModalState<M extends string, T>(initial?: M | null) {
  const [mode, setMode] = useState<M | null>(initial ?? null);
  const [target, setTarget] = useState<T | null>(null);

  const open = useCallback((next: M, row?: T | null) => {
    setMode(next);
    setTarget(row ?? null);
  }, []);

  const close = useCallback(() => {
    setMode(null);
    setTarget(null);
  }, []);

  /**
   * Swap dialog while keeping the row — View → Edit on the same record.
   * Distinct from `open`, which would need the row passing in again and is the
   * spelling that drops it.
   */
  const switchTo = useCallback((next: M) => setMode(next), []);

  const is = useCallback((next: M) => mode === next, [mode]);

  return { mode, target, open, close, switchTo, is };
}

export default useModalState;
