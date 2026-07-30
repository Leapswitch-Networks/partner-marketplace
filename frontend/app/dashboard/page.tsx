import { Metadata } from "next";
import DashboardClient from "./DashboardClient";

export const metadata: Metadata = {
  title: "Dashboard — Test Platform",
  description: "Browse and start available logic and reasoning tests",
};

export default function DashboardPage() {
  return <DashboardClient />;
}
