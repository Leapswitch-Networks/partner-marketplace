import { Metadata } from "next";
import AuthHub from "@/components/auth/AuthHub";

export const metadata: Metadata = {
  title: "Sign Up — Test Platform",
};

export default function SignUpPage() {
  return <AuthHub initialTab="signup" />;
}
