import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

/**
 * Bust the cached branding so a save is visible immediately.
 *
 * **Why this exists.** `getBranding` fetches with `next.revalidate: 300`, which is
 * what keeps 16 routes prerendered instead of server-rendered per request
 * (DYNAMIC_BRANDING_PLAN § 3.2). The cost is that a saved change would not appear
 * for up to five minutes — and `router.refresh()` does not help, because it
 * re-renders server components while the *fetch* result stays cached.
 *
 * That was not a theoretical rough edge. It was observed: a branding save landed in
 * the database and in the audit log, and the rendered page kept serving the previous
 * values until the container was restarted. Picking a brand colour and watching
 * nothing happen reads as a broken feature.
 *
 * `revalidateTag` drops both tagged entries — branding and the theme catalog — so
 * the next render refetches. The `tags: ["branding"]` on those fetches is what makes
 * this possible; remove them and this route silently does nothing.
 *
 * **Deliberately unauthenticated.** It returns no data and mutates nothing; the
 * worst an anonymous caller achieves is making one server-side request to
 * `/api/settings/branding`, which is itself public. Requiring a session would mean
 * reading cookies, which opts the handler into dynamic rendering for no gain. It is
 * in the rate limiter's default tier along with everything else.
 */
export async function POST() {
  revalidateTag("branding");
  return new NextResponse(null, { status: 204 });
}
