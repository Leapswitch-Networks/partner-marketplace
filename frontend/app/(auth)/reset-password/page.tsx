import { Metadata } from "next";
import ResetPasswordClient from "@/components/auth/ResetPasswordClient";
import { pageTitle } from "@/lib/utils/constants";

export const metadata: Metadata = {
  title: pageTitle("Choose a new password"),
  // The URL carries a live credential. Never index it.
  robots: { index: false, follow: false },
};

/** `/reset-password?token=…` — the destination of the password-reset email. */
export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  return <ResetPasswordClient token={searchParams.token ?? null} />;
}
