import { Metadata } from "next";
import PasswordForm from "@/components/settings/PasswordForm";

export const metadata: Metadata = {
  title: "Password settings — Partner Marketplace",
  description: "Change your Partner Marketplace password",
  // The OTP recovery block puts a live code on screen; keep the page out of indexes.
  robots: { index: false },
};

export default function PasswordSettingsPage() {
  return <PasswordForm />;
}
