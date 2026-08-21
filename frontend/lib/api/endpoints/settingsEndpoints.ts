import { api } from "@/lib/store/api";
import type { Setting, SettingListResponse } from "@/lib/api/configurationApi";
import type { SecurityOverview } from "@/lib/api/securityApi";

/**
 * The settings registry, and the security half of it.
 *
 * ## Two endpoints over one table, and they must invalidate each other
 *
 * `/settings/configuration` serves the whole registry; `/settings/security` serves
 * the `security.*` rows plus the audit that goes with them. They are separate
 * routes because the security screen needs the audit and the configuration screen
 * does not, but **they read the same rows** — so a write through either has to
 * refresh both. Otherwise changing the session timeout on the Security screen
 * leaves the Configuration screen showing the old number, with nothing to
 * indicate which of the two is lying.
 *
 * That is the whole reason both carry `Setting`/`LIST` rather than a tag of their
 * own.
 *
 * ## Unpaged, deliberately
 *
 * Matching the API: the registry is declared in code and is tens of rows, so both
 * screens filter and page in the browser. Same call and the same reasoning as the
 * roles list — a paged query would refetch on every keystroke.
 */
export const settingsEndpoints = api.injectEndpoints({
  endpoints: (build) => ({
    listSettings: build.query<SettingListResponse, { module?: string } | void>({
      query: (params) => ({ url: "/settings/configuration", params: params ?? {} }),
      providesTags: [{ type: "Setting", id: "LIST" }],
    }),

    updateSetting: build.mutation<Setting, { id: number; value: unknown }>({
      query: ({ id, value }) => ({
        url: `/settings/configuration/${id}`,
        method: "PUT",
        body: { value },
      }),
      invalidatesTags: [{ type: "Setting", id: "LIST" }],
    }),

    /** Controls and audit in one request — the page is useless with either half missing. */
    securityOverview: build.query<SecurityOverview, void>({
      query: () => "/settings/security",
      providesTags: [{ type: "Setting", id: "LIST" }],
    }),

    /**
     * Change one control. The API refuses anything outside `security.*` with a
     * 404, so this cannot become a second write path to the rest of the registry.
     */
    updateSecuritySetting: build.mutation<Setting, { id: number; value: unknown }>({
      query: ({ id, value }) => ({
        url: `/settings/security/${id}`,
        method: "PUT",
        body: { value },
      }),
      invalidatesTags: [{ type: "Setting", id: "LIST" }],
    }),
  }),
});

export const {
  useListSettingsQuery,
  useUpdateSettingMutation,
  useSecurityOverviewQuery,
  useUpdateSecuritySettingMutation,
} = settingsEndpoints;
