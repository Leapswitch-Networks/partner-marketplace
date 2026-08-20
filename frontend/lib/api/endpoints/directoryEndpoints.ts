import { api } from "@/lib/store/api";
import type {
  Category,
  Enquiry,
  EnquiryMessage,
  EnquiryStatus,
  Listing,
  ListingStatus,
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
} = directoryEndpoints;
