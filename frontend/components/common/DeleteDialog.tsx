"use client";

import type { ReactNode } from "react";

import ConfirmDialog from "@/components/common/ConfirmDialog";

/**
 * The delete confirmation, with its wording supplied.
 *
 * `ConfirmDialog` already owns the mechanics — the in-flight flag, the error
 * rendered in place, the dialog staying open on failure. What was still being
 * retyped per module is the *copy*, and copy is what drifts: "Delete user" /
 * "Delete user" / "Delete role" / "Delete role permanently", four spellings of
 * one sentence, each written by whoever added the module.
 *
 * This fixes the sentence and asks for the two words that actually differ.
 *
 *     <DeleteDialog
 *       noun="user"
 *       name={target.full_name}
 *       subtitle={target.email}
 *       onConfirm={() => adminApi.deleteUser(target.id)}
 *       onDeleted={() => { show(`${target.full_name} deleted.`); refetch(); }}
 *       onClose={close}
 *     />
 *
 * ## The one rule worth stating
 *
 * **The name is repeated in the body, in bold.** A dialog that says only "Delete
 * this user?" gives you nothing to check against — and the row you meant and the
 * row you clicked are not always the same row. Naming the record is what makes
 * the confirmation a confirmation rather than a speed bump.
 *
 * Anything beyond that sentence — "3 users hold this role", "this also revokes
 * their sessions" — goes in `children` and renders under it. A consequence the
 * user cannot see from the row must be stated here or not at all.
 */
export default function DeleteDialog({
  noun,
  name,
  subtitle,
  children,
  confirmDisabled,
  onConfirm,
  onDeleted,
  onClose,
}: {
  /** Lower-case singular — "user", "role", "invitation". Titles are built from it. */
  noun: string;
  /** The record's human name. Shown in bold inside the question. */
  name: ReactNode;
  /** Second identifier under the title — an email, a slug. */
  subtitle?: string;
  /** Extra consequences, rendered under the question. */
  children?: ReactNode;
  /** Blocks the button when a precondition fails. Say why in `children`. */
  confirmDisabled?: boolean;
  onConfirm: () => Promise<unknown>;
  onDeleted: () => void;
  onClose: () => void;
}) {
  return (
    <ConfirmDialog
      title={`Delete ${noun}`}
      subtitle={subtitle}
      confirmLabel={`Delete ${noun}`}
      busyLabel="Deleting…"
      errorFallback={`Could not delete ${noun}.`}
      confirmDisabled={confirmDisabled}
      onConfirm={onConfirm}
      onConfirmed={onDeleted}
      onClose={onClose}
    >
      Permanently delete{" "}
      <span className="font-semibold text-ink dark:text-gray-100">{name}</span>? This cannot be
      undone.
      {children && <div className="mt-2">{children}</div>}
    </ConfirmDialog>
  );
}
