"use client";

import { useBranding } from "@/components/common/BrandingProvider";
import { API_BASE_URL, APP_LOGO } from "@/lib/utils/constants";

/**
 * The square brand badge: the uploaded logo, the bundled default, or the monogram.
 *
 * One component rather than a conditional at each of the five sites that render it
 * (three in `Sidebar`, one in `Navbar`, one in `AuthInitializer`). Those five had
 * already drifted once — `AuthInitializer` was still showing a `"T"` from the retired
 * product after three brand audits, because it is only visible during the session
 * check. Collapsing them into one component is what stops that recurring.
 *
 * **Every step is a complete answer, not a placeholder.** There is no state where this
 * renders empty. The bundled default is the real artwork, and the monogram behind it is
 * what the application looked like before uploads existed — so a project reusing this
 * core can set `NEXT_PUBLIC_APP_LOGO=""` and get a working letter badge rather than a
 * broken image.
 */
export default function BrandMark() {
  const branding = useBranding();

  // Three steps, in order of specificity: an uploaded logo, then the bundled default,
  // then the monogram.
  //
  // The uploaded URL is prefixed with the API origin because it is relative to the API,
  // not to this app, and it already carries `?v=<epoch>` so a replacement busts the
  // cache. The bundled default is a static file on this origin and needs no cache key —
  // changing it requires a deploy, which changes the build.
  const src = branding.logo_url
    ? `${API_BASE_URL}${branding.logo_url}`
    : APP_LOGO || null;

  // The bundled default is rendered INLINE rather than via its static file:
  // `public/logo.svg` freezes the rounded square at the original green, which
  // was the most visible leak the 2026-08-13 branding sweep found — pick
  // crimson, keep a green badge on every page. Inline, the square reads the
  // live `--brand` variable and the artwork follows the theme. The static file
  // stays for anything that hotlinks it; a custom `NEXT_PUBLIC_APP_LOGO` path
  // still goes through the <img> branch untouched.
  if (src === "/logo.svg") {
    return (
      <svg
        viewBox="0 0 1024 1024"
        className="h-full w-full"
        role="img"
        aria-label={branding.app_name}
      >
        <rect x="0" y="0" width="1024" height="1024" rx="232" fill="rgb(var(--brand))" />
        <g transform="translate(207,207) scale(1.17308)" fill="#ffffff">
          <rect x="0" y="0" width="152" height="520" rx="76" />
          <rect x="212" y="0" width="308" height="232" rx="80" />
          <rect x="212" y="288" width="308" height="232" rx="80" />
        </g>
      </svg>
    );
  }

  // Takes no className, deliberately. The two branches need *different* styling —
  // the image fills its container, the monogram is a text node the container is
  // already centring — so one shared class would be wrong for one of them. Every
  // call site's parent already carries the size, background and text styling.
  if (src) {
    // A plain <img>, not `next/image`. That would need `remotePatterns` for the API
    // origin in `next.config.mjs` — a protected file — to put an optimisation pipeline
    // in front of a ~25 KB image already served with a year-long, version-keyed cache.
    // The rule targets large content images; this is a badge.
    //
    // The directive below must stay the LAST line before the element: ESLint applies
    // `disable-next-line` to the immediately following line, so a trailing reason
    // comment silently detaches it.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        // The application name, not "logo": a screen reader announcing "logo" tells
        // the user nothing the surrounding context has not already said.
        alt={branding.app_name}
        // `contain` with a little padding, so a logo with its own shape sits inside
        // the brand-coloured square rather than being cropped by it. `cover` would
        // clip a wide wordmark to its middle.
        className="h-full w-full object-contain p-[2px]"
      />
    );
  }

  return <>{branding.monogram}</>;
}
