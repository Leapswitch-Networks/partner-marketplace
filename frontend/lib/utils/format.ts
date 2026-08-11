/**
 * Date and time rendering, in one place.
 *
 * ## Why this file exists
 *
 * Before it, the same timestamp rendered **six different ways** depending on which
 * screen you were on — `en-IN` day/short-month/year on the Users table, `en-US`
 * day/long-month/year on the profile card, a bare `toLocaleString()` on the
 * Activity log, a bare `toLocaleDateString()` on the sessions list, and two
 * `dateStyle: "medium"` variants elsewhere. One account created on 7 August 2026
 * appeared as "7 Aug 2026", "August 7, 2026", "8/7/2026" and "Aug 7, 2026" in four
 * places in the same app.
 *
 * ## Two decisions worth knowing
 *
 * **The locale is pinned, the timezone is not.** A bare `toLocaleString()` inherits
 * the browser's locale, so the same build renders differently for different users
 * and — more sharply — differently on the server than on the client, which is a
 * hydration mismatch waiting for the first server-rendered timestamp. Pinning
 * `en-IN` makes the output deterministic. The **timezone is deliberately left
 * local**: "last login" means the reader's wall clock, and pinning IST would show a
 * partner in another timezone a time that never happened for them.
 *
 * **The fallback is a character, not an empty string.** An empty cell reads as a
 * layout bug; an em dash reads as "there is no value here", which is the actual
 * fact. Callers wanting different words pass their own — the Users table passes
 * "Never" for a last-login that has not happened, which says more than "—" does.
 */

const LOCALE = "en-IN";

/** `7 Aug 2026`. For table cells and any field where the time of day is noise. */
export function formatDate(
  value: string | Date | null | undefined,
  fallback = "—"
): string {
  const date = toDate(value);
  if (!date) return fallback;
  return date.toLocaleDateString(LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** `7 Aug 2026, 6:55 pm`. For audit rows, sessions, and anything where the moment matters. */
export function formatDateTime(
  value: string | Date | null | undefined,
  fallback = "—"
): string {
  const date = toDate(value);
  if (!date) return fallback;
  return date.toLocaleString(LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Parse defensively and return null rather than an `Invalid Date`.
 *
 * `new Date("")` and `new Date("not a date")` both produce an Invalid Date, whose
 * `toLocaleDateString()` is the string "Invalid Date" — rendered straight at the
 * user. Every caller here would rather show its fallback.
 */
function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
