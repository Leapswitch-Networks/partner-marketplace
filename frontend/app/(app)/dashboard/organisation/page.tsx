import { Metadata } from "next";

import OrganisationModule from "@/components/admin/OrganisationModule";
import { pageTitle } from "@/lib/utils/constants";

export const metadata: Metadata = { title: pageTitle("Your organisation") };

/**
 * `/dashboard/organisation` — a partner's own record, public half only.
 *
 * § 20.6.1: never `notes`, `gst_number` or `pan_number`. Those are not disabled
 * fields here — the endpoint this page calls cannot write them and does not
 * return them.
 */
export default function OrganisationPage() {
  return <OrganisationModule />;
}
