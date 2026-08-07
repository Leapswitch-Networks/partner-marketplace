import { Metadata } from "next";
import RoleShow from "@/components/admin/RoleShow";
import { APP_NAME, pageTitle } from "@/lib/utils/constants";

export const metadata: Metadata = {
  title: pageTitle("Role"),
  description: `Role details on ${APP_NAME}`,
};

export default function RoleShowPage({ params }: { params: { id: string } }) {
  return <RoleShow roleId={Number(params.id)} />;
}
