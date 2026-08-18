import { Metadata } from "next";

import ModerationModule from "@/components/admin/ModerationModule";
import { APP_NAME, pageTitle } from "@/lib/utils/constants";

export const metadata: Metadata = {
  title: pageTitle("Moderation"),
  description: `Review listings before they appear on ${APP_NAME}`,
};

/** `/dashboard/moderation` — staff only, gated by `moderation-review`. */
export default function ModerationPage() {
  return <ModerationModule />;
}
