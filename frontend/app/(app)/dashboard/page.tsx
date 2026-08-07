import { Metadata } from "next";
import DashboardHome from "./DashboardHome";
import { APP_NAME, pageTitle } from "@/lib/utils/constants";

export const metadata: Metadata = {
  title: pageTitle("Dashboard"),
  description: `${APP_NAME} dashboard`,
};

export default function DashboardPage() {
  return <DashboardHome />;
}
