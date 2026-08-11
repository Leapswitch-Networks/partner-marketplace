import { Metadata } from "next";
import ErrorsModule from "@/components/admin/ErrorsModule";
import { pageTitle } from "@/lib/utils/constants";

export const metadata: Metadata = {
  title: pageTitle("Error Tracking"),
  description: "Distinct application errors, grouped and triaged",
};

export default function ErrorsPage() {
  return <ErrorsModule />;
}
