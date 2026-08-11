import axiosInstance from "./axiosInstance";

/**
 * The settings registry (LeapDesk parity, Module 11 — Configuration).
 *
 * **Not `settingsApi`.** That one is the installation's *identity* — name,
 * monogram, tagline, theme — a singleton row with a deliberately unauthenticated
 * GET so the sign-in page can render before a session exists. This is an
 * authenticated, permission-gated registry of operational tunables. Same English
 * word, two unrelated things; the paths say which.
 */

export type SettingType = "bool" | "int" | "string" | "text" | "json";

export interface Setting {
  id: number;
  key: string;
  label: string;
  description: string | null;
  type: SettingType;
  /** "Yes / No", "Number", … — sent by the API so this file holds no copy of it. */
  type_label: string;
  group: string;
  module: string;
  /** Whatever `type` says it is. Narrow with `type` at the point of rendering. */
  value: unknown;
  updated_at: string;
}

export interface SettingListResponse {
  items: Setting[];
  /** Distinct modules present in the data — the index filter's options. */
  modules: string[];
  types: { value: string; label: string }[];
}

export const configurationApi = {
  /**
   * Every setting, ordered `module → group → label`.
   *
   * **Deliberately unpaged**, matching the API. The registry is declared in code
   * and is tens of rows, so the screen filters and pages in the browser — the
   * same call Roles makes, for the same reason.
   */
  list: (params: { module?: string } = {}) =>
    axiosInstance.get<SettingListResponse>("/settings/configuration", { params }),

  /**
   * Change one value.
   *
   * The server validates against the row's own declared type and answers 422
   * naming the setting, so the caller does not need to know what shape this key
   * accepts — which is what lets one screen edit five different editors.
   */
  update: (id: number, value: unknown) =>
    axiosInstance.put<Setting>(`/settings/configuration/${id}`, { value }),
};

export default configurationApi;
