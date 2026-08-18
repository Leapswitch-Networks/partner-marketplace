import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/utils/constants";

/**
 * `app/robots.ts` — the Next 14 file convention, served at `/robots.txt`.
 *
 * ## What is disallowed, and why each one
 *
 * § 20.4 sets the list. Each entry closes a specific hole rather than being
 * defensive by habit:
 *
 * | Path | Why |
 * |---|---|
 * | `/dashboard`, `/settings` | The signed-in app. Crawling it yields sign-in pages and nothing else |
 * | `/sign-in`, `/sign-up`, and the rest of `(auth)` | Login screens in a search index are noise, and the reset flows carry tokens |
 * | `/api` | Not pages |
 * | `/enquiries` | **Capability URLs.** An enquiry reference is the only thing protecting that thread; a crawled one is a leaked one |
 * | `/search` | Near-duplicate content. Also `noindex` on the page itself — belt and braces, because a `robots.txt` disallow means the page is never *read*, so a `noindex` inside it is never seen |
 *
 * ⚠️ **`Disallow` is not access control.** It is a request that well-behaved
 * crawlers honour. Everything above is independently enforced by the backend
 * and by `middleware.ts`; this file only keeps the public index clean.
 *
 * One thing learned from studying Justdial's own `robots.txt` (`FRONTEND_PLAN.md`
 * § 12.1): they allow user-directed AI agents while blocking the crawlers. That
 * distinction is worth revisiting here once this surface has traffic worth
 * caring about — it is deliberately not being guessed at now.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard",
        "/settings",
        "/api",
        "/enquiries",
        "/search",
        "/sign-in",
        "/sign-up",
        "/forgot-password",
        "/reset-password",
        "/verify-email",
        "/accept-invitation",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
