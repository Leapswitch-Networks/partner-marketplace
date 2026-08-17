import { api } from "@/lib/store/api";
import type {
  CreatePartnerPayload,
  ListPartnersParams,
  UpdatePartnerPayload,
  UpdatePartnerTierPayload,
} from "@/lib/api/partnersApi";
import type {
  Paginated,
  PartnerDetailResponse,
  PartnerListItem,
  PartnerStatus,
  PartnerTier,
  VerificationLevel,
} from "@/types";

/**
 * Partners and tiers as RTK Query endpoints — **the worked example for PM-41**.
 *
 * `lib/api/partnersApi.ts` (the plain axios client) is deliberately left in
 * place and still used by `PartnerForm` / `PartnerShow`. The two coexist on
 * purpose during the migration: they share `axiosInstance`, so they share the
 * refresh handling and the cookie, and a half-migrated module is not a
 * half-broken one. The plain client is deleted per-module as each module's last
 * caller moves over.
 *
 * ## What the tags buy, concretely
 *
 * Before: `PartnersModule` called `list.refetch()` by hand after a delete, and
 * `list.patchRow()` after a status change — two different manual
 * synchronisations for the same cache, each one a place to forget.
 *
 * After: the mutation says `invalidatesTags: ["Partner"]` and every mounted
 * partner query refetches. The row-level `providesTags` means a single-record
 * update refreshes only the queries holding that record, not the whole list.
 *
 * ## The LIST sentinel
 *
 * `{ type: "Partner", id: "LIST" }` is RTK Query's idiom for "the collection
 * itself", as distinct from any row in it. A *create* invalidates LIST (the
 * collection changed) but no individual row; an *update* invalidates that row's
 * id and LIST (its position or its badge may have moved). Without the sentinel,
 * a create would have to invalidate every row id — which it cannot know.
 */
export const partnersEndpoints = api.injectEndpoints({
  endpoints: (build) => ({
    listPartners: build.query<Paginated<PartnerListItem>, ListPartnersParams | void>({
      query: (params) => ({ url: "/partners", params: params ?? {} }),
      providesTags: (result) =>
        result
          ? [
              ...result.items.map((p) => ({ type: "Partner" as const, id: p.id })),
              { type: "Partner" as const, id: "LIST" },
            ]
          : // On error there is no result to tag. Tagging LIST anyway means a
            // later successful mutation still invalidates this slot and triggers
            // the retry the user is waiting for.
            [{ type: "Partner" as const, id: "LIST" }],
    }),

    getPartner: build.query<PartnerDetailResponse, string>({
      query: (id) => `/partners/${id}`,
      providesTags: (_result, _error, id) => [{ type: "Partner", id }],
    }),

    createPartner: build.mutation<PartnerDetailResponse, CreatePartnerPayload>({
      query: (body) => ({ url: "/partners", method: "POST", body }),
      invalidatesTags: [{ type: "Partner", id: "LIST" }],
    }),

    updatePartner: build.mutation<
      PartnerDetailResponse,
      { id: string; data: UpdatePartnerPayload }
    >({
      query: ({ id, data }) => ({ url: `/partners/${id}`, method: "PATCH", body: data }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Partner", id },
        { type: "Partner", id: "LIST" },
      ],
    }),

    deletePartner: build.mutation<void, string>({
      query: (id) => ({ url: `/partners/${id}`, method: "DELETE" }),
      invalidatesTags: [{ type: "Partner", id: "LIST" }],
    }),

    // The three state-machine transitions stay separate endpoints, mirroring the
    // API. Each has its own permission because each has a consequence a general
    // edit must not carry — collapsing them into `updatePartner` here would
    // hide that split from anyone reading the client.
    changePartnerStatus: build.mutation<
      PartnerDetailResponse,
      { id: string; status: PartnerStatus; reason?: string }
    >({
      query: ({ id, status, reason }) => ({
        url: `/partners/${id}/status`,
        method: "POST",
        body: { status, reason },
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Partner", id },
        { type: "Partner", id: "LIST" },
        // Suspending an organisation revokes its users' sessions, so any cached
        // user list is now wrong about who can sign in.
        { type: "User", id: "LIST" },
      ],
    }),

    setPartnerVerification: build.mutation<
      PartnerDetailResponse,
      { id: string; verification_level: VerificationLevel }
    >({
      query: ({ id, verification_level }) => ({
        url: `/partners/${id}/verification`,
        method: "POST",
        body: { verification_level },
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Partner", id },
        { type: "Partner", id: "LIST" },
      ],
    }),

    setPartnerListed: build.mutation<
      PartnerDetailResponse,
      { id: string; is_listed: boolean }
    >({
      query: ({ id, is_listed }) => ({
        url: `/partners/${id}/listing`,
        method: "POST",
        body: { is_listed },
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Partner", id },
        { type: "Partner", id: "LIST" },
      ],
    }),

    listPartnerTiers: build.query<PartnerTier[], boolean | void>({
      query: (includeInactive) => ({
        url: "/partners/tiers",
        params: { include_inactive: includeInactive ?? false },
      }),
      providesTags: [{ type: "PartnerTier", id: "LIST" }],
    }),

    updatePartnerTier: build.mutation<
      PartnerTier,
      { id: number; data: UpdatePartnerTierPayload }
    >({
      query: ({ id, data }) => ({ url: `/partners/tiers/${id}`, method: "PATCH", body: data }),
      invalidatesTags: [
        { type: "PartnerTier", id: "LIST" },
        // A tier's name and allowance are rendered on partner rows, so changing
        // one makes every cached partner list stale. Easy to miss, and the
        // symptom is a table showing a tier label that no longer exists.
        { type: "Partner", id: "LIST" },
      ],
    }),
  }),
});

export const {
  useListPartnersQuery,
  useGetPartnerQuery,
  useCreatePartnerMutation,
  useUpdatePartnerMutation,
  useDeletePartnerMutation,
  useChangePartnerStatusMutation,
  useSetPartnerVerificationMutation,
  useSetPartnerListedMutation,
  useListPartnerTiersQuery,
  useUpdatePartnerTierMutation,
} = partnersEndpoints;
