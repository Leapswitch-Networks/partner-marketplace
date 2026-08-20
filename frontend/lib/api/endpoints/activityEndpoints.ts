import { api } from "@/lib/store/api";
import type {
  ActivityEntry,
  ActivityFilterOptions,
  ActivityFilters,
} from "@/lib/api/rbacApi";

/**
 * The activity log as RTK Query endpoints — PM-41 § 4.5.
 *
 * **Read-only, and the only module here with no mutations at all.** The log is
 * written server-side as a side effect of other writes; nothing on this screen
 * can change a row, which is the property that makes it an audit log.
 *
 * ## What the cache buys without a single invalidation
 *
 * Paging back and forth is the normal way this screen is used — you page forward
 * looking for something, then back to the row you passed. Under the old pattern
 * every one of those was a fresh request for a page whose contents cannot change.
 * Now only the first visit to each page costs anything.
 *
 * `filterOptions` is the bigger win: it is one request standing in for four, it
 * changes only when a new *kind* of action first occurs, and it was refetched on
 * every mount. One cache entry serves the rest of the session.
 *
 * ## The envelope
 *
 * `/activity` answers with `page` and `per_page` alongside `items`/`total`/`pages`
 * — two fields more than the shared `Paginated<T>`, which is why this is typed
 * inline rather than reusing it. `ResourceIndex` reads only `total` and `pages`;
 * the other two are echoed request state.
 */
export const activityEndpoints = api.injectEndpoints({
  endpoints: (build) => ({
    listActivity: build.query<
      {
        items: ActivityEntry[];
        total: number;
        page: number;
        per_page: number;
        pages: number;
      },
      ActivityFilters | void
    >({
      query: (params) => ({ url: "/activity", params: params ?? {} }),
      providesTags: (result) =>
        result
          ? [
              ...result.items.map((a) => ({ type: "Activity" as const, id: a.id })),
              { type: "Activity" as const, id: "LIST" },
            ]
          : [{ type: "Activity" as const, id: "LIST" }],
    }),

    /**
     * Every dropdown on the index in one call, read from the data and scoped to
     * what the caller may see — so an option that would return an empty table is
     * never offered.
     */
    activityFilterOptions: build.query<ActivityFilterOptions, void>({
      query: () => "/activity/filter-options",
      providesTags: [{ type: "Activity", id: "OPTIONS" }],
    }),
  }),
});

export const { useListActivityQuery, useActivityFilterOptionsQuery } = activityEndpoints;
