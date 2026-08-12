import { Metadata } from "next";

import ApiDocsModule from "@/components/admin/ApiDocsModule";
import { pageTitle } from "@/lib/utils/constants";

export const metadata: Metadata = {
  title: pageTitle("API Documentation"),
  description: "Every route this application serves, and the permission that gates it",
};

export default function ApiDocsPage() {
  return <ApiDocsModule />;
}
