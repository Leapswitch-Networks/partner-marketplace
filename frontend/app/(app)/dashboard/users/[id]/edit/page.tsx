import { Metadata } from "next";
import UserForm from "@/components/admin/UserForm";
import { APP_NAME, pageTitle } from "@/lib/utils/constants";

export const metadata: Metadata = {
  title: pageTitle("Edit User"),
  description: `Edit a user account on ${APP_NAME}`,
};

export default function EditUserPage({ params }: { params: { id: string } }) {
  return <UserForm userId={params.id} />;
}
