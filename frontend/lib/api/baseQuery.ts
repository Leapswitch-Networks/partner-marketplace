import type { BaseQueryFn } from "@reduxjs/toolkit/query";
import type { AxiosError, AxiosRequestConfig } from "axios";

import axiosInstance from "./axiosInstance";
import { extractApiError } from "@/lib/utils/apiError";

/**
 * RTK Query's transport, built **over the existing axios instance** rather than
 * over `fetch`.
 *
 * ## Why not RTK Query's `fetchBaseQuery`
 *
 * `axiosInstance` is not a thin wrapper. It carries three things this
 * application cannot lose, and re-implementing them on `fetch` would mean
 * maintaining two copies of each:
 *
 * 1. **The single-flight refresh.** A 401 triggers exactly one `POST
 *    /auth/refresh` no matter how many requests are in flight, and they all
 *    await it. The backend rotates refresh tokens with reuse detection, so a
 *    burst of parallel refreshes only works today by landing inside the
 *    30-second grace window — a race the shared promise removes rather than
 *    survives.
 * 2. **`withCredentials`.** Auth is an `httpOnly` cookie; a request without this
 *    is anonymous and the failure is a silent 401, not an error anyone can read.
 * 3. **The versioned `baseURL`.** Every path in `lib/api/*` is written relative
 *    to `${API_BASE_URL}${API_PREFIX}`, so a second transport would need the
 *    same prefix logic or every path would 404.
 *
 * ## The error shape
 *
 * Errors come back as `{ status, data }` where `data` is already the
 * human-readable message `extractApiError` produces. Components therefore render
 * `error.data` directly and never learn that axios exists — which is the point:
 * the transport is swappable, the component contract is not.
 */

export interface ApiError {
  /** HTTP status, or 0 when the request never reached the server. */
  status: number;
  /** A message fit to show a user. Never a raw axios error. */
  data: string;
}

export interface BaseQueryArgs {
  url: string;
  method?: AxiosRequestConfig["method"];
  /** Request body. Named `body` rather than `data` to match RTK Query's idiom. */
  body?: unknown;
  params?: AxiosRequestConfig["params"];
  /** Escape hatch for the one long-running export — see `LONG_TIMEOUT_MS`. */
  timeout?: number;
}

/**
 * `string | BaseQueryArgs`, so a plain GET is just its path.
 *
 * A `queryFn`-shaped function rather than a class: RTK Query only requires
 * something returning `{ data }` or `{ error }`, and the whole adapter is the
 * try/catch below.
 */
export const axiosBaseQuery =
  (): BaseQueryFn<string | BaseQueryArgs, unknown, ApiError> =>
  async (args) => {
    const config: BaseQueryArgs = typeof args === "string" ? { url: args } : args;

    try {
      const result = await axiosInstance({
        url: config.url,
        method: config.method ?? "GET",
        data: config.body,
        params: config.params,
        ...(config.timeout ? { timeout: config.timeout } : {}),
      });
      return { data: result.data };
    } catch (err) {
      const axiosError = err as AxiosError;
      return {
        error: {
          // 0 rather than a guess when the request never landed. A component
          // branching on 404 must not treat "the network is down" as "the
          // record is gone" — those need different copy and different recovery.
          status: axiosError.response?.status ?? 0,
          data: extractApiError(err, "Something went wrong. Please try again."),
        },
      };
    }
  };

export default axiosBaseQuery;
