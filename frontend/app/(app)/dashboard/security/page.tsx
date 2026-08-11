import { Metadata } from "next";
import SecurityModule from "@/components/admin/SecurityModule";
import { pageTitle } from "@/lib/utils/constants";

export const metadata: Metadata = {
  title: pageTitle("Security"),
  description: "Hardening controls and recent security activity",
};

export default function SecurityPage() {
  return <SecurityModule />;
}
