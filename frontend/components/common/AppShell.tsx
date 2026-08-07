"use client";

import { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar, {
  type AdminSection,
  SECTION_URLS,
  urlForSection,
} from "@/components/dashboard/Sidebar";
import TopNav from "@/components/common/TopNav";

/**
 * The signed-in chrome: sidebar, top bar, and the content area.
 *
 * **Rendered from a `layout.tsx`, never from a page.** That is the whole point. In
 * the App Router a layout persists across navigation within its segment while only
 * `children` swap, so clicking a sidebar item re-renders the main panel and leaves
 * the sidebar and header mounted.
 *
 * Until 2026-08-06 every `/dashboard/*` page rendered `DashboardClient`, which
 * *contained* the sidebar. Each route being a different page component meant React
 * unmounted and remounted the entire shell on every click — sidebar, top bar and
 * the navigation fetch with it — so navigating "changed the whole page" rather than
 * just the content. This file's docstring already named that as the follow-up,
 * blocked on the sidebar rendering the server nav tree and on the inherited
 * authoring sections. Both of those landed, so the fold-in happened and
 * `DashboardClient` is gone.
 */

/**
 * Routes whose content owns the full viewport height.
 *
 * These render a viewport-locked `Card` whose table scrolls internally, so they
 * must NOT sit inside the padded, scrolling panel everything else uses — two
 * nested scroll containers means neither behaves. See `UI_PATTERNS.md`
 * § Full-Page Index Layout, where those class combinations are load-bearing.
 *
 * Keyed on pathname rather than passed as a prop: the layout renders this shell
 * for every route beneath it and cannot know which child is about to render, and
 * threading a prop up from the page would defeat the persistence this component
 * exists to provide.
 */
const FULL_HEIGHT_ROUTES = new Set<string>([
  "/dashboard/all-users",
  "/dashboard/add-user",
  "/dashboard/roles",
  "/dashboard/activity",
]);

/**
 * Which sidebar item to light up for a given URL.
 *
 * Derived rather than passed in, because **one layout now serves both `/dashboard/*`
 * and `/settings/*`** (`app/(app)/layout.tsx`) and a layout cannot know which child is
 * about to render. Previously each area's own layout passed `activeSection`, and that
 * per-area prop is exactly what required two layouts — the thing that made moving
 * between the areas tear down the whole chrome.
 *
 * Three cases, in order:
 *
 * 1. An exact match in `SECTION_URLS` — the normal case, and the only one that can
 *    distinguish `/dashboard/roles` from `/dashboard/all-users`.
 * 2. Anything else under `/dashboard` — e.g. `/dashboard/profile`, which owns no
 *    sidebar item. Falls back to `"dashboard"` so the area stays visibly current.
 *    This preserves what `activeSection="dashboard"` used to do.
 * 3. Everything else, including all of `/settings/*` — `"settings"`, which matches no
 *    sidebar item. Correct: settings has its own sub-navigation, and lighting up an
 *    unrelated sidebar entry would be a lie.
 */
function sectionFor(pathname: string): AdminSection {
  const exact = SECTION_URLS[pathname as keyof typeof SECTION_URLS] as AdminSection | undefined;
  if (exact) return exact;
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) return "dashboard";
  return "settings";
}

export default function AppShell({
  activeSection,
  children,
}: {
  /**
   * Overrides the pathname-derived highlight. Rarely needed — see `sectionFor`.
   *
   * Kept as an escape hatch rather than removed: a future area whose highlight is not
   * derivable from its URL has somewhere to say so.
   */
  activeSection?: AdminSection;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const section: AdminSection = activeSection ?? sectionFor(pathname);

  const isFullHeight = FULL_HEIGHT_ROUTES.has(pathname);

  /**
   * Sidebar clicks. Everything routes — there are no URL-less sections left now
   * that the inherited authoring group is deleted.
   */
  const handleNavigate = useCallback(
    (target: AdminSection) => {
      if (target === "profile") {
        router.push("/settings/profile");
        return;
      }
      router.push(urlForSection(target) ?? "/dashboard");
    },
    [router]
  );

  return (
    <>
      <Sidebar activeSection={section} onNavigate={handleNavigate} />

      <div className="flex min-w-0 flex-1 flex-col bg-surface-wash dark:bg-night-body">
        <TopNav />

        {isFullHeight ? (
          <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-surface-wash px-3 pb-3 pt-20 sm:px-4 md:pt-3 dark:bg-night-body">
            {children}
          </main>
        ) : (
          <main className="scrollbar-hide scroll-smooth flex-1 overflow-y-auto bg-surface-wash px-4 py-6 pt-20 sm:px-6 sm:py-6 md:pt-4 lg:px-6 dark:bg-night-body 2xl:px-8 2xl:py-8">
            {children}
          </main>
        )}
      </div>
    </>
  );
}
