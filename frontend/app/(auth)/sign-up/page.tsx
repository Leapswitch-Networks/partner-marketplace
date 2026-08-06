import { Metadata } from "next";
import AuthHub from "@/components/auth/AuthHub";
import { pageTitle } from "@/lib/utils/constants";

export const metadata: Metadata = {
  title: pageTitle("Sign Up"),
};

export default function SignUpPage() {
  return <AuthHub mode="signup" />;
}
