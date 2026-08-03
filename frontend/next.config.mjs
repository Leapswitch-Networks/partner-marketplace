
/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,

  experimental: {
    optimizePackageImports: ["@/components/admin", "@/components/dashboard", "@/components/common"],
  },

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
      {
        source: "/:path*.(js|css|woff2|png|jpg|svg|ico)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
