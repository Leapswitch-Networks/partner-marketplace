import { Metadata } from "next";
import ActivityModule from "@/components/admin/ActivityModule";
import { pageTitle } from "@/lib/utils/constants";

export const metadata: Metadata = {
  title: pageTitle("Activity Log"),
  description: "Audit trail of actions across the platform",
};

export default function ActivityPage() {
  return <ActivityModule />;
}
