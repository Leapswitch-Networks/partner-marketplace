import { Metadata } from "next";

import CredentialsModule from "@/components/admin/CredentialsModule";
import { pageTitle } from "@/lib/utils/constants";

export const metadata: Metadata = {
  title: pageTitle("API Credentials"),
  description: "Encrypted credentials for third-party integrations",
};

export default function ApiCredentialsPage() {
  return <CredentialsModule />;
}
