"use client";

import { useMemo } from "react";
import useAppSelector from "./useAppSelector";

/**
 * Permission checks for the UI.
 *
 * The permission list arrives already resolved from `GET /api/auth/me`, with the
 * super-admin bypass expanded server-side into the full catalog. So there is no
 * special case here — membership is the whole rule.
 *
 * These gate *rendering only*. The API re-checks every request, and it is the
 * authority. Never treat a hidden button as a security control.
 *
 *   const { can, hasAdminAccess } = usePermissions();
 *   {can("user-create") && <Button>Add user</Button>}
 */
export function usePermissions() {
  const user = useAppSelector((state) => state.auth.user);

  const granted = useMemo(
    () => new Set(user?.permissions ?? []),
    [user?.permissions]
  );

  return useMemo(
    () => ({
      /** Does the current user hold this permission? */
      can: (permission: string) => granted.has(permission),
      /** At least one of them. */
      canAny: (...permissions: string[]) => permissions.some((p) => granted.has(p)),
      /** All of them. */
      canAll: (...permissions: string[]) => permissions.every((p) => granted.has(p)),
      /** Holds one of the named roles. Prefer `can` — role checks bake in org structure. */
      hasRole: (...names: string[]) =>
        (user?.roles ?? []).some((role) => names.includes(role.name)),
      /** Sees all records rather than only their own. */
      hasAdminAccess: user?.has_admin_access ?? false,
      isSuperAdmin: user?.is_super_admin ?? false,
      permissions: granted,
    }),
    [granted, user]
  );
}

export default usePermissions;
