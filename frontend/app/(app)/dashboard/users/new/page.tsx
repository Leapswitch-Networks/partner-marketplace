import { Metadata } from "next";
import UserForm from "@/components/admin/UserForm";
import { APP_NAME, pageTitle } from "@/lib/utils/constants";

export const metadata: Metadata = {
  title: pageTitle("New User"),
  description: `Create a user account on ${APP_NAME}`,
};

export default function NewUserPage() {
  return <UserForm />;
}
