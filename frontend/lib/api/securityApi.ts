import axiosInstance from "./axiosInstance";
import type { Setting } from "./configurationApi";

/**
 * Security — the hardening controls (LeapDesk parity, Module 12).
 *
 * The controls are `Setting` rows, reused rather than re-typed: they are the same
 * table Configuration serves, filtered to the `security.` namespace. A second
 * interface would be two shapes to keep in step for no gain.
 */

export interface SecurityAuditRow {
  id: number;
  description: string;
  event: string | null;
  log_name: string;
  /** Display name, `"system"` for automation, or `"deleted user"`. Never null. */
  causer: string;
  created_at: string;
}

export interface SecurityOverview {
  /** Ordered `group → label`; the screen groups into tabs preserving that order. */
  items: Setting[];
  audit: SecurityAuditRow[];
}

export const securityApi = {
  /** Controls and audit in one request — the page is useless with either half missing. */
  overview: () => axiosInstance.get<SecurityOverview>("/settings/security"),

  /**
   * Change one control.
   *
   * **Refuses anything outside `security.*` with a 404**, so this cannot be used
   * as a second write path to the rest of the registry.
   */
  update: (id: number, value: unknown) =>
    axiosInstance.put<Setting>(`/settings/security/${id}`, { value }),
};

export default securityApi;
