import { Metadata } from "next";
import RoleForm from "@/components/admin/RoleForm";
import { APP_NAME, pageTitle } from "@/lib/utils/constants";

export const metadata: Metadata = {
  title: pageTitle("New Role"),
  description: `Create a role on ${APP_NAME}`,
};

export default function NewRolePage() {
  return <RoleForm />;
}
