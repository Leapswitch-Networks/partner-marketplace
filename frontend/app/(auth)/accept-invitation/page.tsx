import { Metadata } from "next";
import AcceptInvitationClient from "@/components/auth/AcceptInvitationClient";

export const metadata: Metadata = {
  title: "Accept your invitation — Partner Marketplace",
  // The URL carries an invitation token. Never index it.
  robots: { index: false, follow: false },
};

/** `/accept-invitation?token=…` — the destination of an invitation email. */
export default function AcceptInvitationPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  return <AcceptInvitationClient token={searchParams.token ?? null} />;
}
