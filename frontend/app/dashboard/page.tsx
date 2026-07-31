import { Metadata } from "next";
import DashboardClient from "./DashboardClient";

export const metadata: Metadata = {
  title: "Dashboard — Partner Marketplace",
  description: "Partner Marketplace dashboard",
};

export default function DashboardPage() {
  return <DashboardClient />;
}
