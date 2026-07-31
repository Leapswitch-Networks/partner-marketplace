import { Metadata } from "next";
import AuthHub from "@/components/auth/AuthHub";

export const metadata: Metadata = {
  title: "Sign Up — Partner Marketplace",
};

export default function SignUpPage() {
  return <AuthHub initialTab="signup" />;
}
