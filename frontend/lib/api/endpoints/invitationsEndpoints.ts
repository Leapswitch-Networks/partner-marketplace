import { api } from "@/lib/store/api";
import type {
  CreateInvitationPayload,
  ListInvitationsParams,
} from "@/lib/api/rbacApi";
import type { Invitation, InvitationCreated, Paginated } from "@/types";

/**
 * Invitations as RTK Query endpoints — PM-41 § 4.5.
 *
 * `invitationApi` in `lib/api/rbacApi.ts` stays where it is: `preview` is called
 * from the unauthenticated acceptance page, which is not a cached admin read and
 * has no business in this cache, and `InvitationForm` still posts through the
 * plain client. The two coexist on the same `axiosInstance`, so they share the
 * refresh handling and the cookie.
 *
 * ## Why `stats` is tagged as the LIST
 *
 * The four count tiles are a *view over the collection*, not a resource of their
 * own. Tagging them `{ type: "Invitation", id: "LIST" }` means every mutation
 * that already invalidates the collection refreshes them too — which is what the
 * hand-written `loadStats()` call after each write was doing, in three places,
 * each one a place to forget. A resend moves a row's `last_sent_at` and a cancel
 * moves a row between tiles; both now fall out of the tag pairing rather than out
 * of remembering.
 *
 * There is deliberately no `STATS` sentinel. A separate id would need every
 * mutation to list both, which is the same forgettable duplication with an extra
 * step.
 */
export const invitationsEndpoints = api.injectEndpoints({
  endpoints: (build) => ({
    listInvitations: build.query<Paginated<Invitation>, ListInvitationsParams | void>({
      query: (params) => ({ url: "/invitations", params: params ?? {} }),
      providesTags: (result) =>
        result
          ? [
              ...result.items.map((i) => ({ type: "Invitation" as const, id: i.id })),
              { type: "Invitation" as const, id: "LIST" },
            ]
          : // Tagged even on error, so a later successful mutation still
            // invalidates this slot and triggers the retry the user is waiting
            // for — same reasoning as `listPartners`.
            [{ type: "Invitation" as const, id: "LIST" }],
    }),

    invitationStats: build.query<
      { pending: number; accepted: number; expired: number; cancelled: number },
      void
    >({
      query: () => "/invitations/stats",
      providesTags: [{ type: "Invitation", id: "LIST" }],
    }),

    createInvitation: build.mutation<InvitationCreated, CreateInvitationPayload>({
      query: (body) => ({ url: "/invitations", method: "POST", body }),
      invalidatesTags: [{ type: "Invitation", id: "LIST" }],
    }),

    createInvitations: build.mutation<InvitationCreated[], CreateInvitationPayload[]>({
      query: (invitations) => ({
        url: "/invitations/bulk",
        method: "POST",
        body: { invitations },
      }),
      invalidatesTags: [{ type: "Invitation", id: "LIST" }],
    }),

    /**
     * Rotates the token and extends the expiry. 429 if resent within 60 seconds
     * — a per-invitation cooldown, distinct from the per-IP rate limit, so the
     * caller must surface the error rather than treat it as a transient.
     */
    resendInvitation: build.mutation<InvitationCreated, string>({
      query: (id) => ({ url: `/invitations/${id}/resend`, method: "POST" }),
      invalidatesTags: (_r, _e, id) => [
        { type: "Invitation", id },
        { type: "Invitation", id: "LIST" },
      ],
    }),

    cancelInvitation: build.mutation<{ message: string }, string>({
      query: (id) => ({ url: `/invitations/${id}`, method: "DELETE" }),
      // The row stays in the table with a `cancelled` badge rather than
      // disappearing, so its own id is invalidated as well as the collection.
      invalidatesTags: (_r, _e, id) => [
        { type: "Invitation", id },
        { type: "Invitation", id: "LIST" },
      ],
    }),
  }),
});

export const {
  useListInvitationsQuery,
  useInvitationStatsQuery,
  useCreateInvitationMutation,
  useCreateInvitationsMutation,
  useResendInvitationMutation,
  useCancelInvitationMutation,
} = invitationsEndpoints;
