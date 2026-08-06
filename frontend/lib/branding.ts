import {
  APP_CHROME_SUBTITLE,
  APP_MONOGRAM,
  APP_NAME,
  APP_SHORT_NAME,
  APP_TAGLINE,
  API_BASE_URL,
} from "@/lib/utils/constants";

/** The project's identity, fully resolved. Mirrors the backend's `BrandingResponse`. */
export type Branding = {
  app_name: string;
  app_short_name: string;
  monogram: string;
  chrome_subtitle: string;
  tagline: string;
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
    const res = await fetch(`${API_BASE_URL}/api/settings/branding`, {
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
    };
  } catch {
    return FALLBACK_BRANDING;
  }
}
