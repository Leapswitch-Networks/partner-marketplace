"use client";

/**
 * On/off switch — the editor for a `bool` setting.
 *
 * Added 2026-08-11 for Configuration (LeapDesk parity, Module 11), which uses a
 * switch rather than a checkbox for its boolean settings. The distinction is not
 * decoration: a checkbox reads as *"tick this to include it in what you are about
 * to submit"*, and a switch reads as *"this is on"*. Configuration saves a boolean
 * the instant it changes, with no submit step anywhere on the screen, so a
 * checkbox would describe an interaction that does not exist here.
 *
 * **A real `<button role="switch">`, not a styled div.** `aria-checked` is what
 * makes it announce its state, and a button is what makes Space and Enter work.
 * The one thing this must never become is a `<div onClick>` — that is invisible
 * to a keyboard and silent to a screen reader.
 *
 * `UI_PATTERNS.md` § New Component Checklist: dark variant on every colour, a
 * visible focus ring, no `outline-none` without a replacement.
 */
export default function Toggle({
  checked,
  onChange,
  disabled = false,
  label,
  id,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  /** Accessible name. Required — a bare switch says nothing about what it toggles. */
  label: string;
  id?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors
        focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2
        focus-visible:ring-offset-surface-wash dark:focus-visible:ring-offset-night-card
        disabled:cursor-not-allowed disabled:opacity-50
        ${
          checked
            ? "bg-brand dark:bg-brand-on-dark"
            : // Off is a neutral track, not a red one. Off is a valid state, not
              // an error, and colouring it as a warning is how a settings screen
              // starts nagging about choices nobody made wrongly.
              "bg-ink-label/30 dark:bg-night-border"
        }`}
    >
      <span
        aria-hidden="true"
        className={`inline-block size-4 transform rounded-full bg-white shadow transition-transform
          ${checked ? "translate-x-[18px]" : "translate-x-[2px]"}`}
      />
    </button>
  );
}
