import { Metadata } from "next";
import DashboardClient from "../DashboardClient";

export const metadata: Metadata = {
  title: "Profile — Partner Marketplace",
  description: "Manage your profile on Partner Marketplace",
};

export default function ProfilePage() {
  return <DashboardClient />;
}
