import { Metadata } from "next";
import HealthModule from "@/components/admin/HealthModule";
import { pageTitle } from "@/lib/utils/constants";

export const metadata: Metadata = {
  title: pageTitle("System Health"),
  description: "What the running system can say about itself",
};

export default function HealthPage() {
  return <HealthModule />;
}
