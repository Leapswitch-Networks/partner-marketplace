import { Metadata } from "next";
import RolesModule from "@/components/admin/RolesModule";
import { pageTitle } from "@/lib/utils/constants";

export const metadata: Metadata = {
  title: pageTitle("Roles & Permissions"),
  description: "Manage roles and the permissions they grant",
};

export default function RolesPage() {
  return <RolesModule />;
}
