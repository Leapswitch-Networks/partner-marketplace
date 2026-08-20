import { api } from "@/lib/store/api";
import type {
  CreateGrantPayload,
  CreateGrantResult,
  DataAccessOptions,
  DataAccessPage,
  ListGrantsParams,
} from "@/lib/api/dataAccessApi";

/**
 * Data Access grants as RTK Query endpoints — PM-41 § 4.5.
 *
 * ## `can_manage` stops being a piece of state
 *
 * It rides on the list envelope, computed by the API from the same permission
 * constant the write routes are guarded on — one authority, so the button and the
 * guard cannot drift apart. The old code copied it into a `useState` from inside
 * the fetch callback, which meant a write during render's commit phase and a
 * second source of truth for a value that was already in hand. It is now read
 * straight off the cached response.
 *
 * ## Creating is an upsert, so it invalidates the collection
 *
 * `create` writes **or updates** each `(grantee, subject, scope)` pair and answers
 * with `created`/`skipped`/`skipped_reasons`. The client cannot tell which rows
 * are new and which moved, so it invalidates `LIST` and lets the server say.
 * `skipped_reasons` must still be surfaced by the caller — a partial success
 * must never read as a total one.
 */
export const dataAccessEndpoints = api.injectEndpoints({
  endpoints: (build) => ({
    listGrants: build.query<DataAccessPage, ListGrantsParams | void>({
      query: (params) => ({ url: "/data-access", params: params ?? {} }),
      providesTags: (result) =>
        result
          ? [
              ...result.items.map((g) => ({ type: "DataAccessGrant" as const, id: g.id })),
              { type: "DataAccessGrant" as const, id: "LIST" },
            ]
          : [{ type: "DataAccessGrant" as const, id: "LIST" }],
    }),

    /** Pickers for the create form. One cache entry, not one fetch per mount. */
    dataAccessOptions: build.query<DataAccessOptions, void>({
      query: () => "/data-access/options",
      providesTags: [{ type: "DataAccessGrant", id: "OPTIONS" }],
    }),

    createGrant: build.mutation<CreateGrantResult, CreateGrantPayload>({
      query: (body) => ({ url: "/data-access", method: "POST", body }),
      invalidatesTags: [{ type: "DataAccessGrant", id: "LIST" }],
    }),

    deleteGrant: build.mutation<{ message: string }, string>({
      query: (id) => ({ url: `/data-access/${id}`, method: "DELETE" }),
      invalidatesTags: [{ type: "DataAccessGrant", id: "LIST" }],
    }),
  }),
});

export const {
  useListGrantsQuery,
  useDataAccessOptionsQuery,
  useCreateGrantMutation,
  useDeleteGrantMutation,
} = dataAccessEndpoints;
