import { Metadata } from "next";

import ApiConsumersModule from "@/components/admin/ApiConsumersModule";
import { pageTitle } from "@/lib/utils/constants";

export const metadata: Metadata = {
  title: pageTitle("Platform API"),
  description: "Systems permitted to call our API, and the tokens they hold",
};

export default function ApiConsumersPage() {
  return <ApiConsumersModule />;
}
