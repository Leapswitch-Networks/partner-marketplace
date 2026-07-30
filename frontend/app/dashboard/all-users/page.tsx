import { Metadata } from "next";
import DashboardClient from "../DashboardClient";

export const metadata: Metadata = {
  title: "All Users — Test Platform",
  description: "Manage admin users on the Test Platform",
};

export default function AllUsersPage() {
  return <DashboardClient />;
}
