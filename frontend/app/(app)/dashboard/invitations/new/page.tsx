import { Metadata } from "next";
import InvitationForm from "@/components/admin/InvitationForm";
import { APP_NAME, pageTitle } from "@/lib/utils/constants";

export const metadata: Metadata = {
  title: pageTitle("Invite"),
  description: `Invite people to ${APP_NAME}`,
};

export default function NewInvitationPage() {
  return <InvitationForm />;
}
