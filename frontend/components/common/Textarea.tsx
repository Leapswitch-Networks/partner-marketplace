"use client";

import { TextareaHTMLAttributes, forwardRef } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  /** Helper text under the field. Hidden while an `error` is showing, so the
   *  two never stack and compete for the same spot. */
  hint?: string;
  /** Monospace + tabular — for JSON, templates, anything read as code. */
  mono?: boolean;
}

/**
 * Multi-line text field.
 *
 * Added 2026-08-11 for Configuration (LeapDesk parity, Module 11), whose `text`
 * and `json` settings need one. It is a **sibling of `Input`, not an option on
 * it**: `Input` forwards a ref to `HTMLInputElement` and spreads
 * `InputHTMLAttributes`, and a `multiline` flag would have to make both of those
 * conditional on a prop — which is how one component becomes two with a boolean
 * between them.
 *
 * The label, error, hint and focus treatment are copied from `Input` **exactly**,
 * because the two sit in the same forms and any drift between them is visible
 * side by side. If `Input`'s focus ring changes, this changes with it.
 */
const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, mono = false, id, className = "", rows = 3, ...props }, ref) => {
    const fieldId = id ?? label.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-[5px]">
        {/* An empty label is the same deliberate opt-out `Input` allows, for
            places where a visible label would waste a row. */}
        {label && (
          <label htmlFor={fieldId} className="text-sm font-semibold text-ink dark:text-white">
            {label}
          </label>
        )}

        <div
          className={`flex overflow-hidden rounded-[5px] border transition-colors
            focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20
            ${
              error
                ? "border-tone-danger bg-tone-danger/5 dark:border-tone-danger"
                : "border-surface-border bg-white dark:border-night-border dark:bg-night-card"
            }`}
        >
          <textarea
            ref={ref}
            id={fieldId}
            rows={rows}
            aria-invalid={Boolean(error) || undefined}
            className={`w-full resize-y bg-transparent px-3 py-2 text-sm text-ink outline-none
              placeholder:text-ink-label dark:text-white dark:placeholder:text-night-muted
              ${mono ? "font-mono text-xs tabular-nums" : ""} ${className}`}
            {...props}
          />
        </div>

        {error ? (
          <p role="alert" className="text-xs text-tone-danger">
            {error}
          </p>
        ) : hint ? (
          <p className="text-xs text-ink-label dark:text-night-muted">{hint}</p>
        ) : null}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";

export default Textarea;
