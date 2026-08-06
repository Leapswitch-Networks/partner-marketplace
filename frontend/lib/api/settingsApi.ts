import axiosInstance from "./axiosInstance";
import type { Branding } from "@/lib/branding";

/**
 * Installation-wide settings — the project's identity.
 *
 * Note the read is **public** on the backend, so this module is also what an
 * unauthenticated screen would use. The write requires a super-admin *and* a recent
 * password confirmation, so callers must handle the `403` +
 * `X-Password-Confirmation-Required` response — see `BrandingForm`.
 */

/**
 * A partial update. Every field is optional, and `null` is meaningful:
 *
 *   - **omit** a field  → leave the stored value alone
 *   - send **`null`**   → clear the override, falling back to the deployment's
 *                         `APP_*` environment variable
 *
 * That is why this is not `Partial<Branding>`: `Partial` would let a field be
 * absent but not explicitly null, and the reset case needs null to reach the API.
 */
export type UpdateBrandingPayload = {
  app_name?: string | null;
  app_short_name?: string | null;
  monogram?: string | null;
  chrome_subtitle?: string | null;
  tagline?: string | null;
};

const settingsApi = {
  getBranding: () => axiosInstance.get<Branding>("/api/settings/branding"),

  updateBranding: (data: UpdateBrandingPayload) =>
    axiosInstance.put<Branding>("/api/settings/branding", data),
};

export default settingsApi;
