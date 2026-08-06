import { Metadata } from "next";
import AuthHub from "@/components/auth/AuthHub";
import { pageTitle } from "@/lib/utils/constants";

export const metadata: Metadata = {
  title: pageTitle("Sign In"),
};

export default function SignInPage() {
  return <AuthHub mode="signin" />;
}
