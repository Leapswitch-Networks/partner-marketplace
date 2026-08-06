import { NextResponse } from "next/server";
import { SERVER_API_BASE_URL } from "@/lib/utils/constants";

/**
 * Serve the installation's favicon: the uploaded one, or the bundled default.
 *
 * `metadata.icons` points here, so this is what a browser tab shows.
 *
 * **Why this path and not `/favicon.ico`.** Three approaches were tried:
 *
 *   1. `app/favicon.ico` as a *file* is an App Router metadata convention resolved at
 *      build time — it cannot read a database.
 *   2. `app/favicon.ico/` as a *route handler directory* **fails the build**. Next 14
 *      still treats that name as the metadata convention and tries to resolve it as
 *      `app/favicon.ico?__next_metadata__`:
 *        `Module not found: Can't resolve '.../app/favicon.ico?__next_metadata__'`
 *      Measured, not assumed — the build broke.
 *   3. A `next.config.mjs` rewrite cannot express it either: `beforeFiles` returns the
 *      API's 404 when nothing is uploaded instead of falling through to the static
 *      file, and `afterFiles` serves the static file first and never reaches the API.
 *
 * So the dynamic icon lives here and `public/favicon.ico` still answers the bare path.
 *
 * ⚠️ **The known consequence**: clients that request `/favicon.ico` directly rather
 * than reading the `<link rel="icon">` — some bookmark and crawler behaviour — get the
 * bundled default, not the uploaded icon. Tabs use the link tag and are correct. This
 * is the trade DYNAMIC_BRANDING_PLAN § 3.3 predicted; closing it needs a reverse proxy
 * rule on `/favicon.ico`, which belongs with the deployment topology.
 *
 * Being dynamic costs nothing here: it is one asset request, not a page, and the page
 * routes stay prerendered because `metadata.icons` is a constant string.
 */
export async function GET() {
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

  // 307 to the bundled default rather than a body: lets the static file be served by
  // whatever normally serves `public/`, with its own caching, instead of streaming it
  // through Node.
  //
  // A **relative** Location, not `NextResponse.redirect`, which requires an absolute
  // URL. Building one from `request.url` produced `http://0.0.0.0:3001/favicon.ico` —
  // the container's bind address, which curl follows happily and a browser cannot
  // reach. Anything deriving the host from the server's own view of the request is
  // wrong behind a proxy too. A relative Location is resolved by the client against
  // whatever host it actually used, which is always right.
  return new NextResponse(null, {
    status: 307,
    headers: { Location: "/favicon.ico" },
  });
}
