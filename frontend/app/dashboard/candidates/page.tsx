import { Metadata } from "next";
import DashboardClient from "../DashboardClient";

export const metadata: Metadata = {
  title: "Candidates — Partner Marketplace",
  description: "Manage candidates on Partner Marketplace",
};

export default function CandidatesPage() {
  return <DashboardClient />;
}
