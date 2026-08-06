import { Metadata } from "next";
import PasswordForm from "@/components/settings/PasswordForm";
import { APP_NAME, pageTitle } from "@/lib/utils/constants";

export const metadata: Metadata = {
  title: pageTitle("Password settings"),
  description: `Change your ${APP_NAME} password`,
  // The OTP recovery block puts a live code on screen; keep the page out of indexes.
  robots: { index: false },
};

export default function PasswordSettingsPage() {
  return <PasswordForm />;
}
