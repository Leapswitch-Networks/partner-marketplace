import { Metadata } from "next";

import ListingShow from "@/components/admin/ListingShow";
import { pageTitle } from "@/lib/utils/constants";

export const metadata: Metadata = {
  title: pageTitle("Listing"),
};

/** Show. Carries `rejection_reason` prominently — § 20.6.1. */
export default function ListingShowPage({ params }: { params: { id: string } }) {
  return <ListingShow listingId={params.id} />;
}
