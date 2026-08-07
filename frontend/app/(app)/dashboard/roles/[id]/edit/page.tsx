import { Metadata } from "next";
import RoleForm from "@/components/admin/RoleForm";
import { APP_NAME, pageTitle } from "@/lib/utils/constants";

export const metadata: Metadata = {
  title: pageTitle("Edit Role"),
  description: `Edit a role on ${APP_NAME}`,
};

export default function EditRolePage({ params }: { params: { id: string } }) {
  return <RoleForm roleId={Number(params.id)} />;
}
