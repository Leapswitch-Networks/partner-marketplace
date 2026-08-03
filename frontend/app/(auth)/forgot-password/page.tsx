import { Metadata } from "next";
import ForgotPasswordClient from "@/components/auth/ForgotPasswordClient";

export const metadata: Metadata = {
  title: "Reset your password — Partner Marketplace",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordClient />;
}
