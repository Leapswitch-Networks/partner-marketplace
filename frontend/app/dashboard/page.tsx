import { Metadata } from "next";
import DashboardClient from "./DashboardClient";
import { APP_NAME, pageTitle } from "@/lib/utils/constants";

export const metadata: Metadata = {
  title: pageTitle("Dashboard"),
  description: `${APP_NAME} dashboard`,
};

export default function DashboardPage() {
  return <DashboardClient />;
}
