/**
 * Turn an Axios failure into a sentence a user can act on.
 *
 * FastAPI returns two different shapes and the difference matters:
 *
 *   * A handled error is `{"detail": "Current password is incorrect"}` — a string,
 *     already written for a human.
 *   * A **422 from Pydantic** is `{"detail": [{loc, msg, type}, ...]}` — a list.
 *     Rendering that object directly prints `[object Object]` at the user, which is
 *     a mistake this codebase has already had to fix twice (see the reset-password
 *     and change-password notes in TECH_DEBT PM-36).
 *
 * So the list case is unwrapped to its messages, prefixed with the field name when
 * there is one, because "personal_email: value is not a valid email address" tells
 * the user which box to fix and "value is not a valid email address" does not.
 *
 * ## The third shape: no response at all
 *
 * A request that never reached the server has no `response`, so there is no
 * `detail` to unwrap and the fallback alone ("Could not load users.") describes the
 * wrong problem — it reads as a server refusal when the real fault is the
 * connection, and it sends the reader to look in the wrong place. That branch was
 * added on 2026-08-10 while consolidating seven copies of this function.
 *
 * ## ⚠️ This is the only error formatter — do not write a second one
 *
 * Seven components had each grown a private `apiMessage()` doing roughly this, in
 * **four different versions**, and the drift was user-visible: two of them
 * (`InvitationsModule`, `UserShow`) had no array branch at all, so every 422 from
 * Pydantic — every validation failure — was swallowed and shown as the generic
 * fallback. None of the seven prefixed the field name, which is the one thing that
 * makes a validation message actionable. The copies existed because this file was
 * missing the network branch above; it is here now, so reach for this instead.
 */
export function extractApiError(error: unknown, fallback: string): string {
  const response = (error as { response?: { data?: { detail?: unknown } } })?.response;
  const detail = response?.data?.detail;

  if (typeof detail === "string" && detail.trim()) return detail;

  if (Array.isArray(detail)) {
    const messages = detail
      .map((entry) => {
        const item = entry as { loc?: unknown[]; msg?: unknown };
        // Pydantic prefixes every custom-validator message with "Value error, ".
        // It is noise to a user: the message underneath already reads as a
        // sentence ("Unknown theme preset 'viho'. Available: …").
        const raw = typeof item.msg === "string" ? item.msg : null;
        const msg = raw ? raw.replace(/^Value error,\s*/i, "") : null;
        if (!msg) return null;
        // `loc` is like ["body", "personal_email"] — the last segment is the field.
        const field = Array.isArray(item.loc)
          ? item.loc.filter((p) => p !== "body").slice(-1)[0]
          : null;
        return typeof field === "string" ? `${field}: ${msg}` : msg;
      })
      .filter((m): m is string => Boolean(m));

    if (messages.length) return messages.join(". ");
  }

  // Checked last, not first: a server that answered has something to say, and its
  // message beats a guess about the network every time.
  if (!response) return "Network error — check your connection and try again.";

  return fallback;
}
