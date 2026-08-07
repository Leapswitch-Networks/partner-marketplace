"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import type { FieldValues, UseFormReturn, Path } from "react-hook-form";

import Button from "@/components/common/Button";

/**
 * The create/update form shell — one component, two modes.
 *
 * The record is optional: present means edit, absent means create. Title,
 * submit label and submit target all derive from that single boolean, so the
 * two modes cannot drift apart the way two separate components would. This is
 * the reference implementation's pattern, verified in its `pages/Users/Form.tsx`
 * (`const isEditMode = !!user`), and the one part of its form layer worth
 * copying wholesale.
 *
 * ```tsx
 * const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues });
 *
 * <ResourceForm
 *   form={form}
 *   record={user}
 *   resourceName="User"
 *   backHref="/dashboard/users"
 *   serverError={serverError}
 *   onSubmit={handleSubmit}
 * >
 *   <Input label="First name" error={form.formState.errors.first_name?.message}
 *          {...form.register("first_name")} />
 * </ResourceForm>
 * ```
 *
 * Fields stay with the module — they are the part that genuinely differs. What
 * is shared is everything around them: heading, server-error banner, footer,
 * submit state, and the unsaved-changes guard.
 */

export interface ResourceFormProps<T, V extends FieldValues> {
  form: UseFormReturn<V, unknown, V>;
  /** The record being edited. Absent means create. */
  record?: T | null;
  /** Singular resource name — "User". Drives the heading and submit label. */
  resourceName: string;
  /** Where Cancel goes, and where a successful submit should return to. */
  backHref: string;
  /**
   * Server error text. Kept separate from field errors per
   * `NEXTJS_STANDARDS.md` § 7 rule 4 — the two answer different questions.
   */
  serverError?: string | null;
  onSubmit: (values: V) => void | Promise<void>;
  /** The fields. */
  children: ReactNode;
  /** Extra footer controls, left of Cancel — "Save and add another". */
  footerExtras?: ReactNode;
  /** Suppresses the unsaved-changes prompt, e.g. right after a successful save. */
  skipDirtyGuard?: boolean;
}

export default function ResourceForm<T, V extends FieldValues>({
  form,
  record,
  resourceName,
  backHref,
  serverError,
  onSubmit,
  children,
  footerExtras,
  skipDirtyGuard,
}: ResourceFormProps<T, V>) {
  const isEditMode = Boolean(record);
  const {
    handleSubmit,
    formState: { isSubmitting, isDirty, errors },
    setFocus,
  } = form;

  /**
   * Warn before a reload or tab close discards edits.
   *
   * `beforeunload` only — it cannot cover in-app navigation, because the App
   * Router exposes no navigation-blocking API in 14.x. A Cancel button that
   * discards silently is the remaining gap, and it is why Cancel is a link
   * rather than a destructive-looking control.
   */
  useEffect(() => {
    if (!isDirty || skipDirtyGuard) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Required by Chrome; the string itself is never displayed.
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty, skipDirtyGuard]);

  /**
   * Focus the first invalid field after a failed submit.
   *
   * Without it a long form can scroll the error out of view and look as though
   * nothing happened when the button is pressed.
   */
  const errorKeys = Object.keys(errors);
  const firstError = errorKeys[0];
  const lastFocused = useRef<string | null>(null);
  useEffect(() => {
    if (firstError && firstError !== lastFocused.current) {
      lastFocused.current = firstError;
      setFocus(firstError as Path<V>);
    }
    if (!firstError) lastFocused.current = null;
  }, [firstError, setFocus]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border border-brand/20 bg-surface-wash dark:border-night-border dark:bg-night-card"
      >
        <div className="shrink-0 border-b border-brand/20 px-4 py-3 dark:border-night-border sm:px-5">
          <h1 className="text-sm font-bold text-ink dark:text-white">
            {isEditMode ? `Edit ${resourceName}` : `New ${resourceName}`}
          </h1>
          <p className="mt-0.5 text-[11px] text-ink-label dark:text-night-muted">
            {isEditMode
              ? "Changes take effect immediately once saved."
              : `Create a new ${resourceName.toLowerCase()}.`}
          </p>
        </div>

        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {serverError && (
            <div
              role="alert"
              className="mb-4 rounded-[5px] border border-tone-danger/40 bg-tone-danger/10 px-3 py-2 text-xs text-tone-danger"
            >
              {serverError}
            </div>
          )}
          <div className="flex flex-col gap-4">{children}</div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-brand/20 px-4 py-3 dark:border-night-border sm:px-5">
          {footerExtras}
          {/* A Link, not a Button — `Button` renders a `<button>` and takes no
              `href`. Cancel is navigation, so it should be a real anchor:
              middle-click and "open in new tab" work, and it needs no handler. */}
          <Link
            href={backHref}
            className="inline-flex h-9 items-center rounded-[5px] border border-brand/20 px-7 text-xs font-semibold text-ink-label transition-colors hover:bg-brand/10 hover:text-brand dark:border-night-border dark:text-gray-400 dark:hover:bg-brand/20 dark:hover:text-brand-on-dark"
          >
            Cancel
          </Link>
          <Button type="submit" loading={isSubmitting}>
            {isEditMode ? "Save changes" : `Create ${resourceName.toLowerCase()}`}
          </Button>
        </div>
      </form>
    </div>
  );
}
