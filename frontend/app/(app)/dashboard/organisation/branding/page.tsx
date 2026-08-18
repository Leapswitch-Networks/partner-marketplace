import { Metadata } from "next";

import BrandingModule from "@/components/admin/BrandingModule";
import { pageTitle } from "@/lib/utils/constants";

export const metadata: Metadata = { title: pageTitle("Logo and banner") };

/**
 * `/dashboard/organisation/branding` — punchlist 3.3.
 *
 * Reuses the platform's own image pipeline (`core/images.py`) rather than adding
 * a second validator, and honours the 32px logo floor from `LOGO_BRIEF.md` by
 * stating it next to the upload.
 */
export default function BrandingPage() {
  return <BrandingModule />;
}
