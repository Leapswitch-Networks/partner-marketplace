import axiosInstance from "./axiosInstance";

/**
 * System Health (LeapDesk parity, Module 18).
 *
 * Panels are typed individually rather than through a shared `Panel` shape: each
 * one genuinely differs, and a common type would be five optional fields of which
 * four are null in any given panel.
 */

export interface HealthTable {
  name: string;
  size: string;
  rows: number;
}

export interface SystemHealth {
  database: {
    reachable: boolean;
    version?: string;
    size?: string;
    tables: HealthTable[];
    error?: string;
  };
  /** `kind: "database"` — our binary assets are columns, not files. */
  storage: {
    kind: string;
    assets_bytes: number;
    detail: { name: string; bytes: number }[];
  };
  errors: {
    available: boolean;
    counts: Record<string, number>;
    open: number;
    latest: { id: number; exception_class: string; last_seen_at: string | null } | null;
  };
  /** `configured: false` when no worker exists — never zeroed counters. */
  queue: { configured: boolean; reason?: string };
  /** `probing_available: false` until Module 7 lands. */
  providers: { probing_available: boolean; reason?: string; total: number; active: number };
}

export const healthApi = {
  overview: () => axiosInstance.get<SystemHealth>("/system/health"),
};

export default healthApi;
