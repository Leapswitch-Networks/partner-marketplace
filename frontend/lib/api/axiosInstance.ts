import axios from "axios";
import { API_BASE_URL } from "@/lib/utils/constants";

/**
 * Default request timeout. Deliberately short: an unreachable backend should
 * surface as an error the UI can show, not as a spinner that never resolves.
 */
const DEFAULT_TIMEOUT_MS = 5000;

/**
 * For endpoints that are legitimately slow, passed per request:
 *
 *   axiosInstance.get("/api/activity/export", { timeout: LONG_TIMEOUT_MS })
 *
 * `GET /api/activity/export` is the case this exists for. It is the one read with
 * no upper bound — "everything, for the audit" is the point of it — and it is
 * streamed rather than assembled in memory precisely because it can be large. At
 * the 5s default the client kills a working export of any real size, and the
 * failure looks like a server problem rather than a client timeout. Bulk user
 * operations are the other candidate.
 */
export const LONG_TIMEOUT_MS = 120000;

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: DEFAULT_TIMEOUT_MS,
  withCredentials: true, // send httpOnly cookies on every request
});

/**
 * The in-flight refresh, shared by every request that gets a 401 while it runs.
 *
 * Without this, a screen firing four requests in parallel that all 401 sends four
 * `POST /api/auth/refresh` calls. That currently *works*, but only by accident:
 * the backend rotates refresh tokens with reuse detection, so the first call
 * rotates and the other three present a superseded token — and are honoured only
 * because they land inside `REFRESH_ROTATION_GRACE_SECONDS` (30s).
 *
 * That grace window was added for a different reason: two browser tabs refreshing
 * at the same instant. Leaning on it here means a correctness property of this
 * client depends on a backend tolerance it never asked for. Narrow the window and
 * this starts revoking sessions — reuse detection kills the whole session, so the
 * symptom would be users being signed out at random under load, which is close to
 * undiagnosable from the frontend.
 *
 * One shared promise makes the single-flight intentional instead of incidental.
 */
let refreshInFlight: Promise<void> | null = null;

function refreshSession(): Promise<void> {
  if (refreshInFlight) return refreshInFlight;

  // Bare `axios`, not `axiosInstance` — going through the instance would run this
  // interceptor on the refresh call itself and recurse.
  refreshInFlight = axios
    .post(`${API_BASE_URL}/api/auth/refresh`, {}, { withCredentials: true, timeout: 3000 })
    .then(() => undefined)
    .finally(() => {
      // Cleared whether it resolved or rejected, so the next 401 after a failed
      // refresh can try again rather than awaiting a permanently settled promise.
      refreshInFlight = null;
    });

  return refreshInFlight;
}

// Response interceptor: on 401 refresh once (at most once concurrently), then retry.
axiosInstance.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config as typeof error.config & { _retry?: boolean };

    // Don't intercept refresh or logout calls themselves. Logout must never be
    // retried behind a refresh — it has to succeed even with dead credentials.
    const url: string = original?.url ?? "";
    if (url.includes("/api/auth/refresh") || url.includes("/api/auth/logout")) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        await refreshSession();
        return axiosInstance(original);
      } catch {
        // Reject with the original error so callers see the real status/detail
        // rather than the refresh failure, which they cannot act on.
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
