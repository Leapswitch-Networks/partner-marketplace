import { Metadata } from "next";

import FeatureFlagsModule from "@/components/admin/FeatureFlagsModule";
import { pageTitle } from "@/lib/utils/constants";

export const metadata: Metadata = {
  title: pageTitle("Feature Flags"),
  description: "Staged rollout without a code change",
};

export default function FeatureFlagsPage() {
  return <FeatureFlagsModule />;
}
