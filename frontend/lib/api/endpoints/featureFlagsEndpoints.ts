import { api } from "@/lib/store/api";
import type {
  FeatureFlag,
  FeatureFlagOptions,
  FeatureFlagPage,
  FeatureFlagPayload,
  ListFlagsParams,
} from "@/lib/api/featureFlagApi";

/**
 * Feature flags as RTK Query endpoints — PM-41 § 4.5.
 *
 * ## `toggle` no longer patches the row
 *
 * The API returns the updated record, and the old comment on `featureFlagApi.toggle`
 * said the caller should therefore patch in place "instead of refetching what the
 * response already holds". That is true about the *record* and wrong about the
 * *table*: `enabled` is a filter on this index, so a flag disabled while the view
 * is filtered to "enabled" belongs out of the list entirely — which only a
 * re-query can decide. The row tag plus `LIST` covers both.
 *
 * `can_manage` rides on the list envelope, from the same permission constant the
 * write routes are guarded on, so it is read off the response rather than copied
 * into state from inside a fetch callback.
 */
export const featureFlagsEndpoints = api.injectEndpoints({
  endpoints: (build) => ({
    listFeatureFlags: build.query<FeatureFlagPage, ListFlagsParams | void>({
      query: (params) => ({ url: "/settings/feature-flags", params: params ?? {} }),
      providesTags: (result) =>
        result
          ? [
              ...result.items.map((f) => ({ type: "FeatureFlag" as const, id: f.id })),
              { type: "FeatureFlag" as const, id: "LIST" },
            ]
          : [{ type: "FeatureFlag" as const, id: "LIST" }],
    }),

    /** Targeting pickers. One cache entry, not one fetch per mount. */
    featureFlagOptions: build.query<FeatureFlagOptions, void>({
      query: () => "/settings/feature-flags/options",
      providesTags: [{ type: "FeatureFlag", id: "OPTIONS" }],
    }),

    createFeatureFlag: build.mutation<FeatureFlag, FeatureFlagPayload>({
      query: (body) => ({ url: "/settings/feature-flags", method: "POST", body }),
      invalidatesTags: [{ type: "FeatureFlag", id: "LIST" }],
    }),

    updateFeatureFlag: build.mutation<
      FeatureFlag,
      { id: number; data: FeatureFlagPayload }
    >({
      query: ({ id, data }) => ({
        url: `/settings/feature-flags/${id}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: "FeatureFlag", id },
        { type: "FeatureFlag", id: "LIST" },
      ],
    }),

    toggleFeatureFlag: build.mutation<FeatureFlag, number>({
      query: (id) => ({
        url: `/settings/feature-flags/${id}/toggle`,
        method: "POST",
        body: {},
      }),
      invalidatesTags: (_r, _e, id) => [
        { type: "FeatureFlag", id },
        { type: "FeatureFlag", id: "LIST" },
      ],
    }),

    deleteFeatureFlag: build.mutation<{ message: string }, number>({
      query: (id) => ({ url: `/settings/feature-flags/${id}`, method: "DELETE" }),
      invalidatesTags: [{ type: "FeatureFlag", id: "LIST" }],
    }),
  }),
});

export const {
  useListFeatureFlagsQuery,
  useFeatureFlagOptionsQuery,
  useCreateFeatureFlagMutation,
  useUpdateFeatureFlagMutation,
  useToggleFeatureFlagMutation,
  useDeleteFeatureFlagMutation,
} = featureFlagsEndpoints;
