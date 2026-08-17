import { Metadata } from "next";
import PartnerForm from "@/components/admin/PartnerForm";
import { APP_NAME, pageTitle } from "@/lib/utils/constants";

export const metadata: Metadata = {
  title: pageTitle("Edit Partner"),
  description: `Edit a partner organisation on ${APP_NAME}`,
};

export default function EditPartnerPage({ params }: { params: { id: string } }) {
  return <PartnerForm partnerId={params.id} />;
}
