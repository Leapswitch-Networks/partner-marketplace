import { Metadata } from "next";

import SearchEntitiesModule from "@/components/admin/SearchEntitiesModule";
import { pageTitle } from "@/lib/utils/constants";

export const metadata: Metadata = {
  title: pageTitle("Search"),
  description: "Choose which records the global search box looks in",
};

export default function SearchSettingsPage() {
  return <SearchEntitiesModule />;
}
