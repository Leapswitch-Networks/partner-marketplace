import { Metadata } from "next";
import PartnerTiersModule from "@/components/admin/PartnerTiersModule";
import { APP_NAME, pageTitle } from "@/lib/utils/constants";

export const metadata: Metadata = {
  title: pageTitle("Partner Tiers"),
  description: `Partner tier entitlements on ${APP_NAME}`,
};

export default function PartnerTiersPage() {
  return <PartnerTiersModule />;
}
