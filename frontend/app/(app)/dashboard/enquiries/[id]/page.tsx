import { Metadata } from "next";

import EnquiryThread from "@/components/admin/EnquiryThread";
import { pageTitle } from "@/lib/utils/constants";

export const metadata: Metadata = {
  title: pageTitle("Enquiry"),
};

/**
 * The thread.
 *
 * **Replying here is the only way response time is measurable** — a partner
 * answering from their own mail client leaves the enquiry at NEW forever and
 * § 16's one number reads zero while the product works fine.
 */
export default function EnquiryThreadPage({ params }: { params: { id: string } }) {
  return <EnquiryThread enquiryId={params.id} />;
}
