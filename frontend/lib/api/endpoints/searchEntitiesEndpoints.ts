import { api } from "@/lib/store/api";
import type {
  ListEntitiesParams,
  SearchableEntity,
  SearchableEntityPage,
  SearchableEntityPayload,
  SearchResponse,
} from "@/lib/api/searchApi";

/**
 * The searchable-entity registry as RTK Query endpoints — PM-41 § 4.5.
 *
 * ## Three values ride on the list envelope, and none of them is state
 *
 * `can_manage`, `groups` and `available_models` all come back with the page. The
 * old code copied each into a `useState` from inside the fetch callback — three
 * writes during the commit phase, and three copies of data already in hand. They
 * are read off the cached response now.
 *
 * `available_models` deliberately rides on the list rather than taking a second
 * request: it is small, it changes only with a deploy, and the form must not be
 * able to offer a model the API would refuse.
 *
 * ## Why `toggle` invalidates the collection and not just the row
 *
 * `enabled` is a filter on this table, so excluding an entity while filtered to
 * "included" should remove the row from view. `patchRow` left it sitting there
 * contradicting the filter above it.
 */
export const searchEntitiesEndpoints = api.injectEndpoints({
  endpoints: (build) => ({
    /**
     * The global search box. Any signed-in user may call it; what comes back is
     * decided per entity by its permission plus row scoping.
     *
     * ## Keyed on the term, which replaces a hand-rolled race guard
     *
     * `GlobalSearch` used to keep a sequence counter and discard any response
     * that was not from the newest keystroke — because a slow request for "ab"
     * could land after a fast one for "abcd" and overwrite the better answer.
     * Keying the cache on the term makes that structural: the hook only ever
     * returns the data for the argument it was last called with, so a late
     * response for an older term cannot be rendered. It also means backspacing
     * to a term already typed is instant.
     *
     * Not tagged: results are a view over every searchable table at once, and
     * there is no single collection whose change should invalidate them. They
     * expire on their own.
     */
    search: build.query<SearchResponse, { q: string; limit?: number }>({
      query: ({ q, limit }) => ({ url: "/search", params: { q, limit } }),
    }),

    listSearchEntities: build.query<SearchableEntityPage, ListEntitiesParams | void>({
      query: (params) => ({ url: "/settings/search", params: params ?? {} }),
      providesTags: (result) =>
        result
          ? [
              ...result.items.map((e) => ({ type: "SearchEntity" as const, id: e.id })),
              { type: "SearchEntity" as const, id: "LIST" },
            ]
          : [{ type: "SearchEntity" as const, id: "LIST" }],
    }),

    createSearchEntity: build.mutation<SearchableEntity, SearchableEntityPayload>({
      query: (body) => ({ url: "/settings/search", method: "POST", body }),
      invalidatesTags: [{ type: "SearchEntity", id: "LIST" }],
    }),

    updateSearchEntity: build.mutation<
      SearchableEntity,
      { id: number; data: SearchableEntityPayload }
    >({
      query: ({ id, data }) => ({
        url: `/settings/search/${id}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: "SearchEntity", id },
        { type: "SearchEntity", id: "LIST" },
      ],
    }),

    /** Include or exclude a type from every user's results. Returns the record. */
    toggleSearchEntity: build.mutation<SearchableEntity, number>({
      query: (id) => ({ url: `/settings/search/${id}/toggle`, method: "POST", body: {} }),
      invalidatesTags: (_r, _e, id) => [
        { type: "SearchEntity", id },
        { type: "SearchEntity", id: "LIST" },
      ],
    }),

    deleteSearchEntity: build.mutation<{ message: string }, number>({
      query: (id) => ({ url: `/settings/search/${id}`, method: "DELETE" }),
      invalidatesTags: [{ type: "SearchEntity", id: "LIST" }],
    }),
  }),
});

export const {
  useSearchQuery,
  useListSearchEntitiesQuery,
  useCreateSearchEntityMutation,
  useUpdateSearchEntityMutation,
  useToggleSearchEntityMutation,
  useDeleteSearchEntityMutation,
} = searchEntitiesEndpoints;
