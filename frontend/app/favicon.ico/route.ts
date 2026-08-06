import { NextResponse } from "next/server";
import { SERVER_API_BASE_URL } from "@/lib/utils/constants";

/**
 * Serve the installation's favicon: the uploaded one, or the bundled default.
 *
 * **Why a route handler and not the file convention or a rewrite.**
 *
 * `app/favicon.ico` as a *file* is an App Router metadata convention, resolved at
 * build time — it cannot read a database, so an uploaded icon could never reach it.
 *
 * A `next.config.mjs` rewrite cannot do it either, and the reason is worth writing
 * down: `beforeFiles` would intercept the path and return the API's 404 when nothing
 * is uploaded, never falling through to the static file; `afterFiles` would serve the
 * static file first and never reach the API. Neither expresses "uploaded, else
 * default". A handler does, and it leaves the protected config untouched.
 *
 * **The path is `/favicon.ico` on purpose.** Browsers request that exact path whether
 * or not a `<link rel="icon">` says so — bookmarks, tabs and crawlers all do. Serving
 * from `/api/favicon` and pointing the tag at it would leave every one of those
 * fetching a stale or missing icon.
 *
 * This route is dynamic, which costs nothing: it is one asset request, not a page, and
 * the page routes stay prerendered because `metadata.icons` points at a **stable path**
 * whose bytes vary rather than at a URL that varies.
 */
export async function GET(request: Request) {
  try {
    const upstream = await fetch(`${SERVER_API_BASE_URL}/api/settings/branding/favicon`, {
      // No caching here. The upstream response carries its own long-lived,
      // version-keyed `Cache-Control`, and caching the *proxy* as well would mean two
      // caches to invalidate on upload instead of one.
      cache: "no-store",
    });

    if (upstream.ok) {
      return new NextResponse(await upstream.arrayBuffer(), {
        headers: {
          "Content-Type": upstream.headers.get("content-type") ?? "image/x-icon",
          // Shorter than the API's own year: this path is stable, so the bytes behind
          // it genuinely can change. An hour is long enough to keep the request off
          // the hot path and short enough that a replaced icon appears on its own.
          "Cache-Control": "public, max-age=3600",
        },
      });
    }
  } catch {
    // API unreachable — fall through to the bundled default rather than 500. A
    // missing favicon must never be the reason a page looks broken.
  }

  // 307 rather than a body: lets the static file be served by whatever normally
  // serves `public/`, with its own caching, instead of streaming it through Node.
  //
  // Resolved against the incoming request's own origin, never a hardcoded host —
  // otherwise this redirects to localhost from every deployed environment.
  return NextResponse.redirect(new URL("/favicon-default.ico", request.url), 307);
}
