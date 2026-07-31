import { Metadata } from "next";
import AuthHub from "@/components/auth/AuthHub";

export const metadata: Metadata = {
  title: "Sign In — Partner Marketplace",
};

export default function SignInPage() {
  return <AuthHub initialTab="signin" />;
}
