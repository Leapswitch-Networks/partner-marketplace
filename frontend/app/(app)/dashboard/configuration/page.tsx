import { Metadata } from "next";
import ConfigurationModule from "@/components/admin/ConfigurationModule";
import { pageTitle } from "@/lib/utils/constants";

export const metadata: Metadata = {
  title: pageTitle("Configuration"),
  description: "One settings store for the whole platform",
};

export default function ConfigurationPage() {
  return <ConfigurationModule />;
}
