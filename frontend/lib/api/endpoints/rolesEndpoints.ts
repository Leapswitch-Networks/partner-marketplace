import { api } from "@/lib/store/api";
import type { Role } from "@/types";

/**
 * The role catalogue — PM-41 § 4.5.
 *
 * Deliberately **only the read**. `RolesModule` still writes through `roleApi`,
 * and this slice is not an attempt to convert it: what it serves is the *picker*
 * case, which four screens share. `UsersModule` and `InvitationForm` each ran
 * their own `roleApi.list()` on mount, so opening the users table and then the
 * invite form fetched the same unchanging list twice.
 *
 * One cache entry, tagged `Role`/`LIST`, means the second screen reuses the
 * first's copy — and when `RolesModule` is converted, its mutations invalidate
 * this tag and every picker in the app updates without being told.
 *
 * Not tagged per row: a picker reads the whole list or none of it, and nothing
 * here fetches a single role.
 */
export const rolesEndpoints = api.injectEndpoints({
  endpoints: (build) => ({
    listRoles: build.query<Role[], void>({
      query: () => "/roles",
      providesTags: [{ type: "Role", id: "LIST" }],
    }),
  }),
});

export const { useListRolesQuery } = rolesEndpoints;
