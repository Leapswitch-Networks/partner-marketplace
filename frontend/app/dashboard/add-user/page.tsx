import { Metadata } from "next";
import DashboardClient from "../DashboardClient";
import { APP_NAME, pageTitle } from "@/lib/utils/constants";

export const metadata: Metadata = {
  title: pageTitle("Add User"),
  description: `Add a new admin user on ${APP_NAME}`,
};

export default function AddUserPage() {
  return <DashboardClient />;
}
