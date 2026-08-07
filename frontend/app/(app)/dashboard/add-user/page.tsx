import { redirect } from "next/navigation";

/**
 * Retired 2026-08-07 — create is a page now, at `/dashboard/users/new`.
 *
 * This route never was a form: it rendered the index with a modal
 * auto-opened. Kept as a redirect rather than deleted because it is in the
 * server-driven navigation tree, in bookmarks, and in earlier documentation.
 * `redirect()` issues a 307, so nothing that links here breaks.
 */
export default function AddUserRedirect() {
  redirect("/dashboard/users/new");
}
