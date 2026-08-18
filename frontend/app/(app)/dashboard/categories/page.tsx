import { Metadata } from "next";

import CategoriesModule from "@/components/admin/CategoriesModule";
import { pageTitle } from "@/lib/utils/constants";

export const metadata: Metadata = { title: pageTitle("Service categories") };

/**
 * `/dashboard/categories` — taxonomy admin, staff only.
 *
 * § 6.2: Leapswitch owns this table and partners never write to it. The page
 * shows each category's live listing count, which is the § 8 threshold made
 * visible — it is how a staff member sees why a category has no public page.
 */
export default function CategoriesPage() {
  return <CategoriesModule />;
}
