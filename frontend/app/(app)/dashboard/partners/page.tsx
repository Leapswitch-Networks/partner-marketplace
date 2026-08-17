import { Metadata } from "next";
import PartnersModule from "@/components/admin/PartnersModule";
import { APP_NAME, pageTitle } from "@/lib/utils/constants";

export const metadata: Metadata = {
  title: pageTitle("Partners"),
  description: `Manage partner organisations on ${APP_NAME}`,
};

export default function PartnersPage() {
  return <PartnersModule />;
}
