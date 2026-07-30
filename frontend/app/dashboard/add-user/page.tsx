import { Metadata } from "next";
import DashboardClient from "../DashboardClient";

export const metadata: Metadata = {
  title: "Add User — Test Platform",
  description: "Add a new admin user on the Test Platform",
};

export default function AddUserPage() {
  return <DashboardClient />;
}
