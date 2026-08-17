import { Metadata } from "next";
import PartnerForm from "@/components/admin/PartnerForm";
import { APP_NAME, pageTitle } from "@/lib/utils/constants";

export const metadata: Metadata = {
  title: pageTitle("Onboard Partner"),
  description: `Onboard a partner organisation on ${APP_NAME}`,
};

export default function NewPartnerPage() {
  return <PartnerForm />;
}
