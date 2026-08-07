
/**
 * `next dev` and `next build` need different caching rules, and getting that wrong cost
 * two days of debugging that looked like an authentication bug.
 *
 * The previous config applied `Cache-Control: public, max-age=31536000, immutable` to
 * `/:path*.(js|css|…)` unconditionally. In production that is right — `next build` emits
 * **content-hashed** filenames (`page-a1b2c3.js`), so a changed file is a changed URL.
 *
 * In development the filenames are **stable**: `/_next/static/chunks/app/dashboard/page.js`
 * keeps that exact URL while its contents change on every edit. So the browser was told to
 * cache each dev chunk **for a year and never revalidate it**.
 *
 * What that produced, on 2026-08-07: the dashboard threw
 * `TypeError: Cannot read properties of undefined (reading 'call')` from webpack's
 * `options.factory`. The browser was running the **previous day's** `app/dashboard/page.js`,
 * which requires `app/dashboard/DashboardClient.tsx` — a module deleted in that day's
 * restructure and defined by no current chunk. So webpack had a module id with no factory.
 * Meanwhile `webpack.js?v=<timestamp>` and `main-app.js?v=<timestamp>` **do** carry a
 * cache-buster and were always fresh, which is what made the mix possible at all.
 *
 * It presented as "I cannot sign in", it survived deleting `.next` and recreating the
 * container — because the stale copy was in the *browser*, not the image — and it left the
 * server-side render provably healthy the whole time. Diagnosis notes are in
 * `documentation/DAILY_CHANGES.md` (2026-08-07) and ONBOARDING § 9.
 *
 * @type {import('next').NextConfig}
 */
const isProduction = process.env.NODE_ENV === "production";

const nextConfig = {
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,

  // `experimental.optimizePackageImports` was set to
  // ["@/components/admin", "@/components/dashboard", "@/components/common"] and is removed
  // (2026-08-07) because it could never have done anything useful and is not inert.
  //
  // The option rewrites **barrel** imports — `import { A } from "some-package"` becomes
  // `import A from "some-package/dist/A"` — so it needs a package with an index file. All
  // three entries are local path aliases, **none of the three directories has an `index.ts`
  // at all**, and nothing in the codebase imports from a bare barrel path (checked). So it
  // was pointed at three things it cannot optimise.
  //
  // Removed rather than left alone because it is an `experimental` flag that hooks into
  // module resolution and chunk splitting, which is precisely the machinery that was
  // producing `requireModule` failures. Carrying an experimental flag that provably buys
  // nothing means carrying its risk for free.

  async headers() {
    return [
      {
        // Security headers on every page (TECH_DEBT PM-33).
        //
        // The API sets its own set, and this is NOT duplication: these protect the
        // HTML documents Next serves, and a header on the API does nothing for a
        // page the API did not serve. Framing and MIME-sniffing protections
        // actually matter here, where they are close to decorative on a JSON API.
        //
        // Deliberately NOT set: X-XSS-Protection. It controlled an auditor every
        // current browser has removed — Chrome dropped it in 2019 — and it could
        // be abused to block scripts selectively. Same call as the backend.
        //
        // HSTS is absent on purpose too: it belongs on the TLS terminator, which
        // does not exist yet, and emitting it from a dev server reachable over
        // plain HTTP would pin localhost to HTTPS in every developer's browser
        // for a year, with no server-side way to undo it.
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store" },
        ],
      },
      // Build output. `immutable` is correct here in production and CATASTROPHIC in
      // development, so it is conditional — see the note below.
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: isProduction
              ? "public, max-age=31536000, immutable"
              : "no-store, must-revalidate",
          },
        ],
      },
      // `public/` assets. NOT hashed, even in production — `/logo.svg` keeps its URL
      // across every deploy — so `immutable` would make a replaced logo unreachable
      // until the visitor cleared their cache. A day of caching with a week of
      // stale-while-revalidate gives almost the same hit rate and stays correctable.
      //
      // Uploaded brand assets are a separate case and are already safe: they are served
      // by the API with `?v=<epoch>`, so replacing one changes its URL.
      {
        source: "/:path*.(woff2|png|jpg|jpeg|gif|svg|ico)",
        headers: [
          {
            key: "Cache-Control",
            value: isProduction
              ? "public, max-age=86400, stale-while-revalidate=604800"
              : "no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
