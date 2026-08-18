import { Metadata } from "next";

import TeamModule from "@/components/admin/TeamModule";
import { pageTitle } from "@/lib/utils/constants";

export const metadata: Metadata = { title: pageTitle("Your team") };

/**
 * `/dashboard/team` — a partner's own logins, scoped by the server.
 *
 * § 20.6.3: there is no second users module. This calls the same endpoint the
 * staff index does and row scoping decides what comes back.
 */
export default function TeamPage() {
  return <TeamModule />;
}
