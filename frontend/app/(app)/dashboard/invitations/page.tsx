import { Metadata } from "next";
import InvitationsModule from "@/components/admin/InvitationsModule";
import { APP_NAME, pageTitle } from "@/lib/utils/constants";

export const metadata: Metadata = {
  title: pageTitle("Invitations"),
  description: `Manage user invitations on ${APP_NAME}`,
};

export default function InvitationsPage() {
  return <InvitationsModule />;
}
