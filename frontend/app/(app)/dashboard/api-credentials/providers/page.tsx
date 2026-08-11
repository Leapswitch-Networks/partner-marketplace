import { Metadata } from "next";

import ProvidersModule from "@/components/admin/ProvidersModule";
import { pageTitle } from "@/lib/utils/constants";

export const metadata: Metadata = {
  title: pageTitle("API Providers"),
  description: "Third parties we hold credentials for, and the fields each one needs",
};

export default function ApiProvidersPage() {
  return <ProvidersModule />;
}
