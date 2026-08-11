import { Metadata } from "next";
import RecycleBinModule from "@/components/admin/RecycleBinModule";
import { pageTitle } from "@/lib/utils/constants";

export const metadata: Metadata = {
  title: pageTitle("Recycle Bin"),
  description: "Restore or permanently remove deleted records",
};

export default function RecycleBinPage() {
  return <RecycleBinModule />;
}
