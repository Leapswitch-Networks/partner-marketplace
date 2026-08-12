import { Metadata } from "next";

import WorkerJobsModule from "@/components/admin/WorkerJobsModule";
import { pageTitle } from "@/lib/utils/constants";

export const metadata: Metadata = {
  title: pageTitle("Background Jobs"),
  description: "What runs on a timer, when it last ran, and whether it worked",
};

export default function WorkerJobsPage() {
  return <WorkerJobsModule />;
}
