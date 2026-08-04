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
 */
export function extractApiError(error: unknown, fallback: string): string {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response
    ?.data?.detail;

  if (typeof detail === "string" && detail.trim()) return detail;

  if (Array.isArray(detail)) {
    const messages = detail
      .map((entry) => {
        const item = entry as { loc?: unknown[]; msg?: unknown };
        const msg = typeof item.msg === "string" ? item.msg : null;
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

  return fallback;
}
