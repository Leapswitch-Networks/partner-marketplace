import { Metadata } from "next";
import DashboardClient from "../DashboardClient";
import { pageTitle } from "@/lib/utils/constants";

export const metadata: Metadata = {
  title: pageTitle("Roles & Permissions"),
  description: "Manage roles and the permissions they grant",
};

export default function RolesPage() {
  return <DashboardClient />;
}
