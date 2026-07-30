import axios from "axios";
import { API_BASE_URL } from "@/lib/utils/constants";

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 5000, // fail fast when backend is unreachable
  withCredentials: true, // send httpOnly cookies on every request
});

// Response interceptor: on 401 try to refresh once, then logout + redirect to sign-in
axiosInstance.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config as typeof error.config & { _retry?: boolean };

    // Don't intercept refresh or logout calls themselves
    const url: string = original?.url ?? "";
    if (url.includes("/api/auth/refresh") || url.includes("/api/auth/logout")) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        await axios.post(
          `${API_BASE_URL}/api/auth/refresh`,
          {},
          { withCredentials: true, timeout: 3000 }
        );
        return axiosInstance(original);
      } catch {
        // Refresh failed — reject with the original error so callers see the real status/detail
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
