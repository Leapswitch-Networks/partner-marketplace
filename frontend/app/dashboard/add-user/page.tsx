import { Metadata } from "next";
import DashboardClient from "../DashboardClient";

export const metadata: Metadata = {
  title: "Add User — Partner Marketplace",
  description: "Add a new admin user on Partner Marketplace",
};

export default function AddUserPage() {
  return <DashboardClient />;
}
