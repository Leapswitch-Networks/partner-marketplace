import { Metadata } from "next";
import UsersModule from "@/components/admin/UsersModule";
import { APP_NAME, pageTitle } from "@/lib/utils/constants";

export const metadata: Metadata = {
  title: pageTitle("Users"),
  description: `Manage user accounts on ${APP_NAME}`,
};

export default function UsersPage() {
  return <UsersModule />;
}
