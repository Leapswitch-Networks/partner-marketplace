"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import type { FieldValues, UseFormReturn, Path } from "react-hook-form";

import Button, { buttonClasses } from "@/components/common/Button";

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
  /**
   * Names the record in the edit heading — "Edit User: Ayush Mishra".
   * The reference puts the record's name in the title, which is the difference
   * between a heading and a heading that tells you what you are about to change.
   */
  recordLabel?: string;
  /** Glyph beside the heading, matching the index page's. */
  icon?: ReactNode;
  /** Overrides the default one-liner under the heading. */
  description?: string;
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
  recordLabel,
  icon,
  description,
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
          {/*
            Heading copy follows the reference: the record's name is *in* the
            edit title ("Edit User: Ayush Mishra"), which is the difference
            between a heading and one that tells you what you are about to
            change — it matters most on the screen where you can do damage.
          */}
          <h1 className="flex items-center gap-2 text-sm font-bold text-ink dark:text-white">
            {icon}
            {isEditMode
              ? `Edit ${resourceName}${recordLabel ? `: ${recordLabel}` : ""}`
              : `Create New ${resourceName}`}
          </h1>
          <p className="mt-0.5 text-[11px] text-ink-label dark:text-night-muted">
            {description ??
              (isEditMode
                ? `Update ${resourceName.toLowerCase()} information and organisational details`
                : `Add a new ${resourceName.toLowerCase()} to the system`)}
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
          {/* `gap-5` between sections, matching the reference's `space-y-6`
              rhythm at our tighter 14px baseline. */}
          <div className="flex flex-col gap-5">{children}</div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-brand/20 px-4 py-3 dark:border-night-border sm:px-5">
          {footerExtras}
          {/* A Link, not a Button — `Button` renders a `<button>` and takes no
              `href`. Cancel is navigation, so it should be a real anchor:
              middle-click and "open in new tab" work, and it needs no handler.
              It wears `buttonClasses` so it cannot drift from the Save beside it. */}
          <Link href={backHref} className={buttonClasses("outline")}>
            Cancel
          </Link>
          <Button type="submit" loading={isSubmitting}>
            {isSubmitting
              ? isEditMode
                ? "Updating…"
                : "Creating…"
              : isEditMode
                ? `Update ${resourceName}`
                : `Create ${resourceName}`}
          </Button>
        </div>
      </form>
    </div>
  );
}

/**
 * A titled group of fields — the reference's per-section `Card`.
 *
 * Its Users form is five of these ("Basic Information", "Organization", …), and
 * without the primitive every module invents its own grouping: one uses a bare
 * `<h3>`, the next a bordered div, the third nothing at all. A form of fifteen
 * fields in one flat column is also simply hard to read, which is the reason the
 * reference groups them in the first place.
 *
 * ```tsx
 * <FormSection title="Basic Information" icon={navIcon("users")}>
 *   <FormGrid>
 *     <Input label="First name" … />
 *     <Input label="Last name" … />
 *   </FormGrid>
 * </FormSection>
 * ```
 */
export function FormSection({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[5px] border border-brand/20 bg-white dark:border-night-border dark:bg-night-card">
      <div className="border-b border-brand/20 px-4 py-2.5 dark:border-night-border">
        <h2 className="flex items-center gap-2 text-xs font-bold text-ink dark:text-white">
          {icon}
          {title}
        </h2>
        {description && (
          <p className="mt-0.5 text-[11px] text-ink-label dark:text-night-muted">{description}</p>
        )}
      </div>
      <div className="flex flex-col gap-4 px-4 py-4">{children}</div>
    </section>
  );
}

/**
 * Two fields per row on anything wider than a phone, one below it.
 *
 * The breakpoint is `sm`, not the reference's `md`: our body text is 14px and
 * the form sits inside a card rather than a full-width page, so fields pair up
 * comfortably sooner. A field that must own its row — a long select, a textarea
 * — simply sits outside the grid.
 */
export function FormGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}
