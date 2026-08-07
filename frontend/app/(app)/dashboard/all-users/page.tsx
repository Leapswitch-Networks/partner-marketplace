import { redirect } from "next/navigation";

/**
 * Retired 2026-08-07 — the users index is at `/dashboard/users`.
 *
 * Renamed so the module follows the Index/Form/Show route shape in
 * CORE_COMPLETION_PLAN.md § 2.3: /users, /users/new, /users/{id},
 * /users/{id}/edit. Kept as a redirect for the same reasons as add-user.
 */
export default function AllUsersRedirect() {
  redirect("/dashboard/users");
}
