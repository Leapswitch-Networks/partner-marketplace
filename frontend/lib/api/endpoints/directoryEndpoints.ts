import { api } from "@/lib/store/api";
import type {
  Category,
  Enquiry,
  EnquiryMessage,
  EnquiryStatus,
  Listing,
  ListingStatus,
  ModerationQueueEntry,
  OwnOrganisation,
  OwnOrganisationOverview,
  PricingModel,
} from "@/lib/api/directoryApi";
import type { Paginated } from "@/types";

/**
 * The directory's cacheable resources — PM-41's first repayment.
 *
 * ## Why this exists, and why it is only two modules' worth
 *
 * `CORE_EXTRACTION_PLAN.md` phase 4 records PM-41 as the largest open item: 17
 * admin modules fetch on mount through a shared hook, which collapsed the
 * boilerplate but could not give them a cache, invalidation or deduplication.
 * The layer was chosen and built (`lib/store/api.ts`, `baseQuery.ts`) and then
 * only the partner modules ever used it.
 *
 * **I added two more modules to the old pattern on 2026-08-18** — listings and
 * enquiries — because matching the other fifteen was the right call for
 * consistency at the time. This converts those two, which pays back the debt I
 * created and leaves a worked example for the remaining fifteen that is not the
 * partner modules.
 *
 * ## Tags are the contract
 *
 * A query declares what it `provides`; a mutation declares what it
 * `invalidates`. That pairing is the whole point — it is what removes the manual
 * `refetch()` after every write, and forgetting one is how a table silently shows
 * stale rows with no error to notice.
 *
 * Row-level tags as well as `LIST`: approving one listing should not refetch a
 * page of enquiries, and tagging only `LIST` would make every mutation invalidate
 * everything.
 *
 * On error there is no result to tag, so `LIST` is tagged anyway — otherwise a
 * later successful mutation cannot invalidate the failed slot and the retry the
 * user is waiting for never fires.
 */
/**
 * What a partner may write on a listing. Deliberately an allowlist: the API's
 * `UpdateListingRequest` has no `status`, `rejection_reason` or `partner_id`, and
 * mirroring that here keeps the two from drifting in the direction that matters.
 */
export type ListingWritable = Partial<{
  title: string;
  summary: string;
  category_id: number;
  description: string | null;
  pricing_model: PricingModel;
  price: number | null;
  currency: string;
}>;

export const directoryEndpoints = api.injectEndpoints({
  endpoints: (build) => ({
    // --- Categories ---------------------------------------------------------
    // Reference data. `Category` is tagged as a whole rather than per row: the
    // taxonomy is read as a tree and a reorder changes every row's position, so
    // row-level invalidation would buy nothing.
    listCategories: build.query<Category[], { includeInactive?: boolean } | void>({
      query: (args) => ({
        url: "/categories",
        params: { include_inactive: args?.includeInactive ?? false },
      }),
      providesTags: [{ type: "Category", id: "LIST" }],
    }),

    createCategory: build.mutation<Category, Partial<Category> & { name: string }>({
      query: (body) => ({ url: "/categories", method: "POST", body }),
      invalidatesTags: [{ type: "Category", id: "LIST" }],
    }),

    updateCategory: build.mutation<Category, { id: number; data: Partial<Category> }>({
      query: ({ id, data }) => ({ url: `/categories/${id}`, method: "PATCH", body: data }),
      invalidatesTags: [{ type: "Category", id: "LIST" }],
    }),

    deleteCategory: build.mutation<void, number>({
      query: (id) => ({ url: `/categories/${id}`, method: "DELETE" }),
      invalidatesTags: [{ type: "Category", id: "LIST" }],
    }),

    // --- Listings -----------------------------------------------------------
    listListings: build.query<
      Paginated<Listing>,
      { page?: number; per_page?: number; status?: ListingStatus } | void
    >({
      query: (params) => ({ url: "/listings", params: params ?? {} }),
      providesTags: (result) =>
        result
          ? [
              ...result.items.map((l) => ({ type: "Listing" as const, id: l.id })),
              { type: "Listing" as const, id: "LIST" },
            ]
          : [{ type: "Listing" as const, id: "LIST" }],
    }),

    getListing: build.query<Listing, string>({
      query: (id) => `/listings/${id}`,
      providesTags: (_r, _e, id) => [{ type: "Listing", id }],
    }),

    // Authoring. `ListingWritable` mirrors what the API accepts and nothing more —
    // `status`, `rejection_reason` and `partner_id` are absent because a partner
    // must not be able to set any of them, and an exclusion list would be one new
    // column away from leaking write access to whatever gets added next.
    createListing: build.mutation<Listing, ListingWritable & { title: string; summary: string; category_id: number }>({
      query: (body) => ({ url: "/listings", method: "POST", body }),
      // No row tag: the row did not exist until now, so there is nothing to
      // invalidate but the collections it has just joined. `Category` too — the
      // public listing count per category is recomputed on publish, and a draft
      // still moves the authoring screens' idea of what exists.
      invalidatesTags: [
        { type: "Listing", id: "LIST" },
        { type: "Category", id: "LIST" },
      ],
    }),

    updateListing: build.mutation<Listing, { id: string; data: ListingWritable }>({
      query: ({ id, data }) => ({ url: `/listings/${id}`, method: "PATCH", body: data }),
      // Editing a material field sends a PUBLISHED listing back to review and
      // recounts both the old and new category, so this cannot be a row-only
      // invalidation — see `listing_service.update_listing`.
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Listing", id },
        { type: "Listing", id: "LIST" },
        { type: "Category", id: "LIST" },
      ],
    }),

    submitListing: build.mutation<Listing, string>({
      query: (id) => ({ url: `/listings/${id}/submit`, method: "POST" }),
      // Both: the row's own status changed, and it moved between status filters
      // so any filtered list is now wrong.
      invalidatesTags: (_r, _e, id) => [
        { type: "Listing", id },
        { type: "Listing", id: "LIST" },
      ],
    }),

    deleteListing: build.mutation<void, string>({
      query: (id) => ({ url: `/listings/${id}`, method: "DELETE" }),
      invalidatesTags: (_r, _e, id) => [
        { type: "Listing", id },
        { type: "Listing", id: "LIST" },
        // A deleted listing changes its category's published count.
        { type: "Category", id: "LIST" },
      ],
    }),

    // Moderation writes invalidate listings, because that is what they change.
    // The queue carries `blockers` and `entitlement` per row — whether approving
    // would actually succeed. Tagged on `Listing`/LIST so approving or rejecting
    // one row refreshes the rest, which matters here more than elsewhere: a tier
    // limit is a property of the *partner*, so publishing one of their listings
    // can be what puts another of their rows over the line.
    reviewQueue: build.query<ModerationQueueEntry[], void>({
      query: () => "/moderation/queue",
      providesTags: (result) =>
        result
          ? [
              ...result.map((l) => ({ type: "Listing" as const, id: l.id })),
              { type: "Listing" as const, id: "LIST" },
            ]
          : [{ type: "Listing" as const, id: "LIST" }],
    }),

    approveListing: build.mutation<Listing, string>({
      query: (id) => ({ url: `/moderation/listings/${id}/approve`, method: "POST" }),
      invalidatesTags: (_r, _e, id) => [
        { type: "Listing", id },
        { type: "Listing", id: "LIST" },
        { type: "Category", id: "LIST" },
      ],
    }),

    rejectListing: build.mutation<Listing, { id: string; reason: string }>({
      query: ({ id, reason }) => ({
        url: `/moderation/listings/${id}/reject`,
        method: "POST",
        body: { reason },
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Listing", id },
        { type: "Listing", id: "LIST" },
        { type: "Category", id: "LIST" },
      ],
    }),

    // --- Enquiries ----------------------------------------------------------
    listEnquiries: build.query<
      Paginated<Enquiry>,
      { page?: number; per_page?: number; status?: EnquiryStatus; unanswered?: boolean } | void
    >({
      query: (params) => ({ url: "/enquiries", params: params ?? {} }),
      providesTags: (result) =>
        result
          ? [
              ...result.items.map((e) => ({ type: "Enquiry" as const, id: e.id })),
              { type: "Enquiry" as const, id: "LIST" },
            ]
          : [{ type: "Enquiry" as const, id: "LIST" }],
    }),

    getEnquiry: build.query<Enquiry, string>({
      query: (id) => `/enquiries/${id}`,
      providesTags: (_r, _e, id) => [{ type: "Enquiry", id }],
    }),

    replyEnquiry: build.mutation<EnquiryMessage, { id: string; body: string }>({
      query: ({ id, body }) => ({
        url: `/enquiries/${id}/reply`,
        method: "POST",
        body: { body },
      }),
      // A first reply stamps the response time and flips the status, so the
      // unanswered filter is stale too — hence LIST, not just the row.
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Enquiry", id },
        { type: "Enquiry", id: "LIST" },
      ],
    }),

    // --- The partner's own record -------------------------------------------
    //
    // `/partners/me` takes no id: the organisation is resolved from the session,
    // which is the whole security model of these screens — there is no path
    // parameter to tamper with and so no ownership check to forget.
    //
    // Tagged `Partner`/LIST rather than by row: this row has no id the client
    // knows, and a staff edit to the same organisation through the admin screens
    // should refresh it.
    myOrganisation: build.query<OwnOrganisation, void>({
      query: () => "/partners/me",
      providesTags: [{ type: "Partner", id: "LIST" }],
    }),

    updateMyOrganisation: build.mutation<OwnOrganisation, Partial<OwnOrganisation>>({
      query: (body) => ({ url: "/partners/me", method: "PATCH", body }),
      invalidatesTags: [{ type: "Partner", id: "LIST" }],
    }),

    /** Replaces the whole selection. Ids, because these become the filter's join. */
    setMyExpertise: build.mutation<OwnOrganisation, number[]>({
      query: (categoryIds) => ({
        url: "/partners/me/expertise",
        method: "PUT",
        body: { category_ids: categoryIds },
      }),
      // `Category` too: expertise is the join the public directory filter runs
      // on, so changing it changes which partners a category page can show.
      invalidatesTags: [
        { type: "Partner", id: "LIST" },
        { type: "Category", id: "LIST" },
      ],
    }),

    // Multipart. `FormData` is built here and handed to `axiosBaseQuery` as the
    // body, which passes it to axios untouched — and **the Content-Type is
    // deliberately never set**, because the browser writes it itself with the
    // multipart boundary, and setting it by hand produces a body the server
    // cannot parse. Same shape as `usersEndpoints.sendUserEmail`.
    //
    // ⚠️ **Corrected 2026-08-21.** An earlier version of this comment said the
    // upload could not live here, because a `File` in a mutation argument would
    // trip the store's `serializableCheck`. **That was wrong.** RTK's default
    // `ignoredActionPaths` is `["meta.arg", "meta.baseQueryMeta"]` — exactly where
    // RTK Query puts mutation arguments — so a non-serialisable argument is
    // ignored by design. Checked against the installed source rather than
    // reasoned about, which is what the first version should have been.
    uploadBrandAsset: build.mutation<OwnOrganisation, { asset: "logo" | "banner"; file: File }>({
      query: ({ asset, file }) => {
        const body = new FormData();
        body.append("file", file);
        return { url: `/partners/me/brand/${asset}`, method: "PUT", body };
      },
      invalidatesTags: [{ type: "Partner", id: "LIST" }],
    }),

    clearBrandAsset: build.mutation<OwnOrganisation, "logo" | "banner">({
      query: (asset) => ({ url: `/partners/me/brand/${asset}`, method: "DELETE" }),
      invalidatesTags: [{ type: "Partner", id: "LIST" }],
    }),

    // --- The partner's own organisation -------------------------------------
    //
    // Tagged with both `Listing` and `Enquiry` LIST, not a tag of its own. It is
    // a *derived* resource: publishing a listing or answering an enquiry changes
    // these numbers, and a dedicated tag would mean every one of those mutations
    // had to remember to invalidate it. Reusing the two it is derived from makes
    // that automatic — the landing page is correct the moment either changes.
    getMyOverview: build.query<OwnOrganisationOverview, void>({
      query: () => "/partners/me/overview",
      providesTags: [
        { type: "Listing", id: "LIST" },
        { type: "Enquiry", id: "LIST" },
        { type: "Partner", id: "LIST" },
      ],
    }),

    updateEnquiryStatus: build.mutation<Enquiry, { id: string; status: EnquiryStatus }>({
      query: ({ id, status }) => ({
        url: `/enquiries/${id}/status`,
        method: "PATCH",
        body: { status },
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Enquiry", id },
        { type: "Enquiry", id: "LIST" },
      ],
    }),
  }),
});

// Hook names are generated from the endpoint names above. They sit alongside the
// plain `directoryApi` functions of the same base name and do not collide —
// different module, and the hook carries a `use`/`Query`/`Mutation` affix.
//
// The one-off client in `directoryApi.ts` stays for now: the public route
// handler and the not-yet-converted modules use it, and deleting it before the
// other fifteen modules move would break them.
export const {
  useListCategoriesQuery,
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
  useDeleteCategoryMutation,
  useListListingsQuery,
  useGetListingQuery,
  useSubmitListingMutation,
  useDeleteListingMutation,
  useApproveListingMutation,
  useRejectListingMutation,
  useListEnquiriesQuery,
  useGetEnquiryQuery,
  useReplyEnquiryMutation,
  useUpdateEnquiryStatusMutation,
  useGetMyOverviewQuery,
  useReviewQueueQuery,
  useMyOrganisationQuery,
  useUpdateMyOrganisationMutation,
  useSetMyExpertiseMutation,
  useClearBrandAssetMutation,
  useUploadBrandAssetMutation,
  useCreateListingMutation,
  useUpdateListingMutation,
} = directoryEndpoints;
