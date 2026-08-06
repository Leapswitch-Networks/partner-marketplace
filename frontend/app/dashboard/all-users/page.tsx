import { Metadata } from "next";
import DashboardClient from "../DashboardClient";
import { APP_NAME, pageTitle } from "@/lib/utils/constants";

export const metadata: Metadata = {
  title: pageTitle("All Users"),
  description: `Manage admin users on ${APP_NAME}`,
};

export default function AllUsersPage() {
  return <DashboardClient />;
}
