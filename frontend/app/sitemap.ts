import type { MetadataRoute } from "next";

import { fetchAllPartnerSlugs, fetchCategories } from "@/lib/api/public";
import { AUDIENCE_PAGES } from "@/lib/public/siteContent";
import { SITE_URL } from "@/lib/utils/constants";

/**
 * `app/sitemap.ts` — the **Next 14 file convention**, not a route handler.
 *
 * `AGENTS.md` is emphatic that this is not the Next.js in anyone's training
 * data: this file exports a default function returning `MetadataRoute.Sitemap`
 * and Next serves it at `/sitemap.xml`. Writing a `route.ts` that returns XML by
 * hand also "works" and is the wrong thing — it opts out of the framework's own
 * validation and of the `MetadataRoute` type.
 *
 * ## What is in it, and what is deliberately not — § 20.4
 *
 * **Excluded:** `/search` and any enquiry URL. Search results are near-duplicate
 * content that search engines penalise, and an enquiry reference is a capability
 * URL — putting one in a sitemap hands out the capability.
 *
 * **Also excluded:** every category page, because none exists. § 8's threshold
 * governs their *existence* at our size (§ 14.1), so there is nothing to list.
 *
 * ⚠️ **Partner profiles are included but they canonicalise to the partner's own
 * site** (§ 9.1 commitment 2 — we do not outrank a company for its own name).
 * Listing a page whose canonical points elsewhere is intentional: it tells a
 * crawler the page exists and where the authority belongs.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // A sitemap that throws takes the route down; one that silently ships empty is
  // worse, because nothing alerts. Failing loudly is correct here — the route is
  // built, not requested by a user, so an error surfaces in the build rather
  // than to a visitor.
  const [partnerSlugs, categories] = await Promise.all([
    fetchAllPartnerSlugs(),
    fetchCategories(),
  ]);

  const staticRoutes = [
    { path: "/", priority: 1 },
    { path: "/partners", priority: 0.9 },
    { path: "/become-a-partner", priority: 0.9 },
    { path: "/verification", priority: 0.8 },
    { path: "/about", priority: 0.6 },
    { path: "/contact", priority: 0.6 },
    { path: "/terms", priority: 0.3 },
    { path: "/privacy", priority: 0.3 },
  ];

  return [
    ...staticRoutes.map((r) => ({
      url: `${SITE_URL}${r.path}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: r.priority,
    })),
    ...Object.keys(AUDIENCE_PAGES).map((slug) => ({
      url: `${SITE_URL}/for/${slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    // Live, from the API. `fetchAllPartnerSlugs` paginates — the endpoint caps
    // a page at 60, and a directory that outgrew one page would otherwise stop
    // listing its newest partners without anyone noticing.
    ...partnerSlugs.map((slug) => ({
      url: `${SITE_URL}/partners/${slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    // Categories that cleared the threshold. The API only returns categories
    // with listings behind them, so § 8's rule is applied at the source rather
    // than re-implemented here.
    ...categories.map((category) => ({
      url: `${SITE_URL}/services/${category.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
