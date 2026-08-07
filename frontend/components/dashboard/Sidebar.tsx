"use client";

import { useState, useCallback, useEffect, useRef, memo } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import useAppDispatch from "@/lib/hooks/useAppDispatch";
import { logoutUser } from "@/lib/store/authSlice";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import useNavigation from "@/lib/hooks/useNavigation";
import NavTree from "@/components/dashboard/NavTree";
import type { NavigationSection } from "@/types";
import { useBranding } from "@/components/common/BrandingProvider";
import BrandMark from "@/components/common/BrandMark";

export type AdminSection =
  | "dashboard"
  | "user-info"
  | "user-add"
  | "roles"
  | "invitations"
  | "activity"
  | "profile"
  /**
   * Not a dashboard section — the marker the /settings routes pass so that **no**
   * sidebar item highlights while the user is in the settings area. Settings has
   * its own sub-nav; highlighting Dashboard underneath it would be a lie.
   */
  | "settings";

/** Pathname → AdminSection mapping for URL-routed sections */
export const SECTION_URLS = {
  "/dashboard": "dashboard",
  "/dashboard/users": "user-info",
  // The two retired paths still map, so a bookmark keeps the sidebar correct
  // while the 307 resolves. See navigation_service.py.
  "/dashboard/all-users": "user-info",
  "/dashboard/add-user": "user-info",
  "/dashboard/roles": "roles",
  "/dashboard/invitations": "invitations",
  "/dashboard/activity": "activity",
} as const satisfies Partial<Record<string, AdminSection>>;

/**
 * The URL that owns a section, or `null` for the in-page authoring sections.
 *
 * Shared so the dashboard and the settings shell agree on one mapping instead of
 * each reversing `SECTION_URLS` themselves.
 */
export function urlForSection(section: AdminSection): string | null {
  const match = Object.entries(SECTION_URLS).find(([, value]) => value === section);
  return match ? match[0] : null;
}

interface SidebarProps {
  activeSection: AdminSection;
  onNavigate: (section: AdminSection) => void;
}


// ── Tooltip (desktop collapsed sidebar only) ──────────────────────────────────
function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const anchorRef = useRef<HTMLDivElement>(null);

  const show = () => {
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setCoords({ top: rect.top + rect.height / 2, left: rect.right + 8 });
    }
    setVisible(true);
  };

  const hide = () => setVisible(false);

  return (
    <div
      ref={anchorRef}
      className="flex w-full items-center justify-center"
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      {children}
      {visible && typeof document !== "undefined" && createPortal(
        <div
          className="pointer-events-none fixed z-[9999] -translate-y-1/2 whitespace-nowrap rounded-[5px] bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg dark:bg-gray-700"
          style={{ top: coords.top, left: coords.left }}
        >
          {label}
          <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900 dark:border-r-gray-700" />
        </div>,
        document.body
      )}
    </div>
  );
}

// ── NavButton (expanded sidebar) ──────────────────────────────────────────────
/**
 * A nav row, matched to `dashboard-default-light-top.png`.
 *
 * Three corrections against the first attempt, all from measuring the reference
 * rather than reading the CSS:
 *
 *  - **The icon is bare.** Viho does not put nav icons in a tinted tile; it is an
 *    outline glyph sitting directly on the row. The tile made every row look like
 *    a button.
 *  - **No shadow on the active row.** Sampled directly beneath the filled
 *    "Tables" item in `tables-datatable-light-pagination.png`: clean white, no
 *    falloff. Viho removes shadows far more than it adds them.
 *  - **A chevron, not a dot.** Expandable rows get a chevron that points right
 *    when closed and down when open. The pulsing dot was invented.
 */
function NavButton({
  active,
  onClick,
  icon,
  label,
  large,
  expandable = false,
  expanded = false,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  large?: boolean;
  expandable?: boolean;
  expanded?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-center gap-3 rounded-[10px] px-4 font-semibold transition-colors ${
        large ? "py-3 text-sm" : "py-2.5 text-xs"
      } ${
        active
          ? "bg-brand text-white"
          : "text-ink hover:bg-brand/10 hover:text-brand dark:text-gray-200 dark:hover:bg-brand/20 dark:hover:text-brand-on-dark"
      }`}
    >
      <span
        className={`flex shrink-0 items-center justify-center transition-colors ${
          large ? "h-6 w-6" : "h-5 w-5"
        } ${active ? "text-white" : "text-ink dark:text-gray-300"}`}
      >
        {icon}
      </span>
      <span className="truncate">{label}</span>
      {expandable && (
        <svg
          className={`ml-auto h-4 w-4 shrink-0 transition-transform duration-200 ${
            expanded ? "rotate-90" : ""
          } ${active ? "text-white" : "text-ink-muted dark:text-night-muted"}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      )}
    </button>
  );
}

// ── IconButton (collapsed desktop sidebar) ────────────────────────────────────
function IconButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Tooltip label={label}>
      <button
        type="button"
        onClick={onClick}
        /*
          `bg-brand text-white` when active, matching the expanded nav item
          exactly. It used to be `bg-white/20 text-white`, which only ever made
          sense on a dark sidebar: over the old white surface it rendered white
          text on white, so the active icon in the collapsed rail was invisible.
          The green surface would not have fixed that — 20% white over
          `surface-wash` is still near-white.

          Inactive carries no tile at all, per UI_PATTERNS § Sidebar Anatomy:
          "bare outline icon (never in a tinted tile)". The `bg-gray-100` it used
          to have was both off-convention and a grey chip on a green rail.
        */
        className={`flex h-10 w-10 items-center justify-center rounded-[5px] transition-all duration-200 relative ${
          active
            ? "bg-brand text-white"
            : "text-ink hover:bg-brand/10 hover:text-brand dark:text-gray-300 dark:hover:bg-brand/20 dark:hover:text-brand-on-dark"
        }`}
      >
        {icon}
        {active && (
          /* Brand teal. This carried the pre-Viho orange until 2026-08-07 — as an
             rgba() triple in an inline style, which is why the guard grep in
             UI_PATTERNS § Colour System never caught it: that grep looks for the
             hex and the `orange-*` utilities, and an inline rgba() is neither.
             `pulse-ring` in tailwind.config.ts had already been retinted; this
             was the last holdout. Keep literals out of this comment so the guard
             stays clean. */
          <span className="absolute inset-0 rounded-[5px] animate-pulse-ring" style={{
            boxShadow: "inset 0 0 0 1px rgba(36, 105, 92, 0.2)",
          }} />
        )}
      </button>
    </Tooltip>
  );
}

// ── Shared nav items renderer ─────────────────────────────────────────────────
function NavItems({
  collapsed,
  large,
  sections,
  onNavigateHref,
}: {
  collapsed: boolean;
  large?: boolean;
  sections: NavigationSection[];
  onNavigateHref: (href: string) => void;
}) {
  return (
    <>
      {/*
        The whole tree comes from the server. There is deliberately no `can(...)`
        call here: it arrives already filtered, and re-checking would restore the
        second source of truth that the server-driven nav exists to remove.

        Until 2026-08-06 the inherited "Create" authoring group was the one
        exception, gated client-side because its sections had no URLs. It was
        deleted with the rest of the test-platform domain, so there is now no
        client-side permission check anywhere in the nav path.
      */}
      <NavTree
        sections={sections}
        collapsed={collapsed}
        onNavigate={onNavigateHref}
        renderButton={({ active, label, icon, onClick }) =>
          collapsed ? (
            <IconButton active={active} onClick={onClick} icon={icon} label={label} />
          ) : (
            <NavButton active={active} onClick={onClick} icon={icon} label={label} large={large} />
          )
        }
      />

    </>
  );
}

/** Sign-out icon. Module-level so the footer buttons below keep a stable element
 *  identity across Sidebar renders. */
const logoutIcon = (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
  </svg>
);

/**
 * The sidebar footer's sign-out control, expanded and collapsed.
 *
 * Both are declared here at module level rather than inside `Sidebar`. A
 * `memo()` component created during render gets a brand-new type on every
 * render, which discards the memoisation entirely and resets any state it
 * holds — the failure `react-hooks/static-components` exists to catch. They
 * take what they need as props instead of closing over Sidebar's scope.
 */
const BottomExpanded = memo(function BottomExpanded({
  large,
  loggingOut,
  onLogout,
}: {
  large?: boolean;
  loggingOut: boolean;
  onLogout: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onLogout}
      disabled={loggingOut}
      className={`flex w-full items-center gap-2 rounded-[5px] px-3 font-medium text-gray-500 transition-all duration-200 hover:bg-tone-danger/10 hover:text-tone-danger disabled:opacity-50 dark:text-gray-400 dark:hover:bg-tone-danger/15 dark:hover:text-tone-danger ${
        large ? "py-2.5 text-base" : "py-2 text-sm"
      }`}
    >
      {logoutIcon}
      {loggingOut ? "Signing out…" : "Sign Out"}
    </button>
  );
});


//Sidebar
export default function Sidebar({ activeSection, onNavigate }: SidebarProps) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  // The three `branding.app_name` call sites below had the import but no hook
  // call, which failed the type check. Runtime branding, so the sidebar name
  // follows `/api/settings/branding` rather than a build-time constant.
  const branding = useBranding();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileVisible, setMobileVisible] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // The nav tree, built and permission-filtered by the API.
  const { sections } = useNavigation();

  /**
   * Server nav items carry a URL, so they route directly. The inherited authoring
   * sections below have no URL and still go through `onNavigate(section)` — that is
   * the whole reason both paths exist.
   */
  const onNavigateHref = useCallback(
    (href: string) => {
      if (href && href !== "#") router.push(href);
    },
    [router]
  );

  useEffect(() => {
    if (mobileOpen) closeMobile();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection]);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
      // Mount then trigger enter transition on next frame
      requestAnimationFrame(() => setMobileVisible(true));
    } else {
      // Trigger exit transition, then unmount after it completes
      setMobileVisible(false);
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const closeMobile = useCallback(() => {
    setMobileVisible(false);
    setTimeout(() => setMobileOpen(false), 300);
  }, []);

  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    await dispatch(logoutUser());
    router.push("/sign-in");
  }, [dispatch, router]);

  const navIcons = {
    dashboard: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    activity: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 12h6m-6 4h4" />
      </svg>
    ),
    roles: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
    userInfo: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    menu: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    ),
    close: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
  };

  const navItemsProps = {
    activeSection,
    onNavigate,
    collapsed,
    setCollapsed,
        navIcons,
      sections,
    onNavigateHref,
  };

  return (
    <>
      {/* ── Mobile top bar (visible below md) ── */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center border-b border-brand/20 bg-surface-wash px-4 md:hidden dark:border-night-border dark:bg-night-card">
        <button
          type="button"
          onClick={() => onNavigate("dashboard")}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[5px] bg-brand text-sm font-bold text-white"
        >
          <BrandMark />
        </button>
        <div className="ml-2.5">
          <p className="text-sm font-bold text-gray-900 leading-tight dark:text-white">{branding.app_name}</p>
          <p className="text-[10px] font-medium text-brand dark:text-brand-on-dark uppercase tracking-widest leading-tight">
            {branding.chrome_subtitle}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-[5px] text-ink-muted hover:bg-brand/10 hover:text-brand dark:text-gray-400 dark:hover:bg-brand/20 dark:hover:text-brand-on-dark"
            aria-label="Open menu"
          >
            {navIcons.menu}
          </button>
        </div>
      </header>

      {/* ── Mobile drawer overlay ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 flex md:hidden"
          role="dialog"
          aria-modal="true"
        >
          {/* Backdrop — fades in/out */}
          <div
            className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${mobileVisible ? "opacity-100" : "opacity-0"}`}
            onClick={closeMobile}
          />

          {/* Drawer panel — slides in from left */}
          <div className={`relative flex w-72 max-w-[85vw] flex-col bg-surface-wash shadow-2xl dark:bg-night-card transition-transform duration-300 ease-in-out ${mobileVisible ? "translate-x-0" : "-translate-x-full"}`}>
            <div className="flex h-14 items-center border-b border-brand/20 px-4 dark:border-night-border">
              <button
                type="button"
                onClick={() => onNavigate("dashboard")}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[5px] bg-brand text-sm font-bold text-white"
              >
                <BrandMark />
              </button>
              <div className="ml-2.5">
                <p className="text-sm font-bold text-gray-900 leading-tight dark:text-white">{branding.app_name}</p>
                <p className="text-[10px] font-medium text-brand dark:text-brand-on-dark uppercase tracking-widest leading-tight">
                  {branding.chrome_subtitle}
                </p>
              </div>
              <button
                type="button"
                onClick={closeMobile}
                className="ml-auto flex h-8 w-8 items-center justify-center rounded-[5px] text-ink-muted hover:bg-brand/10 hover:text-brand dark:text-gray-500 dark:hover:bg-brand/20 dark:hover:text-brand-on-dark"
                aria-label="Close menu"
              >
                {navIcons.close}
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide scroll-smooth px-3 py-4 space-y-1">
              <NavItems {...navItemsProps} collapsed={false} />
            </nav>

            {/* Mobile only. The desktop sidebar's sign-out moved to the header
                on 2026-08-06 to match the theme, but `TopNav` is `hidden md:flex`
                — dropping this too would leave phone users unable to log out. */}
            <div className="border-t border-brand/20 px-3 py-3 dark:border-night-border">
              <BottomExpanded loggingOut={loggingOut} onLogout={handleLogout} />
            </div>
          </div>
        </div>
      )}

      {/* ── Desktop / tablet sidebar (hidden below md) ── */}
      <aside
        className={`hidden md:flex flex-col shrink-0 bg-surface-wash border-r border-brand/20 h-screen transition-[width] duration-300 ease-in-out 2xl:transition-none dark:bg-night-card dark:border-night-border animate-slide-in-left ${
          collapsed
            ? "w-[68px]"
            : "w-64 2xl:w-72"
        }`}
      >
        <div className="flex h-14 items-center border-b border-brand/20 px-3 transition-colors duration-200 flex-shrink-0 dark:border-night-border">
          <button
            type="button"
            onClick={() => onNavigate("dashboard")}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[5px] bg-brand text-sm font-bold text-white transition-colors duration-200 hover:bg-brand-dark 2xl:h-10 2xl:w-10 2xl:text-base"
            title="Dashboard"
          >
            <BrandMark />
          </button>

          <div
            className={`ml-2.5 min-w-0 overflow-hidden transition-all duration-300 ease-in-out ${
              collapsed ? "w-0 opacity-0" : "w-full opacity-100"
            }`}
          >
            <p className="truncate text-sm font-bold text-gray-900 leading-tight 2xl:text-base dark:text-white">{branding.app_name}</p>
            <p className="truncate text-[10px] font-medium text-brand dark:text-brand-on-dark uppercase tracking-widest leading-tight">
              {branding.chrome_subtitle}
            </p>
          </div>

          {!collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              title="Collapse sidebar"
              className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-muted transition-all duration-200 hover:bg-brand/10 hover:text-brand dark:text-gray-500 dark:hover:bg-brand/20 dark:hover:text-brand-on-dark"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7M19 19l-7-7 7-7" />
              </svg>
            </button>
          )}
        </div>

        {collapsed && (
          <div className="flex justify-center py-2 border-b border-brand/20 transition-colors duration-200 flex-shrink-0 dark:border-night-border">
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              title="Expand sidebar"
              className="flex h-7 w-7 items-center justify-center rounded-md text-ink-muted transition-all duration-200 hover:bg-brand/10 hover:text-brand dark:text-gray-500 dark:hover:bg-brand/20 dark:hover:text-brand-on-dark"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide scroll-smooth px-3 py-4 space-y-1 2xl:py-5 2xl:space-y-1.5">
          <NavItems {...navItemsProps} large={false} />
        </nav>

      </aside>
    </>
  );
}
