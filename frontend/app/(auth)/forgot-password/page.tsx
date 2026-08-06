import { Metadata } from "next";
import ForgotPasswordClient from "@/components/auth/ForgotPasswordClient";
import { pageTitle } from "@/lib/utils/constants";

export const metadata: Metadata = {
  title: pageTitle("Reset your password"),
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordClient />;
}
