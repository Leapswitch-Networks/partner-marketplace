import { Metadata } from "next";

import AiAssistantModule from "@/components/admin/AiAssistantModule";
import { pageTitle } from "@/lib/utils/constants";

export const metadata: Metadata = {
  title: pageTitle("AI Assistant"),
  description: "Turn the assistant on, and see exactly what it can reach",
};

export default function AiAssistantPage() {
  return <AiAssistantModule />;
}
