import {
  APP_CHROME_SUBTITLE,
  APP_MONOGRAM,
  APP_NAME,
  APP_SHORT_NAME,
  APP_TAGLINE,
  SERVER_API_BASE_URL,
} from "@/lib/utils/constants";

/** The project's identity, fully resolved. Mirrors the backend's `BrandingResponse`. */
export type Branding = {
  app_name: string;
  app_short_name: string;
  monogram: string;
  chrome_subtitle: string;
  tagline: string;
  /** Key of the active theme preset. Always resolved — never null. */
  theme_preset: string;
  /**
   * `{"--brand": "36 105 92", …}`, computed by the backend from its preset catalog.
   *
   * Inlined verbatim into a `<style>` on `:root`. Channels are space-separated RGB
   * so Tailwind's `<alpha-value>` keeps working — 12 opacity variants depend on it.
   * The frontend never knows the palette, so adding a preset needs no frontend
   * release.
   */
  theme_css_variables: Record<string, string>;
};

/**
 * What renders before, or instead of, a successful fetch. Read at build time from
 * `NEXT_PUBLIC_*`, so a project reusing this core is branded by its `.env` even if
 * the API is unreachable and even if nothing has ever been saved.
 */
export const FALLBACK_BRANDING: Branding = {
  app_name: APP_NAME,
  app_short_name: APP_SHORT_NAME,
  monogram: APP_MONOGRAM,
  chrome_subtitle: APP_CHROME_SUBTITLE,
  tagline: APP_TAGLINE,
  // Empty rather than the teal values duplicated here. `globals.css` `:root` already
  // holds the default theme, so emitting nothing leaves the CSS default in force —
  // which is exactly the right behaviour when the API is unreachable. Repeating the
  // channels would create a second copy to keep in sync.
  theme_preset: "teal",
  theme_css_variables: {},
};

/**
 * How long a fetched value is served before Next re-fetches it, in seconds.
 *
 * This is the knob that keeps routes **static**. `fetch` with `next.revalidate` is
 * compatible with static generation (ISR): the page is prerendered and regenerated
 * in the background. `cache: "no-store"` — or reading `cookies()`/`headers()` — would
 * opt the route into dynamic rendering instead, and there are 15 static routes to
 * lose. See DYNAMIC_BRANDING_PLAN § 3.2.
 *
 * The cost of the cache is that a branding change takes up to five minutes to appear.
 * That is the right trade for a value that changes once a project; if it ever needs
 * to be instant, the fix is `revalidateTag` from the settings route — not `no-store`.
 */
const REVALIDATE_SECONDS = 300;

/**
 * Read the branding server-side. **Never throws.**
 *
 * Called while rendering the root layout, which means a failure here would be a
 * blank application rather than a degraded one. Every failure mode — API down, DNS
 * unresolvable during a container build, malformed response — resolves to
 * `FALLBACK_BRANDING`.
 *
 * The build-time case is not hypothetical: `next build` runs with
 * `NEXT_PUBLIC_API_URL` pointing at a host that is usually not reachable from the
 * build container, so prerendering *will* take this path. That is fine and is why
 * the env fallback has to be complete rather than partial.
 */
export async function getBranding(): Promise<Branding> {
  try {
    const res = await fetch(`${SERVER_API_BASE_URL}/api/settings/branding`, {
      next: { revalidate: REVALIDATE_SECONDS, tags: ["branding"] },
    });
    if (!res.ok) return FALLBACK_BRANDING;

    const data = (await res.json()) as Partial<Branding>;

    // Merged field by field rather than spread wholesale. A response missing a key,
    // or carrying an empty string, must fall back for *that field* — otherwise one
    // absent value renders as blank instead of as the configured default.
    return {
      app_name: data.app_name || FALLBACK_BRANDING.app_name,
      app_short_name: data.app_short_name || FALLBACK_BRANDING.app_short_name,
      monogram: data.monogram || FALLBACK_BRANDING.monogram,
      chrome_subtitle: data.chrome_subtitle || FALLBACK_BRANDING.chrome_subtitle,
      tagline: data.tagline || FALLBACK_BRANDING.tagline,
      theme_preset: data.theme_preset || FALLBACK_BRANDING.theme_preset,
      theme_css_variables: data.theme_css_variables ?? {},
    };
  } catch {
    return FALLBACK_BRANDING;
  }
}

/** One theme, as the catalog endpoint describes it. */
export type ThemePreset = {
  key: string;
  label: string;
  brand: string;
  brand_on_dark: string;
  contrast_white_on_brand: number;
  contrast_on_dark_on_card: number;
};

/**
 * The theme catalog, server-side. **Never throws** — returns `[]` on any failure.
 *
 * An empty list renders a settings page with no colour picker, which is a degraded
 * page rather than a broken one. Fetched here rather than in the form so the picker
 * needs no `useEffect`, which is what keeps this feature off PM-30's ledger.
 */
export async function getThemePresets(): Promise<ThemePreset[]> {
  try {
    const res = await fetch(`${SERVER_API_BASE_URL}/api/settings/branding/themes`, {
      next: { revalidate: REVALIDATE_SECONDS, tags: ["branding"] },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { presets?: ThemePreset[] };
    return data.presets ?? [];
  } catch {
    return [];
  }
}

/**
 * The active theme as a CSS rule, for an inline `<style>` in the root layout.
 *
 * Returns `null` when there is nothing to override, and that case matters: emitting
 * an empty `:root{}` is harmless but emitting a *partial* set would leave some
 * tokens themed and others on the CSS default. `globals.css` already carries a
 * complete default theme, so nothing to inject means the default stays in force.
 *
 * The values are numeric RGB channels from a closed backend catalog, never free
 * text — so there is no injection surface here. It is still worth stating, because
 * an inline `<style>` built from an API response is a shape that usually deserves
 * suspicion.
 */
export function themeStyleRule(branding: Branding): string | null {
  const entries = Object.entries(branding.theme_css_variables ?? {});
  if (entries.length === 0) return null;

  const declarations = entries
    // Defensive: only well-formed `--name: n n n` pairs survive, so a malformed or
    // unexpected value is dropped rather than emitted into the document.
    .filter(([name, value]) => /^--[a-z-]+$/.test(name) && /^\d{1,3}( \d{1,3}){2}$/.test(value))
    .map(([name, value]) => `${name}:${value}`)
    .join(";");

  return declarations ? `:root{${declarations}}` : null;
}
