import { Metadata } from "next";
import RoleMatrix from "@/components/admin/RoleMatrix";
import { APP_NAME, pageTitle } from "@/lib/utils/constants";

export const metadata: Metadata = {
  title: pageTitle("Permission Matrix"),
  description: `Roles by permission group on ${APP_NAME}`,
};

/**
 * Sits at `/dashboard/roles/matrix`, which the `[id]` segment would otherwise
 * capture — Next resolves static segments before dynamic ones, so this wins
 * without any ordering work. The API needed the opposite care: FastAPI matches
 * in declaration order, so `/roles/matrix` is declared before `/roles/{id}`.
 */
export default function RoleMatrixPage() {
  return <RoleMatrix />;
}
