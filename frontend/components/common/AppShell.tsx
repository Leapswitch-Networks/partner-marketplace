"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import Sidebar, { type AdminSection, urlForSection } from "@/components/dashboard/Sidebar";
import TopNav from "@/components/common/TopNav";

/**
 * The signed-in chrome: sidebar, top bar, and a scrolling content area.
 *
 * Extracted from `DashboardClient` so route groups other than `/dashboard` can use
 * it. Settings is the first — LeapDesk puts its settings area at `/settings/*`,
 * outside the dashboard, and previously the only way to get the shell was to
 * render `DashboardClient`, which also owns the dashboard's section switch and
 * in-page authoring state.
 *
 * `DashboardClient` deliberately does **not** use this yet. It needs two things
 * this does not model — a viewport-locked variant for the table modules, and the
 * inherited authoring sections that live in client state rather than at URLs — so
 * folding it in would mean pushing both of those concerns in here. That is the
 * follow-up, once the sidebar renders the server-provided nav tree.
 */
export default function AppShell({
  activeSection = "settings",
  children,
}: {
  /**
   * Which sidebar item to highlight. Defaults to `"settings"`, which matches no
   * sidebar item — correct for any area that has its own sub-navigation.
   */
  activeSection?: AdminSection;
  children: React.ReactNode;
}) {
  const router = useRouter();

  /**
   * Sidebar clicks from outside the dashboard.
   *
   * The in-page authoring sections have no URL of their own, so they fall back to
   * `/dashboard`, which is where they live. Without that fallback, clicking "Add
   * Category" from `/settings` would silently do nothing.
   */
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
      <Sidebar activeSection={activeSection} onNavigate={handleNavigate} />

      <div className="flex flex-1 flex-col min-w-0 bg-gray-100 dark:bg-gray-950">
        <TopNav />

        <main className="flex-1 overflow-y-auto scrollbar-hide scroll-smooth bg-gray-100 px-4 py-6 pt-20 md:pt-4 sm:px-6 sm:py-6 lg:px-6 2xl:px-8 2xl:py-8 dark:bg-gray-950">
          {children}
        </main>
      </div>
    </>
  );
}
