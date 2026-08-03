import { Metadata } from "next";
import DashboardClient from "../DashboardClient";

export const metadata: Metadata = {
  title: "Roles & Permissions — Partner Marketplace",
  description: "Manage roles and the permissions they grant",
};

export default function RolesPage() {
  return <DashboardClient />;
}
