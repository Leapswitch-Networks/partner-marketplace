import { Metadata } from "next";

import ListingsModule from "@/components/admin/ListingsModule";
import { APP_NAME, pageTitle } from "@/lib/utils/constants";

export const metadata: Metadata = {
  title: pageTitle("Listings"),
  description: `Service listings on ${APP_NAME}`,
};

/**
 * `/dashboard/listings` — **one route for partners and staff both.**
 *
 * `PARTNER_DIRECTORY_PLAN.md` § 20.6.0 ①: there is no `/partner/listings` and no
 * `/admin/listings`. The API scopes the rows; the page does not know or care
 * which audience is reading it.
 */
export default function ListingsPage() {
  return <ListingsModule />;
}
