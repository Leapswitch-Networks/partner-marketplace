"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import WelcomeBanner from "@/components/dashboard/WelcomeBanner";
import DashboardOverview from "@/components/dashboard/DashboardOverview";
import { type AdminSection, urlForSection } from "@/components/dashboard/Sidebar";

/**
 * The `/dashboard` landing content — banner plus the overview grid.
 *
 * Only the content. The sidebar and top bar are mounted by
 * `app/dashboard/layout.tsx` and stay put across navigation.
 */
export default function DashboardHome() {
  const router = useRouter();

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
      <div className="mx-auto w-full animate-fade-in">
        <DashboardOverview onNavigate={handleNavigate} />
      </div>
    </>
  );
}
