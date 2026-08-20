import { api } from "@/lib/store/api";
import type {
  ErrorGroup,
  ErrorGroupDetail,
  ErrorStatus,
  ListErrorsParams,
} from "@/lib/api/errorApi";
import type { Paginated } from "@/types";

/**
 * Error tracking as RTK Query endpoints — PM-41 § 4.5.
 *
 * ## What tags fix on this screen specifically
 *
 * `status` is both a *filter* and the thing every write on the screen changes.
 * Under the old pattern a triage used `patchRow`, so marking a group resolved
 * while filtered to `open` left it sitting in a list it no longer belonged to —
 * the stale-row-with-no-error case. Invalidating the collection re-runs the
 * filtered query instead, and the row leaves the view because the server says so.
 *
 * ## Why the detail is a query and not a hand-rolled fetch
 *
 * `getError` returns the occurrence list, which is the expensive half. Holding it
 * in the cache means reopening the same group is free, and — more usefully — a
 * triage of that group invalidates its id, so the detail modal's own copy of
 * `status` and `notes` cannot go stale behind the table.
 */
export const errorsEndpoints = api.injectEndpoints({
  endpoints: (build) => ({
    listErrors: build.query<Paginated<ErrorGroup>, ListErrorsParams | void>({
      query: (params) => ({ url: "/errors", params: params ?? {} }),
      providesTags: (result) =>
        result
          ? [
              ...result.items.map((e) => ({ type: "ErrorGroup" as const, id: e.id })),
              { type: "ErrorGroup" as const, id: "LIST" },
            ]
          : [{ type: "ErrorGroup" as const, id: "LIST" }],
    }),

    /** `{status: count}` for the summary cards. Absent statuses are omitted, not 0. */
    errorCounts: build.query<Record<string, number>, void>({
      query: () => "/errors/counts",
      // The collection, viewed by status — same reasoning as `invitationStats`.
      providesTags: [{ type: "ErrorGroup", id: "LIST" }],
    }),

    getError: build.query<ErrorGroupDetail, number>({
      query: (id) => `/errors/${id}`,
      providesTags: (_result, _error, id) => [{ type: "ErrorGroup", id }],
    }),

    setErrorStatus: build.mutation<
      ErrorGroup,
      { id: number; status: ErrorStatus; notes?: string | null }
    >({
      query: ({ id, status, notes }) => ({
        url: `/errors/${id}/status`,
        method: "PATCH",
        body: { status, notes },
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: "ErrorGroup", id },
        { type: "ErrorGroup", id: "LIST" },
      ],
    }),

    /** Destroys the evidence of a bug — gated on `error-manage`, and confirms first. */
    deleteError: build.mutation<void, number>({
      query: (id) => ({ url: `/errors/${id}`, method: "DELETE" }),
      invalidatesTags: [{ type: "ErrorGroup", id: "LIST" }],
    }),
  }),
});

export const {
  useListErrorsQuery,
  useErrorCountsQuery,
  useGetErrorQuery,
  useSetErrorStatusMutation,
  useDeleteErrorMutation,
} = errorsEndpoints;
