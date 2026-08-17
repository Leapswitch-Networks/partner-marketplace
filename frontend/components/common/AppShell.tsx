"use client";

import { useCallback, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar, {
  type AdminSection,
  SECTION_URLS,
  urlForSection,
} from "@/components/dashboard/Sidebar";
import TopNav from "@/components/common/TopNav";
import AssistantWidget from "@/components/dashboard/AssistantWidget";

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
  "/dashboard/activity",
]);

/**
 * Route trees whose every page owns the viewport height.
 *
 * Exact matching stopped being enough once a module became four routes rather
 * than one. `/dashboard/users/{id}` and `/dashboard/users/{id}/edit` carry ids,
 * so they cannot be listed literally — and all four pages are viewport-locked:
 * the index is a `Card` with an internally scrolling table, `ResourceForm` has a
 * fixed header and footer around a scrolling field area, and the show page
 * scrolls its own grid.
 *
 * Getting this wrong is not subtle: the page ends up inside the padded scrolling
 * panel as well, and two nested scroll containers means neither behaves.
 */
const FULL_HEIGHT_PREFIXES = [
  "/dashboard/users",
  "/dashboard/roles",
  "/dashboard/invitations",
  // Security, Health, Configuration and Recycle Bin build the same
  // viewport-locked card internally but were never listed here, so they ran
  // an inner scroll region inside the outer scrolling panel — the exact
  // nested-scroll failure the comment above describes, found by the
  // 2026-08-13 responsive audit. Third round of this list drifting; if a
  // fourth happens, derive membership from the page instead of a list.
  "/dashboard/security",
  "/dashboard/health",
  "/dashboard/configuration",
  "/dashboard/recycle-bin",
  // Partner Directory staff UI (PARTNER_DIRECTORY_PLAN § 15 row 2), 2026-08-13.
  "/dashboard/partners",
  "/dashboard/partner-tiers",
  // The other eight ResourceIndex routes, added 2026-08-13. They render the
  // exact same viewport-locked Card as Users, but only the three above were
  // ever listed — so switching from Users to any of these swapped the page
  // padding (px-3 pb-3 → px-4 py-6, up to 2xl:px-8 2xl:py-8) and wrapped the
  // self-measuring table in a second scroll container, the nested-scroll
  // failure the comment above warns about. Same card, same table, two looks.
  // `/dashboard/api-credentials` also covers `/providers` by prefix.
  "/dashboard/data-access",
  "/dashboard/api-credentials",
  "/dashboard/search",
  "/dashboard/errors",
  "/dashboard/feature-flags",
  "/dashboard/webhooks",
  "/dashboard/api-consumers",
];

function ownsViewportHeight(pathname: string): boolean {
  if (FULL_HEIGHT_ROUTES.has(pathname)) return true;
  return FULL_HEIGHT_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

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

  const isFullHeight = ownsViewportHeight(pathname);

  /**
   * Sidebar collapse. The state lives here rather than inside `Sidebar` because
   * the control that flips it now sits in `TopNav` — the two are siblings, so
   * this is their nearest common owner. `Sidebar` reads it; `TopNav` toggles it.
   *
   * Deliberately one toggle, not the old collapse-here / expand-there pair: the
   * button no longer lives on the thing it resizes, so a control that vanished
   * on collapse and reappeared somewhere else would be a moving target.
   */
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const toggleSidebar = useCallback(() => setSidebarCollapsed((c) => !c), []);

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
      <Sidebar
        activeSection={section}
        onNavigate={handleNavigate}
        collapsed={sidebarCollapsed}
      />

      <div className="flex min-w-0 flex-1 flex-col bg-surface-wash dark:bg-night-body">
        <TopNav sidebarCollapsed={sidebarCollapsed} onToggleSidebar={toggleSidebar} />

        {/* Scrolling branch: vertical padding is spelled as separate pt and pb
            on purpose. The old `py-6 pt-20 sm:py-6` relied on cascade order —
            `sm:py-6` sits later in the compiled sheet than `pt-20`, so from
            640-767px (landscape phones, small tablets, where the fixed mobile
            header still shows) the top padding collapsed to 24px and content
            slid under the header. Found by the 2026-08-13 responsive audit;
            invisible in the JSX. `scrollbar-thin` rather than `scrollbar-hide`:
            this is the app's primary scroll container, and hiding its only
            scroll affordance was a cost with no payer. */}
        {isFullHeight ? (
          <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-surface-wash px-3 pb-3 pt-20 sm:px-4 md:pt-3 dark:bg-night-body">
            {children}
          </main>
        ) : (
          <main className="scrollbar-thin scroll-smooth flex-1 overflow-y-auto bg-surface-wash px-4 pb-6 pt-20 sm:px-6 md:pt-4 lg:px-6 dark:bg-night-body 2xl:px-8 2xl:pb-8 2xl:pt-8">
            {children}
          </main>
        )}
      </div>

      {/*
        Mounted here rather than per page, which is what makes the flag in API
        Credentials show or hide it app-wide at once — the reference makes the
        same point about its widget. It renders `null` until it has confirmed the
        integration is on AND the caller holds `ai-assistant-use`, so for most
        roles this costs one request and nothing on screen.
      */}
      <AssistantWidget />
    </>
  );
}
