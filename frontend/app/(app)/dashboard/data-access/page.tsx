import { Metadata } from "next";

import DataAccessModule from "@/components/admin/DataAccessModule";
import { APP_NAME, pageTitle } from "@/lib/utils/constants";

export const metadata: Metadata = {
  title: pageTitle("Data Access"),
  description: `Delegate who can see and manage another user's records on ${APP_NAME}`,
};

export default function DataAccessPage() {
  return <DataAccessModule />;
}
