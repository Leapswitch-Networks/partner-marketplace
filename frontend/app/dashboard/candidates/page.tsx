import { Metadata } from "next";
import DashboardClient from "../DashboardClient";

export const metadata: Metadata = {
  title: "Candidates — Test Platform",
  description: "Manage candidates on the Test Platform",
};

export default function CandidatesPage() {
  return <DashboardClient />;
}
