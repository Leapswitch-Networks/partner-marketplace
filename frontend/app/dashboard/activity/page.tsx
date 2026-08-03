import { Metadata } from "next";
import DashboardClient from "../DashboardClient";

export const metadata: Metadata = {
  title: "Activity Log — Partner Marketplace",
  description: "Audit trail of actions across the platform",
};

export default function ActivityPage() {
  return <DashboardClient />;
}
