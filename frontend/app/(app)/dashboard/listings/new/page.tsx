import { Metadata } from "next";

import ListingForm from "@/components/admin/ListingForm";
import { pageTitle } from "@/lib/utils/constants";

export const metadata: Metadata = {
  title: pageTitle("New listing"),
};

/**
 * The authoring form — **the single highest-risk screen in the product.**
 *
 * `DIRECTORY_BUILD_PUNCHLIST.md` 3.6: it decides whether partners list anything
 * at all. A form that is heavy, unclear about what happens next, or silent about
 * review is how a directory ends up with onboarded partners and no listings.
 */
export default function NewListingPage() {
  return <ListingForm />;
}
