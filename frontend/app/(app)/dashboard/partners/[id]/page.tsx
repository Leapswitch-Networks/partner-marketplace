import { Metadata } from "next";
import PartnerShow from "@/components/admin/PartnerShow";
import { APP_NAME, pageTitle } from "@/lib/utils/constants";

export const metadata: Metadata = {
  title: pageTitle("Partner"),
  description: `Partner organisation details on ${APP_NAME}`,
};

/**
 * `params` is a plain object in Next 14 — it becomes a Promise in 15. Read it
 * directly here; do not `await` it, which 14 rejects.
 */
export default function PartnerShowPage({ params }: { params: { id: string } }) {
  return <PartnerShow partnerId={params.id} />;
}
