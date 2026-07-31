import { Metadata } from "next";
import DashboardClient from "../DashboardClient";

export const metadata: Metadata = {
  title: "All Users — Partner Marketplace",
  description: "Manage admin users on Partner Marketplace",
};

export default function AllUsersPage() {
  return <DashboardClient />;
}
