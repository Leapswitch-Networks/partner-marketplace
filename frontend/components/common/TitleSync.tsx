"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useBranding } from "@/components/common/BrandingProvider";
import { APP_NAME } from "@/lib/utils/constants";

/**
 * DYNAMIC_BRANDING_PLAN phase 5, delivered at zero prerender cost.
 *
 * `export const metadata` is static, so every route's <title> is baked at build
 * time from the env constant `APP_NAME` (see `pageTitle()` in
 * `lib/utils/constants.ts`). Converting the 16 metadata blocks to
 * `generateMetadata()` so they could read the runtime name was rejected in
 * DYNAMIC_BRANDING_PLAN § 3.2 — it would turn every prerendered route into a
 * server-rendered-on-demand one, a round trip per page view for a <title>.
 * This patches the title client-side after hydration instead: the SEO
 * argument for a server-rendered <title> doesn't apply to an authenticated
 * admin app, and the cost is a pre-hydration flash of the build-time name —
 * a documented, deliberate trade, not an oversight.
 *
 * Renders nothing. Re-runs on every navigation (`pathname` in the deps)
 * because each route sets its own <title> from its own static metadata, so
 * the patch has to be re-applied every time rather than only on first mount.
 */
export default function TitleSync(): null {
  const branding = useBranding();
  const pathname = usePathname();

  useEffect(() => {
    // Nothing to patch when the deployment never renamed itself.
    if (branding.app_name === APP_NAME) return;
    // Never touch a title that doesn't contain the build-time constant — a
    // page may set a fully custom title with no app name in it at all.
    if (!document.title.includes(APP_NAME)) return;
    document.title = document.title.replace(APP_NAME, branding.app_name);
  }, [branding.app_name, pathname]);

  return null;
}
