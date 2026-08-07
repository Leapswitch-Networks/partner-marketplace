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
