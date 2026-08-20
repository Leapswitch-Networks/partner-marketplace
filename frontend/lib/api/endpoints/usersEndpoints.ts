import { api } from "@/lib/store/api";
import type {
  BulkActionResult,
  CreateUserPayload,
  ListUsersParams,
  SendUserEmailPayload,
  SendUserEmailResult,
  UpdateUserPayload,
} from "@/lib/api/adminApi";
import type { ManagedUser, ManagedUserDetail, Paginated, UserStatus } from "@/types";

/**
 * User administration as RTK Query endpoints — PM-41 § 4.5.
 *
 * ## Why the bulk endpoints invalidate the whole collection
 *
 * A bulk call is *partially* applicable by design: the API answers with
 * `affected`, `skipped` and `skipped_reasons` because some of the selection may
 * be refused — a user cannot delete themselves, and a locked account cannot be
 * activated. So the client cannot know which rows moved, only that some did.
 * Invalidating `LIST` asks the server, which is the only party that knows.
 *
 * This is exactly the case `patchRow` could not serve: the old code called
 * `refetch()` from `useBulkAction`'s `onChanged`, and a module that forgot to
 * wire that callback showed a table that had silently diverged from the database.
 *
 * ## The one write that is not a cache concern
 *
 * `sendUserEmail` posts `multipart/form-data` and changes no record, so it
 * invalidates nothing. **The Content-Type header is deliberately unset** — the
 * browser writes it itself so it can append the multipart boundary, and setting
 * it by hand produces a body the server cannot parse. `axiosBaseQuery` passes the
 * `FormData` straight through as the axios `data`, which is what preserves that.
 */
export const usersEndpoints = api.injectEndpoints({
  endpoints: (build) => ({
    listUsers: build.query<Paginated<ManagedUser>, ListUsersParams | void>({
      query: (params) => ({ url: "/users", params: params ?? {} }),
      providesTags: (result) =>
        result
          ? [
              ...result.items.map((u) => ({ type: "User" as const, id: u.id })),
              { type: "User" as const, id: "LIST" },
            ]
          : [{ type: "User" as const, id: "LIST" }],
    }),

    // ManagedUserDetail, not ManagedUser — see the note on the type.
    getUser: build.query<ManagedUserDetail, string>({
      query: (id) => `/users/${id}`,
      providesTags: (_result, _error, id) => [{ type: "User", id }],
    }),

    createUser: build.mutation<ManagedUser, CreateUserPayload>({
      query: (body) => ({ url: "/users", method: "POST", body }),
      invalidatesTags: [{ type: "User", id: "LIST" }],
    }),

    updateUser: build.mutation<ManagedUser, { id: string; data: UpdateUserPayload }>({
      query: ({ id, data }) => ({ url: `/users/${id}`, method: "PATCH", body: data }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: "User", id },
        { type: "User", id: "LIST" },
      ],
    }),

    deleteUser: build.mutation<{ message: string }, string>({
      query: (id) => ({ url: `/users/${id}`, method: "DELETE" }),
      invalidatesTags: [{ type: "User", id: "LIST" }],
    }),

    /** Activate a pending account — the gate Google SSO does not open. */
    approveUser: build.mutation<ManagedUser, string>({
      query: (id) => ({ url: `/users/${id}/approve`, method: "POST" }),
      invalidatesTags: (_r, _e, id) => [
        { type: "User", id },
        { type: "User", id: "LIST" },
      ],
    }),

    toggleUserStatus: build.mutation<ManagedUser, string>({
      query: (id) => ({ url: `/users/${id}/toggle-status`, method: "POST" }),
      invalidatesTags: (_r, _e, id) => [
        { type: "User", id },
        // `status` is a filter on the index, so a toggle can move a row out of
        // the current view entirely — which `patchRow` could not express.
        { type: "User", id: "LIST" },
      ],
    }),

    /** Clear a failed-login lockout without waiting for it to lapse. */
    unlockUser: build.mutation<ManagedUser, string>({
      query: (id) => ({ url: `/users/${id}/unlock`, method: "POST" }),
      invalidatesTags: (_r, _e, id) => [
        { type: "User", id },
        { type: "User", id: "LIST" },
      ],
    }),

    /**
     * Clear a user's 2FA enrolment so they can sign in and set it up again.
     *
     * The support path for a lost phone with no recovery codes left. Also revokes
     * every session the account has, server-side — if the phone was stolen rather
     * than lost, clearing only the secret would strip the second factor and leave
     * the attacker signed in.
     */
    resetUserTwoFactor: build.mutation<ManagedUser, string>({
      query: (id) => ({ url: `/users/${id}/reset-two-factor`, method: "POST" }),
      invalidatesTags: (_r, _e, id) => [
        { type: "User", id },
        { type: "User", id: "LIST" },
      ],
    }),

    /** Ad-hoc message. 200 with `sent: false` means delivery failed. */
    sendUserEmail: build.mutation<
      SendUserEmailResult,
      { id: string; data: SendUserEmailPayload; files?: File[] }
    >({
      query: ({ id, data, files = [] }) => {
        const form = new FormData();
        form.append("subject", data.subject);
        form.append("message", data.message);
        form.append("bcc_sender", String(data.bcc_sender ?? false));
        files.forEach((file) => form.append("attachments", file));
        return { url: `/users/${id}/email`, method: "POST", body: form };
      },
      // Sending a message changes no record.
    }),

    bulkDeleteUsers: build.mutation<BulkActionResult, string[]>({
      query: (user_ids) => ({
        url: "/users/bulk-delete",
        method: "POST",
        body: { user_ids },
      }),
      invalidatesTags: [{ type: "User", id: "LIST" }],
    }),

    bulkUserStatus: build.mutation<
      BulkActionResult,
      { user_ids: string[]; status: UserStatus }
    >({
      query: (body) => ({ url: "/users/bulk-status", method: "POST", body }),
      invalidatesTags: [{ type: "User", id: "LIST" }],
    }),
  }),
});

export const {
  useListUsersQuery,
  useGetUserQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
  useApproveUserMutation,
  useToggleUserStatusMutation,
  useUnlockUserMutation,
  useResetUserTwoFactorMutation,
  useSendUserEmailMutation,
  useBulkDeleteUsersMutation,
  useBulkUserStatusMutation,
} = usersEndpoints;
