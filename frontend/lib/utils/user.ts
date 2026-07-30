import type { AdminUser, User } from "@/types";

export function getUserDisplayName(user: User | AdminUser | null): string {
  if (!user) return "";
  return "full_name" in user ? user.full_name : user.name;
}
