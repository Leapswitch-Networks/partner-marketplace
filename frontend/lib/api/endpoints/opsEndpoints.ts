import { api } from "@/lib/store/api";
import type { ApiOperation, CatalogueSummary } from "@/lib/api/apiDocsApi";
import type { SystemHealth } from "@/lib/api/healthApi";
import type { JobRun, JobStatus, WorkerSummary } from "@/lib/api/workerApi";
import type { RecycleBinResponse } from "@/lib/api/recycleBinApi";

/**
 * The Operations screens — health, API documentation, background jobs, recycle bin.
 *
 * ## Why these four share a slice
 *
 * Every other slice in this directory is one domain with a table behind it. These
 * are four small read surfaces over the *running application* rather than over
 * stored records, and three of them have no writes at all. Four files of six lines
 * each would be filing for its own sake; they are grouped the way the sidebar
 * groups them.
 *
 * ## Two of them are snapshots, and that changes what caching means
 *
 * `systemHealth` and the API catalogue describe the process that is answering the
 * request. Nothing a user does invalidates them — so they carry
 * `keepUnusedDataFor: 0`, which means leaving the screen discards the answer. That
 * is the opposite of the default and it is deliberate: a cached health check is a
 * claim about the past presented as the present, and the whole value of the screen
 * is that it is current. Two visits a minute apart must ask twice.
 *
 * The API catalogue is the exception to the exception: it is generated from the
 * route table, so it cannot change until the application is redeployed. It caches
 * normally.
 */
export const opsEndpoints = api.injectEndpoints({
  endpoints: (build) => ({
    // --- System health ------------------------------------------------------
    systemHealth: build.query<SystemHealth, void>({
      query: () => "/system/health",
      providesTags: [{ type: "SystemHealth", id: "SNAPSHOT" }],
      // See the note above: a stale health check is worse than a slow one.
      keepUnusedDataFor: 0,
    }),

    // --- API documentation --------------------------------------------------
    apiCatalogue: build.query<{ summary: CatalogueSummary; operations: ApiOperation[] }, void>({
      query: () => "/api-docs",
      providesTags: [{ type: "ApiDocs", id: "CATALOGUE" }],
    }),

    /** Permission → the routes it opens. "What does granting this let someone do?" */
    apiDocsPermissions: build.query<Record<string, string[]>, void>({
      query: () => "/api-docs/permissions",
      providesTags: [{ type: "ApiDocs", id: "PERMISSIONS" }],
    }),

    // --- Background jobs ----------------------------------------------------
    workerJobs: build.query<{ summary: WorkerSummary; jobs: JobStatus[] }, void>({
      query: () => "/worker/jobs",
      providesTags: [{ type: "WorkerJob", id: "LIST" }],
      // A job's last-run time moves without anyone clicking anything, so this is
      // a snapshot too — but of a table rather than of the process, so it is
      // invalidatable and does not need the zero retention.
    }),

    workerRuns: build.query<JobRun[], { job?: string; status?: string; limit?: number } | void>({
      query: (params) => ({ url: "/worker/runs", params: params ?? {} }),
      providesTags: [{ type: "WorkerJob", id: "RUNS" }],
    }),

    // --- Recycle bin --------------------------------------------------------
    //
    // The list is unpaginated by design — the bin is small and is filtered in the
    // browser — so there is one cache entry regardless of the type filter, and the
    // `type` argument exists for a caller that wants one type without the rest.
    recycleBin: build.query<RecycleBinResponse, { type?: string } | void>({
      query: (params) => ({ url: "/recycle-bin", params: params ?? {} }),
      providesTags: [{ type: "RecycleBin", id: "LIST" }],
    }),

    restoreBinnedItem: build.mutation<{ message: string }, { type: string; id: string }>({
      query: (body) => ({ url: "/recycle-bin/restore", method: "POST", body }),
      // A restored record rejoins whatever list it came from, and this slice
      // cannot know which — so it invalidates the bin plus every collection a
      // soft delete can currently reach. Getting this wrong is not a crash: it is
      // a restored user who is missing from the users table until it is reloaded.
      invalidatesTags: [
        { type: "RecycleBin", id: "LIST" },
        { type: "User", id: "LIST" },
        { type: "Partner", id: "LIST" },
        { type: "Listing", id: "LIST" },
        { type: "Category", id: "LIST" },
        { type: "Role", id: "LIST" },
      ],
    }),

    /** The only irreversible delete left in the core. Confirm before calling. */
    purgeBinnedItem: build.mutation<{ message: string }, { type: string; id: string }>({
      query: (body) => ({ url: "/recycle-bin", method: "DELETE", body }),
      // Only the bin: a purged record was already absent from every other list.
      invalidatesTags: [{ type: "RecycleBin", id: "LIST" }],
    }),
  }),
});

export const {
  useSystemHealthQuery,
  useApiCatalogueQuery,
  useApiDocsPermissionsQuery,
  useWorkerJobsQuery,
  useWorkerRunsQuery,
  useRecycleBinQuery,
  useRestoreBinnedItemMutation,
  usePurgeBinnedItemMutation,
} = opsEndpoints;
