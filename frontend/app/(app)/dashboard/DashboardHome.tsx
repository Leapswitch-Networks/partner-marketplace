"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import WelcomeBanner from "@/components/dashboard/WelcomeBanner";
import PartnerOverview from "@/components/dashboard/PartnerOverview";
import DashboardOverview from "@/components/dashboard/DashboardOverview";
import ComponentPreview from "@/components/dashboard/ComponentPreview";
import { type AdminSection, urlForSection } from "@/components/dashboard/Sidebar";
import useAppSelector from "@/lib/hooks/useAppSelector";

/**
 * The `/dashboard` landing content — banner plus the overview grid.
 *
 * Only the content. The sidebar and top bar are mounted by
 * `app/dashboard/layout.tsx` and stay put across navigation.
 */
export default function DashboardHome() {
  const router = useRouter();
  // A partner is an account attached to an organisation. Keyed off that rather
  // than a role name: `organisation_id` is what every scoping rule reads, and a
  // role check here would drift from it the first time somebody makes a custom
  // role (the same reasoning as `usePermissions`' note on `hasRole`).
  const organisationId = useAppSelector((s) => s.auth.user?.organisation_id);
  const isPartner = Boolean(organisationId);

  const handleNavigate = useCallback(
    (section: AdminSection) => {
      if (section === "profile") {
        router.push("/settings/profile");
        return;
      }
      router.push(urlForSection(section) ?? "/dashboard");
    },
    [router]
  );

  return (
    <>
      <div className="mb-8 animate-fade-in">
        <WelcomeBanner />
      </div>
      {/* § 20.6.1's partner overview. Rendered above the generic grid rather
          than replacing it — a partner still has a profile and settings, and
          hiding the rest would mean maintaining two dashboards. */}
      {isPartner && (
        <div className="animate-fade-in">
          <PartnerOverview />
        </div>
      )}
      <div className="mx-auto w-full animate-fade-in">
        <DashboardOverview onNavigate={handleNavigate} />
      </div>
      {/* Admin-access roles only (RootUser, SuperAdmin, BackendDeveloper, Admin),
          and last on the page. It renders no real data — every figure in it is
          illustrative and labelled as such — so the gate is a presentation choice,
          not a security boundary. The component owns the check. */}
      <ComponentPreview />
    </>
  );
}
