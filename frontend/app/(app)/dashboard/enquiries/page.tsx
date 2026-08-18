import { Metadata } from "next";

import EnquiriesModule from "@/components/admin/EnquiriesModule";
import { APP_NAME, pageTitle } from "@/lib/utils/constants";

export const metadata: Metadata = {
  title: pageTitle("Enquiries"),
  description: `Enquiries received on ${APP_NAME}`,
};

/**
 * `/dashboard/enquiries` — the partner's inbox, and staff oversight.
 *
 * § 20.6.1 calls this the most important authenticated page in the product: it
 * is where the thing the directory exists to produce actually arrives.
 */
export default function EnquiriesPage() {
  return <EnquiriesModule />;
}
