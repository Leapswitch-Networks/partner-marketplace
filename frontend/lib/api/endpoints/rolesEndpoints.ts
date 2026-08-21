import { api } from "@/lib/store/api";
import type {
  ClonePayload,
  CreateRolePayload,
  NavSectionOption,
  RoleMatrix,
  RoleUserItem,
  UpdateRolePayload,
} from "@/lib/api/rbacApi";
import type { PermissionGroup, Role } from "@/types";

/**
 * The role catalogue — PM-41 § 4.5.
 *
 * Started as **only the read** — the *picker* case, which four screens share:
 * `UsersModule` and `InvitationForm` each ran their own `roleApi.list()` on mount,
 * so opening the users table and then the invite form fetched the same unchanging
 * list twice.
 *
 * **Extended 2026-08-21 with the writes**, which is what the original note said
 * would happen: "when `RolesModule` is converted, its mutations invalidate this tag
 * and every picker in the app updates without being told." That is now true.
 *
 * One cache entry, tagged `Role`/`LIST`, means the second screen reuses the
 * first's copy, and every write below invalidates it.
 *
 * ## Still no single-role query, on purpose
 *
 * `RoleShow` finds its role inside the list rather than fetching one, which looked
 * odd until the alternative was written out: a per-row query would mean a second
 * request for data the picker cache already holds, and a second cache entry to
 * keep in step with it. The catalogue is small and changes rarely. So the list is
 * the unit, and `providesTags` stays list-only.
 *
 * ## The matrix and nav preferences are separate entries that share the tag
 *
 * Both are views *of* the role catalogue: setting a matrix cell changes what a role
 * can do, so it has to invalidate the pickers too. Tagging all three with
 * `Role`/`LIST` means one write refreshes every reader, which is the property the
 * hand-rolled version could not have — `RoleMatrix` used to reload only itself.
 */
export const rolesEndpoints = api.injectEndpoints({
  endpoints: (build) => ({
    listRoles: build.query<Role[], void>({
      query: () => "/roles",
      providesTags: [{ type: "Role", id: "LIST" }],
    }),

    // The permission catalogue, grouped and ordered ready to render as checkbox
    // sections. Tagged `Role`/LIST because that is what invalidates it: the
    // catalogue itself is generated from `app/core/permissions.py` and only moves
    // when the application is redeployed, so nothing in the UI can stale it.
    listPermissionGroups: build.query<PermissionGroup[], void>({
      query: () => "/permissions",
      providesTags: [{ type: "Role", id: "LIST" }],
    }),

    // Who holds a role. A separate query server-side too, and separate here for
    // the same reason: a reader without `user-view` should still see the role's
    // permissions rather than an error.
    roleUsers: build.query<RoleUserItem[], number>({
      query: (id) => `/roles/${id}/users`,
      providesTags: (_r, _e, id) => [{ type: "Role", id }],
    }),

    createRole: build.mutation<Role, CreateRolePayload>({
      query: (body) => ({ url: "/roles", method: "POST", body }),
      invalidatesTags: [{ type: "Role", id: "LIST" }],
    }),

    updateRole: build.mutation<Role, { id: number; data: UpdateRolePayload }>({
      query: ({ id, data }) => ({ url: `/roles/${id}`, method: "PATCH", body: data }),
      invalidatesTags: [{ type: "Role", id: "LIST" }],
    }),

    // Cloning produces a new role, so it invalidates the list the same way
    // creating one does. Before this, `CloneRoleModal` relied on its caller
    // refreshing — which worked because the roles screen passed a reload, and
    // would have silently gone stale the first time it was opened from anywhere
    // else.
    cloneRole: build.mutation<Role, { id: number; data: ClonePayload }>({
      query: ({ id, data }) => ({ url: `/roles/${id}/clone`, method: "POST", body: data }),
      invalidatesTags: [{ type: "Role", id: "LIST" }],
    }),

    deleteRole: build.mutation<{ message: string }, number>({
      query: (id) => ({ url: `/roles/${id}`, method: "DELETE" }),
      invalidatesTags: [{ type: "Role", id: "LIST" }],
    }),

    // Per-role sidebar preferences. The response always carries the FULL catalog,
    // so the UI never needs to know the defaults — which is why this is a query of
    // its own rather than a field on the role.
    roleNavPreferences: build.query<{ sections: NavSectionOption[] }, number>({
      query: (id) => `/roles/${id}/nav-preferences`,
      providesTags: (_r, _e, id) => [{ type: "Role", id }],
    }),

    setRoleNavPreferences: build.mutation<
      { sections: NavSectionOption[] },
      { id: number; preferences: Record<string, { collapsible: boolean }> }
    >({
      query: ({ id, preferences }) => ({
        url: `/roles/${id}/nav-preferences`,
        method: "POST",
        body: { preferences },
      }),
      invalidatesTags: (_r, _e, { id }) => [{ type: "Role", id }],
    }),

    roleMatrix: build.query<RoleMatrix, void>({
      query: () => "/roles/matrix",
      providesTags: [{ type: "Role", id: "LIST" }],
    }),

    setMatrixCell: build.mutation<
      Role,
      { role_id: number; group_id: number; granted: boolean }
    >({
      query: (body) => ({ url: "/roles/matrix/cell", method: "POST", body }),
      // `Role`/LIST, not just the matrix: granting a group changes what that role
      // can do everywhere, and the roles table shows a permission count.
      invalidatesTags: [{ type: "Role", id: "LIST" }],
    }),
  }),
});

export const {
  useListRolesQuery,
  useListPermissionGroupsQuery,
  useRoleUsersQuery,
  useCreateRoleMutation,
  useUpdateRoleMutation,
  useDeleteRoleMutation,
  useCloneRoleMutation,
  useRoleNavPreferencesQuery,
  useSetRoleNavPreferencesMutation,
  useRoleMatrixQuery,
  useSetMatrixCellMutation,
} = rolesEndpoints;
