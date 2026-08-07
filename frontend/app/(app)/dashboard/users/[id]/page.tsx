import { Metadata } from "next";
import UserShow from "@/components/admin/UserShow";
import { APP_NAME, pageTitle } from "@/lib/utils/constants";

export const metadata: Metadata = {
  title: pageTitle("User"),
  description: `User account details on ${APP_NAME}`,
};

/**
 * `params` is a plain object in Next 14 — it becomes a Promise in 15. Read it
 * directly here; do not `await` it, which 14 rejects.
 */
export default function UserShowPage({ params }: { params: { id: string } }) {
  return <UserShow userId={params.id} />;
}
