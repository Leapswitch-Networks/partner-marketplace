import { createApi } from "@reduxjs/toolkit/query/react";

import { axiosBaseQuery } from "@/lib/api/baseQuery";

/**
 * The application's single RTK Query API — **PM-41's data layer**.
 *
 * ## The problem this closes
 *
 * Measured 2026-08-17: 49 frontend files used `useEffect`, and 17 of 20 admin
 * modules fetched on mount. Redux carried authentication and nothing else.
 * The hook this replaced (`useResourceList`, deleted 2026-08-20 once the last
 * module moved off it) had already collapsed the *boilerplate* — five `useState`s
 * and a try/catch per module — but it could not fix what the pattern costs:
 *
 * * **No cache.** Navigating Users → Roles → Users refetches Users. The data was
 *   in memory a second ago.
 * * **No invalidation.** After a write, each module calls `refetch()` by hand.
 *   Forget it and the table silently shows stale rows — a bug with no error.
 * * **No deduplication.** Two components needing the same list make two requests.
 * * **It is the cause of PM-30.** Fetch-on-mount is what a codebase does when it
 *   has no data layer, so the react-hooks error count rose with every new module
 *   regardless of the React version. PM-30 was closed by fixing symptoms; this
 *   removes the cause.
 *
 * ## Why RTK Query and not TanStack Query
 *
 * `@reduxjs/toolkit` and `react-redux` are **already dependencies**, already
 * configured, and already hold the auth slice. RTK Query is a submodule of the
 * package that is installed — so this costs **zero new packages**, which matches
 * the standing preference in this codebase that removed `passlib` and
 * hand-wrote the rate limiter rather than adding `slowapi`.
 *
 * TanStack Query has the nicer API and would cost one dependency. If the balance
 * ever tips, the swap is contained: components use generated hooks, and the
 * transport is already isolated in `baseQuery.ts`.
 *
 * ## The two rules the deleted hook encoded, and where they live now
 *
 * Worth writing down here, because both are easy to lose and neither is obvious
 * from RTK Query's own documentation:
 *
 * **1. Do not fetch before the filters are restored.** `useResourceQuery` reads
 * the initial filters out of the query string on mount, so a fetch that fires
 * first goes out with defaults and is immediately repeated with the real ones —
 * a wasted round trip and a visible flash of the wrong rows on a deep link.
 * Every list query therefore passes `{ skip: !q.ready }`.
 *
 * **2. A failed refresh must not blank the table.** Showing an empty state on
 * error reads as "you have no users". RTK Query keeps the previous `data` while
 * `isFetching` and on failure, so this now falls out of the library rather than
 * being a rule someone has to remember — which is why `isFetching` and not
 * `isLoading` is what drives the spinner.
 *
 * ## Tags are the contract
 *
 * A query declares what it `provides`; a mutation declares what it
 * `invalidates`. Getting that pairing right is what removes every manual
 * `refetch()` call — and getting it *wrong* is the one failure mode of this
 * design, because a missing invalidation shows stale data with no error. Add a
 * tag here when you add a resource, and keep the list alphabetical so two people
 * adding one at once conflict in the diff rather than silently duplicating.
 */
export const api = createApi({
  reducerPath: "api",
  baseQuery: axiosBaseQuery(),

  //: Every cacheable resource. Endpoint slices in `lib/api/endpoints/*` extend
  //: this API with `injectEndpoints`, so they do not each create their own —
  //: two `createApi` calls would mean two caches and two stores' worth of state.
  tagTypes: [
    // Append-only: the client never writes an activity row, so nothing
    // invalidates this today. It is declared anyway because the log *is* a
    // cacheable resource, and a tag that exists is what lets a future writer
    // refresh it without reaching for `api.util.invalidateTags` from a component.
    "Activity",
    "ApiConsumer",
    "Credential",
    "DataAccessGrant",
    "ErrorGroup",
    "FeatureFlag",
    "Invitation",
    "Partner",
    "PartnerTier",
    "Provider",
    "Role",
    "SearchEntity",
    "Setting",
    // The directory product — added 2026-08-18 with PM-41's first repayment.
    "Category",
    "Listing",
    "Enquiry",
    "User",
    "Webhook",
    "WorkerJob",
  ] as const,

  endpoints: () => ({}),
});

export default api;
