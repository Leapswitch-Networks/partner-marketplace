"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import useAppSelector from "@/lib/hooks/useAppSelector";
import useAppDispatch from "@/lib/hooks/useAppDispatch";
import { logoutUser } from "@/lib/store/authSlice";
import { getRoleLabel, getUserDisplayName } from "@/lib/utils/user";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import type { AdminSection } from "@/components/dashboard/Sidebar";

interface TopNavProps {
  onNavigate?: (section: AdminSection) => void;
  activeSection?: AdminSection;
}

export default function TopNav({ onNavigate, activeSection }: TopNavProps) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const displayName = getUserDisplayName(user);
  const initials = displayName
    .split(" ")
    .map((w: string) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "SA";

  // Roles are a list now, not a single enum column.
  const roleLabel = getRoleLabel(user) || null;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    setDropdownOpen(false);
    await dispatch(logoutUser());
    router.push("/sign-in");
  }, [dispatch, router]);

  const handleProfile = useCallback(() => {
    setDropdownOpen(false);
    onNavigate?.("profile");
  }, [onNavigate]);

  return (
    <header className="hidden md:flex h-14 items-center justify-end gap-2 bg-white border-b border-gray-100 px-4 sm:px-6 lg:px-8 dark:bg-gray-900 dark:border-gray-800 flex-shrink-0">
      <ThemeToggle />

      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setDropdownOpen((o) => !o)}
          aria-haspopup="true"
          aria-expanded={dropdownOpen}
          className={`flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 transition-colors duration-200 min-h-[44px] md:min-h-0 ${
            activeSection === "profile"
              ? "bg-orange-50 dark:bg-orange-950/40"
              : "hover:bg-gray-100 dark:hover:bg-gray-800"
          }`}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F97316] text-xs font-bold text-white">
            {initials}
          </span>
          <div className="hidden lg:block text-left">
            <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">
              {displayName || "—"}
            </p>
            {roleLabel && (
              <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 leading-tight">
                {roleLabel}
              </p>
            )}
          </div>
          <svg
            className={`hidden lg:block h-4 w-4 text-gray-400 transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 top-full z-50 mt-2 w-52 rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900 overflow-hidden">
            <div className="border-b border-gray-100 dark:border-gray-800 px-4 py-3">
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                {displayName || "—"}
              </p>
              {user?.email && (
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
              )}
            </div>

            <div className="py-1">
              <button
                type="button"
                onClick={handleProfile}
                className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-sm transition-colors duration-150 min-h-[44px] md:min-h-0 ${
                  activeSection === "profile"
                    ? "bg-orange-50 text-[#F97316] dark:bg-orange-950/40 dark:text-orange-400 font-semibold"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
              >
                <svg
                  className={`h-4 w-4 ${activeSection === "profile" ? "text-[#F97316] dark:text-orange-400" : "text-gray-400"}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Profile
                {activeSection === "profile" && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#F97316] dark:bg-orange-400" />
                )}
              </button>

              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors duration-150 disabled:opacity-50 min-h-[44px] md:min-h-0"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
                </svg>
                {loggingOut ? "Signing out…" : "Sign Out"}
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
