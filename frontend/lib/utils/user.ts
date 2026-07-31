import type { CurrentUser, ManagedUser } from "@/types";

/**
 * Display name for an account.
 *
 * Both shapes now carry a server-computed `full_name`, so there is no longer a
 * branch on which identity type this is — the backend unified the two tables.
 */
export function getUserDisplayName(user: CurrentUser | ManagedUser | null): string {
  if (!user) return "";
  return user.full_name || user.email;
}

/** Comma-separated role labels, e.g. "Admin, Staff". Empty string when none. */
export function getRoleLabel(user: CurrentUser | ManagedUser | null): string {
  if (!user || user.roles.length === 0) return "";
  return user.roles.map((role) => role.display_name || role.name).join(", ");
}

/** Initials for an avatar fallback. Prefers the server's value. */
export function getInitials(user: CurrentUser | ManagedUser | null): string {
  if (!user) return "";
  if (user.initials) return user.initials;
  return (user.full_name || user.email).slice(0, 2).toUpperCase();
}
