import { Metadata } from "next";
import UsersModule from "@/components/admin/UsersModule";
import { APP_NAME, pageTitle } from "@/lib/utils/constants";

export const metadata: Metadata = {
  title: pageTitle("All Users"),
  description: `Manage admin users on ${APP_NAME}`,
};

export default function AllUsersPage() {
  return <UsersModule />;
}
