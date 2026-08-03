"use client";

import { useState, useCallback, useEffect, useRef, memo } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import useAppDispatch from "@/lib/hooks/useAppDispatch";
import { logoutUser } from "@/lib/store/authSlice";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import usePermissions from "@/lib/hooks/usePermissions";

export type AdminSection =
  | "dashboard"
  | "candidate"
  | "user-info"
  | "user-add"
  | "roles"
  | "activity"
  | "profile"
  | "add-category"
  | "add-job-role"
  | "add-test-section"
  | "select-question-type"
  | "add-question";

/** Pathname → AdminSection mapping for URL-routed sections */
export const SECTION_URLS = {
  "/dashboard": "dashboard",
  "/dashboard/candidates": "candidate",
  "/dashboard/all-users": "user-info",
  "/dashboard/add-user": "user-add",
  "/dashboard/roles": "roles",
  "/dashboard/activity": "activity",
  "/dashboard/profile": "profile",
} as const satisfies Partial<Record<string, AdminSection>>;

interface SidebarProps {
  activeSection: AdminSection;
  onNavigate: (section: AdminSection) => void;
}

const subItems: { id: AdminSection; label: string; icon: React.ReactNode }[] = [
  {
    id: "add-category",
    label: "Add Category",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
      </svg>
    ),
  },
  {
    id: "add-job-role",
    label: "Add Job Role",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: "add-test-section",
    label: "Add Test Section",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    id: "select-question-type",
    label: "Select Question Type",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: "add-question",
    label: "Add Question",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
    ),
  },
];

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
          className="pointer-events-none fixed z-[9999] -translate-y-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg dark:bg-gray-700"
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
function NavButton({
  active,
  onClick,
  icon,
  label,
  large,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  large?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex w-full items-center gap-3 rounded-xl px-3 font-semibold transition-all duration-200 overflow-hidden ${
        large ? "py-3 text-base" : "py-2.5 text-sm"
      } ${
        active
          ? "bg-orange-50 text-[#F97316] dark:bg-orange-950/40 dark:text-orange-400 shadow-sm"
          : "text-gray-700 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100"
      }`}
    >
      {active && (
        <div className="absolute inset-0 bg-gradient-to-r from-orange-50 via-orange-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 dark:from-orange-950/40 dark:via-orange-950/20" />
      )}
      <span
        className={`flex shrink-0 items-center justify-center rounded-lg transition-all duration-200 ${
          large ? "h-10 w-10" : "h-8 w-8"
        } ${
          active
            ? "bg-[#F97316] text-white shadow-md"
            : "bg-gray-100 text-gray-500 group-hover:bg-orange-50 group-hover:text-[#F97316] dark:bg-gray-700 dark:text-gray-400 dark:group-hover:bg-orange-950/40 dark:group-hover:text-orange-400"
        }`}
      >
        {icon}
      </span>
      <span className="truncate relative z-10">{label}</span>
      {active && (
        <span className="ml-auto h-2 w-2 rounded-full bg-[#F97316] animate-pulse dark:bg-orange-400" />
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
        className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200 relative ${
          active
            ? "bg-[#F97316] text-white shadow-md"
            : "bg-gray-100 text-gray-500 hover:bg-orange-50 hover:text-[#F97316] dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-orange-950/40 dark:hover:text-orange-400"
        }`}
      >
        {icon}
        {active && (
          <span className="absolute inset-0 rounded-xl animate-pulse-ring" style={{
            boxShadow: "inset 0 0 0 1px rgba(249, 115, 22, 0.2)",
          }} />
        )}
      </button>
    </Tooltip>
  );
}

const userInfoSections: AdminSection[] = ["user-info", "user-add"];

// ── Shared nav items renderer ─────────────────────────────────────────────────
function NavItems({
  activeSection,
  onNavigate,
  collapsed,
  setCollapsed,
  createTestOpen,
  setCreateTestOpen,
  navIcons,
  isSubItemActive,
  large,
}: {
  activeSection: AdminSection;
  onNavigate: (s: AdminSection) => void;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  createTestOpen: boolean;
  setCreateTestOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  navIcons: Record<string, React.ReactNode>;
  isSubItemActive: boolean;
  large?: boolean;
}) {
  const isUserSubActive = userInfoSections.includes(activeSection);
  // Nav mirrors the API's gating: an item the user cannot use is not shown.
  // The API re-checks regardless — hiding a link is not the control.
  const { can } = usePermissions();

  return (
    <>
      {/* Dashboard */}
      {collapsed ? (
        <IconButton
          active={activeSection === "dashboard"}
          onClick={() => onNavigate("dashboard")}
          icon={navIcons.dashboard}
          label="Dashboard"
        />
      ) : (
        <NavButton
          active={activeSection === "dashboard"}
          onClick={() => onNavigate("dashboard")}
          icon={navIcons.dashboard}
          label="Dashboard"
          large={large}
        />
      )}

      {/* Candidate — requires candidate-view */}
      {can("candidate-view") &&
        (collapsed ? (
          <IconButton
            active={activeSection === "candidate"}
            onClick={() => onNavigate("candidate")}
            icon={navIcons.candidate}
            label="Candidate"
          />
        ) : (
          <NavButton
            active={activeSection === "candidate"}
            onClick={() => onNavigate("candidate")}
            icon={navIcons.candidate}
            label="Candidate"
            large={large}
          />
        ))}

      {/* Users — requires user-view */}
      {can("user-view") &&
        (collapsed ? (
          <IconButton
            active={isUserSubActive}
            onClick={() => onNavigate("user-info")}
            icon={navIcons.userInfo}
            label="Users"
          />
        ) : (
          <NavButton
            active={isUserSubActive}
            onClick={() => onNavigate("user-info")}
            icon={navIcons.userInfo}
            label="Users"
            large={large}
          />
        ))}

      {/* Roles & Permissions — requires role-view */}
      {can("role-view") &&
        (collapsed ? (
          <IconButton
            active={activeSection === "roles"}
            onClick={() => onNavigate("roles")}
            icon={navIcons.roles}
            label="Roles & Permissions"
          />
        ) : (
          <NavButton
            active={activeSection === "roles"}
            onClick={() => onNavigate("roles")}
            icon={navIcons.roles}
            label="Roles & Permissions"
            large={large}
          />
        ))}

      {/* Activity Log — requires activity-view */}
      {can("activity-view") &&
        (collapsed ? (
          <IconButton
            active={activeSection === "activity"}
            onClick={() => onNavigate("activity")}
            icon={navIcons.activity}
            label="Activity Log"
          />
        ) : (
          <NavButton
            active={activeSection === "activity"}
            onClick={() => onNavigate("activity")}
            icon={navIcons.activity}
            label="Activity Log"
            large={large}
          />
        ))}

      {/* Create (inherited test-platform authoring) — requires category-create */}
      {can("category-create") &&
        (collapsed ? (
        <IconButton
          active={isSubItemActive}
          onClick={() => { setCollapsed(false); setCreateTestOpen(true); }}
          icon={navIcons.createTest}
          label="Create"
        />
      ) : (
        <div>
          <button
            type="button"
            onClick={() => setCreateTestOpen((o: boolean) => !o)}
            className={`group flex w-full items-center justify-between rounded-xl px-3 font-semibold transition-all duration-150 ${
              large ? "py-3 text-base" : "py-2.5 text-sm"
            } ${
              isSubItemActive
                ? "bg-orange-50 text-[#F97316] dark:bg-orange-950/40 dark:text-orange-400"
                : "text-gray-700 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100"
            }`}
          >
            <span className="flex items-center gap-3">
              <span
                className={`flex shrink-0 items-center justify-center rounded-lg transition-colors ${
                  large ? "h-10 w-10" : "h-8 w-8"
                } ${
                  isSubItemActive
                    ? "bg-[#F97316] text-white"
                    : "bg-gray-100 text-gray-500 group-hover:bg-orange-50 group-hover:text-[#F97316] dark:bg-gray-700 dark:text-gray-400 dark:group-hover:bg-orange-950/40 dark:group-hover:text-orange-400"
                }`}
              >
                {navIcons.createTest}
              </span>
              Create
            </span>
            <svg
              className={`h-4 w-4 shrink-0 transition-transform duration-200 ${createTestOpen ? "rotate-180" : ""} ${isSubItemActive ? "text-[#F97316] dark:text-orange-400" : "text-gray-400 dark:text-gray-500"}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <div
            className={`overflow-hidden transition-all duration-200 ease-in-out ${
              createTestOpen ? "max-h-72 opacity-100 mt-1" : "max-h-0 opacity-0"
            }`}
          >
            <div className="ml-6 border-l-2 border-gray-100 pl-3 space-y-0.5 py-1 dark:border-gray-700">
              {subItems.map((item) => {
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onNavigate(item.id)}
                    className={`group flex w-full items-center gap-2.5 rounded-lg px-3 transition-all duration-100 ${
                      large ? "py-2.5 text-base" : "py-2 text-sm"
                    } ${
                      isActive
                        ? "bg-orange-50 font-semibold text-[#F97316] dark:bg-orange-950/40 dark:text-orange-400"
                        : "font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                    }`}
                  >
                    <span
                      className={`shrink-0 transition-colors ${
                        isActive ? "text-[#F97316] dark:text-orange-400" : "text-gray-400 group-hover:text-gray-600 dark:text-gray-500 dark:group-hover:text-gray-300"
                      }`}
                    >
                      {item.icon}
                    </span>
                    {item.label}
                    {isActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#F97316] dark:bg-orange-400" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        ))}
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
      className={`flex w-full items-center gap-2 rounded-lg px-3 font-medium text-gray-500 transition-all duration-200 hover:bg-red-50 hover:text-red-500 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-red-950/30 dark:hover:text-red-400 ${
        large ? "py-2.5 text-base" : "py-2 text-sm"
      }`}
    >
      {logoutIcon}
      {loggingOut ? "Signing out…" : "Sign Out"}
    </button>
  );
});

const BottomCollapsed = memo(function BottomCollapsed({
  loggingOut,
  onLogout,
}: {
  loggingOut: boolean;
  onLogout: () => void;
}) {
  return (
    <div className="flex justify-center">
      <Tooltip label={loggingOut ? "Signing out…" : "Sign Out"}>
        <button
          type="button"
          onClick={onLogout}
          disabled={loggingOut}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition-all duration-200 hover:bg-red-50 hover:text-red-500 disabled:opacity-50 dark:text-gray-500 dark:hover:bg-red-950/30 dark:hover:text-red-400"
        >
          {logoutIcon}
        </button>
      </Tooltip>
    </div>
  );
});

//Sidebar
export default function Sidebar({ activeSection, onNavigate }: SidebarProps) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileVisible, setMobileVisible] = useState(false);
  const [createTestOpen, setCreateTestOpen] = useState<boolean>(
    subItems.some((s) => s.id === activeSection)
  );

  // Keep the submenu open whenever a sub-item is active
  useEffect(() => {
    if (subItems.some((s) => s.id === activeSection)) {
      setCreateTestOpen(true);
    }
  }, [activeSection]);
  const [loggingOut, setLoggingOut] = useState(false);

  const isSubItemActive = subItems.some((s) => s.id === activeSection);

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
    createTest: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
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
    candidate: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
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
    createTestOpen,
    setCreateTestOpen,
    navIcons,
    isSubItemActive,
  };

  return (
    <>
      {/* ── Mobile top bar (visible below md) ── */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center border-b border-gray-200 bg-white px-4 md:hidden dark:border-gray-800 dark:bg-gray-900">
        <button
          type="button"
          onClick={() => onNavigate("dashboard")}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F97316] text-sm font-bold text-white"
        >
          P
        </button>
        <div className="ml-2.5">
          <p className="text-sm font-bold text-gray-900 leading-tight dark:text-white">Partner Marketplace</p>
          <p className="text-[10px] font-medium text-[#F97316] uppercase tracking-widest leading-tight">
            Admin Panel
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
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
          <div className={`relative flex w-72 max-w-[85vw] flex-col bg-white shadow-2xl dark:bg-gray-900 transition-transform duration-300 ease-in-out ${mobileVisible ? "translate-x-0" : "-translate-x-full"}`}>
            <div className="flex h-14 items-center border-b border-gray-100 px-4 dark:border-gray-800">
              <button
                type="button"
                onClick={() => onNavigate("dashboard")}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F97316] text-sm font-bold text-white"
              >
                P
              </button>
              <div className="ml-2.5">
                <p className="text-sm font-bold text-gray-900 leading-tight dark:text-white">Partner Marketplace</p>
                <p className="text-[10px] font-medium text-[#F97316] uppercase tracking-widest leading-tight">
                  Admin Panel
                </p>
              </div>
              <button
                type="button"
                onClick={closeMobile}
                className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:text-gray-500 dark:hover:bg-gray-800"
                aria-label="Close menu"
              >
                {navIcons.close}
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide scroll-smooth px-3 py-4 space-y-1">
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                Administration
              </p>
              <NavItems {...navItemsProps} collapsed={false} />
            </nav>

            <div className="border-t border-gray-100 px-3 py-3 dark:border-gray-800">
              <BottomExpanded loggingOut={loggingOut} onLogout={handleLogout} />
            </div>
          </div>
        </div>
      )}

      {/* ── Desktop / tablet sidebar (hidden below md) ── */}
      <aside
        className={`hidden md:flex flex-col shrink-0 bg-white border-r border-gray-200 h-screen transition-[width] duration-300 ease-in-out 2xl:transition-none shadow-sm dark:bg-gray-900 dark:border-gray-800 animate-slide-in-left ${
          collapsed
            ? "w-[68px]"
            : "w-64 2xl:w-72"
        }`}
      >
        <div className="flex h-14 items-center border-b border-gray-100 px-3 transition-colors duration-200 flex-shrink-0 dark:border-gray-800">
          <button
            type="button"
            onClick={() => onNavigate("dashboard")}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F97316] text-sm font-bold text-white transition-all duration-200 hover:bg-orange-600 hover:shadow-md 2xl:h-10 2xl:w-10 2xl:text-base"
            title="Dashboard"
          >
            P
          </button>

          <div
            className={`ml-2.5 min-w-0 overflow-hidden transition-all duration-300 ease-in-out ${
              collapsed ? "w-0 opacity-0" : "w-full opacity-100"
            }`}
          >
            <p className="truncate text-sm font-bold text-gray-900 leading-tight 2xl:text-base dark:text-white">Partner Marketplace</p>
            <p className="truncate text-[10px] font-medium text-[#F97316] uppercase tracking-widest leading-tight">
              Admin Panel
            </p>
          </div>

          {!collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              title="Collapse sidebar"
              className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-400 transition-all duration-200 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7M19 19l-7-7 7-7" />
              </svg>
            </button>
          )}
        </div>

        {collapsed && (
          <div className="flex justify-center py-2 border-b border-gray-100 transition-colors duration-200 flex-shrink-0 dark:border-gray-800">
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              title="Expand sidebar"
              className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-all duration-200 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide scroll-smooth px-3 py-4 space-y-1 2xl:py-5 2xl:space-y-1.5">
          {!collapsed && (
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
              Administration
            </p>
          )}
          <NavItems {...navItemsProps} large={false} />
        </nav>

        <div className={`border-t border-gray-100 flex-shrink-0 dark:border-gray-800 ${collapsed ? "px-2 py-3" : "px-3 py-3 2xl:px-4 2xl:py-4"}`}>
          {collapsed ? (
            <BottomCollapsed loggingOut={loggingOut} onLogout={handleLogout} />
          ) : (
            <BottomExpanded loggingOut={loggingOut} onLogout={handleLogout} />
          )}
        </div>
      </aside>
    </>
  );
}
