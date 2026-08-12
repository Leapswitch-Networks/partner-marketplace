import { Metadata } from "next";

import WebhooksModule from "@/components/admin/WebhooksModule";
import { pageTitle } from "@/lib/utils/constants";

export const metadata: Metadata = {
  title: pageTitle("Webhooks"),
  description: "Where we post events, and what happened when we did",
};

export default function WebhooksPage() {
  return <WebhooksModule />;
}
