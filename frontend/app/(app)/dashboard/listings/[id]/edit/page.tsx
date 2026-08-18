import { Metadata } from "next";

import ListingForm from "@/components/admin/ListingForm";
import { pageTitle } from "@/lib/utils/constants";

export const metadata: Metadata = {
  title: pageTitle("Edit listing"),
};

/**
 * The same form, editing.
 *
 * ⚠️ It warns that editing a **published** listing returns it to review and
 * takes it off the public site until somebody approves it again. That is not a
 * courtesy — a partner who edits a typo and silently loses their listing from
 * the directory for a day will not trust the tool again.
 */
export default function EditListingPage({ params }: { params: { id: string } }) {
  return <ListingForm listingId={params.id} />;
}
