import { Metadata } from "next";
import DashboardClient from "../DashboardClient";

export const metadata: Metadata = {
  title: "Profile — Test Platform",
  description: "Manage your profile on the Test Platform",
};

export default function ProfilePage() {
  return <DashboardClient />;
}
