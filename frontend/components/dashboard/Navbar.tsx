"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import useAppSelector from "@/lib/hooks/useAppSelector";
import useAppDispatch from "@/lib/hooks/useAppDispatch";
import { logoutUser } from "@/lib/store/authSlice";
import { getRoleLabel, getUserDisplayName } from "@/lib/utils/user";
import { useBranding } from "@/components/common/BrandingProvider";
import BrandMark from "@/components/common/BrandMark";
import Avatar from "@/components/common/Avatar";

export default function Navbar() {
  const branding = useBranding();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    await dispatch(logoutUser());
    router.push("/sign-in");
  }, [dispatch, router]);

  const displayName = getUserDisplayName(user);
  const initials = displayName
    .split(" ")
    .map((w: string) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "SA";

  return (
    <header className="sticky top-0 z-30 border-b border-surface-border bg-white dark:border-night-border dark:bg-night-card">
      <div className="flex items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Brand */}
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-[5px] bg-brand text-sm font-bold text-white">
            <BrandMark />
          </span>
          <div className="hidden sm:block">
            <p className="text-sm font-bold text-gray-900 leading-tight dark:text-gray-100">{branding.app_name}</p>
            {/* `chrome_subtitle`, matching the sidebar's brand block. This was a
                hardcoded "Super Admin" — a ROLE label rendered to every user
                regardless of their actual role, so a Partner saw it too. It sits in
                the brand block beside the monogram and name, which is the branding
                subtitle's place; the role, if it belongs anywhere, belongs on the
                account menu. */}
            <p className="text-[10px] font-medium text-brand dark:text-brand-on-dark uppercase tracking-widest leading-tight">
              {branding.chrome_subtitle}
            </p>
          </div>
        </Link>

        {/* Desktop user menu */}
        <div className="hidden items-center gap-3 md:flex">
          <div className="flex items-center gap-2.5 rounded-[5px] border border-surface-border px-3 py-1.5 dark:border-night-border">
            <Avatar initials={initials} size="sm" />
            <div className="text-left">
              <p className="text-xs font-semibold text-gray-900 leading-tight dark:text-gray-100">{displayName}</p>
              <p className="text-[10px] text-gray-400 leading-tight dark:text-gray-500">{user?.email ?? ""}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex items-center gap-1.5 rounded-[5px] border border-surface-border px-3 py-2 text-sm font-medium text-gray-600 transition hover:border-surface-border hover:bg-gray-50 disabled:opacity-60 dark:border-night-border dark:text-gray-300 dark:hover:border-gray-600 dark:hover:bg-gray-800"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
            </svg>
            {loggingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>

        {/* Mobile avatar button */}
        <button
          className="flex min-h-[44px] min-w-[44px] items-center justify-center md:hidden"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
        >
          <Avatar initials={initials} size="md" />
        </button>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="border-t border-surface-border bg-white px-4 py-3 md:hidden dark:border-night-border dark:bg-night-card">
          {/* The user's real roles. Was a hardcoded "Super Admin", shown to every
              user — a Partner opening this menu was told they were a super admin.
              Rendered only when there is something to say, rather than as an empty
              heading. */}
          {getRoleLabel(user) && (
            <p className="mb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide dark:text-gray-500">
              {getRoleLabel(user)}
            </p>
          )}
          <p className="mb-3 text-sm text-gray-700 font-medium dark:text-gray-200">{displayName}</p>
          <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">{user?.email}</p>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full rounded-[5px] bg-gray-100 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-60 dark:bg-night-card dark:text-gray-300 dark:hover:bg-gray-700"
          >
            {loggingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      )}
    </header>
  );
}
