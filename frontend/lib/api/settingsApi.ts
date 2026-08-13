import axiosInstance, { LONG_TIMEOUT_MS } from "./axiosInstance";
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
  /**
   * A preset **key**, never a colour. The backend rejects an unknown key with a 422
   * rather than falling back, so a typo surfaces instead of silently applying the
   * default — see `schemas/settings.py`.
   */
  theme_preset?: string | null;
  /**
   * A custom `#rrggbb`. Wins over the preset while set; `null` clears it and the
   * preset takes back over. The backend refuses a colour whose white-label contrast
   * fails AA — the 422 detail carries `measured`, `required` and a passing
   * `suggestion` of the same hue, which the form turns into a one-click fix.
   */
  brand_color?: string | null;
};

/** The 422 detail the contrast gate returns. */
export type BrandColourRefusal = {
  message: string;
  measured: number;
  required: number;
  suggestion: string | null;
};

export type ThemePreviewResponse = {
  css_variables: Record<string, string>;
  contrast: { white_on_brand: number; on_dark_on_card: number };
  brand_color: string | null;
};

/** One theme, as the catalog endpoint describes it. */
export type ThemePresetOption = {
  key: string;
  label: string;
  brand: string;
  brand_on_dark: string;
  /** Measured WCAG ratios, shown next to the choice rather than hidden in a test. */
  contrast_white_on_brand: number;
  contrast_on_dark_on_card: number;
};

export type ThemePresetsResponse = {
  presets: ThemePresetOption[];
  default_key: string;
};

const settingsApi = {
  getBranding: () => axiosInstance.get<Branding>("/settings/branding"),

  updateBranding: (data: UpdateBrandingPayload) =>
    axiosInstance.put<Branding>("/settings/branding", data),

  /** The theme catalog. Public, and it needs no database. */
  getThemes: () =>
    axiosInstance.get<ThemePresetsResponse>("/settings/branding/themes"),

  /**
   * Compute what a colour or preset *would* apply — same variables, same
   * precedence, same refusal as saving, but nothing is written. What powers the
   * live preview; a preview computed client-side could drift from the save.
   */
  previewTheme: (data: { brand_color?: string | null; theme_preset?: string | null }) =>
    axiosInstance.post<ThemePreviewResponse>("/settings/branding/theme-preview", data),

  /**
   * Replace a brand image. Returns the whole updated branding, so a caller never has
   * to re-read it to learn the new cache-busted URL.
   *
   * No explicit `Content-Type`: axios sets the multipart boundary from the FormData
   * itself, and hardcoding `multipart/form-data` omits the boundary and the server
   * cannot parse the body.
   */
  uploadAsset: (asset: "logo" | "favicon", form: FormData) =>
    axiosInstance.post<Branding>(`/settings/branding/${asset}`, form, {
      // The 5s default is a fail-fast for an unreachable backend, not a budget for
      // sending half a megabyte. On a slow uplink it would abort a working upload and
      // report it as a server problem.
      timeout: LONG_TIMEOUT_MS,
    }),

  deleteAsset: (asset: "logo" | "favicon") =>
    axiosInstance.delete<Branding>(`/settings/branding/${asset}`),
};

export default settingsApi;
