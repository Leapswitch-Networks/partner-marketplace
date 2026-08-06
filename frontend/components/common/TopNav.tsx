"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import useAppSelector from "@/lib/hooks/useAppSelector";
import useAppDispatch from "@/lib/hooks/useAppDispatch";
import { logoutUser } from "@/lib/store/authSlice";
import { useTheme } from "@/lib/hooks/useTheme";
import { getRoleLabel, getUserDisplayName } from "@/lib/utils/user";

/**
 * The dashboard top bar — Viho's `.page-main-header`.
 *
 * Built against `dashboard-default-light-top.png`, whose action row is
 * fullscreen · language · bookmarks · notifications · dark mode · messages, then
 * a tinted `Log out` — `bg-brand/10` with brand text and icon, which is Viho's
 * `.btn-primary-light` pattern. **Sign-out lives here, not in the sidebar
 * footer**, matching the theme.
 *
 * **Only the controls that do something are rendered.** The first pass included
 * the theme's full row, greying out the six with no feature behind them; the
 * owner had them removed, which is the better call — a permanently dead control
 * is visual noise that teaches users to ignore that corner of the screen. Gone
 * with them: the bare search (Global Search is an unbuilt parity module),
 * language, bookmarks, notifications and messages.
 *
 * So what remains is real: **fullscreen**, **dark mode**, **log out**, and the
 * account menu. Add each of the others back here, live, when its feature lands —
 * `VIHO_THEME_REFERENCE.md` § Dashboard Shell records the full row.
 *
 * Viho's bell also carries a red unread dot. It is not reproduced, and would not
 * have been even if the bell had stayed: a badge that can never clear is worse
 * than no badge.
 */

const ICON = "h-[22px] w-[22px]";

function HeaderIcon({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-10 w-10 items-center justify-center rounded-full text-ink transition-colors hover:bg-brand/10 hover:text-brand focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 dark:text-gray-200 dark:hover:bg-brand/20 dark:hover:text-brand-on-dark"
    >
      {children}
    </button>
  );
}

export default function TopNav() {
  const router = useRouter();
  const pathname = usePathname();
  const inSettings = pathname.startsWith("/settings");
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const { appearance, resolvedTheme, toggleTheme } = useTheme();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const displayName = getUserDisplayName(user);
  const initials =
    displayName
      .split(" ")
      .map((w: string) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "SA";
  const roleLabel = getRoleLabel(user) || null;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) document.addEventListener("mousedown", handleClickOutside);
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
    router.push("/settings/profile");
  }, [router]);

  const toggleFullscreen = useCallback(() => {
    if (typeof document === "undefined") return;
    if (document.fullscreenElement) void document.exitFullscreen?.();
    else void document.documentElement.requestFullscreen?.();
  }, []);

  return (
    <header className="hidden h-16 shrink-0 items-center justify-end gap-2 border-b border-surface-border bg-white px-4 sm:px-6 md:flex lg:px-8 dark:border-night-border dark:bg-night-card">
      <div className="flex shrink-0 items-center gap-0.5">
        <HeaderIcon label="Fullscreen" onClick={toggleFullscreen}>
          <svg className={ICON} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 9V5a1 1 0 011-1h4M20 9V5a1 1 0 00-1-1h-4M4 15v4a1 1 0 001 1h4M20 15v4a1 1 0 01-1 1h-4" />
          </svg>
        </HeaderIcon>

        <HeaderIcon
          label={`Theme: ${appearance}${appearance === "system" ? ` (${resolvedTheme})` : ""}`}
          onClick={toggleTheme}
        >
          {resolvedTheme === "dark" ? (
            <svg className={ICON} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <circle cx="12" cy="12" r="4" />
              <path strokeLinecap="round" d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
            </svg>
          ) : (
            <svg className={ICON} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </HeaderIcon>

        {/* The account menu. Not in the theme, but Profile needs a home now the
            sidebar footer is gone. Sits before Log out, not after. */}
        <div className="relative ml-2" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen((o) => !o)}
            aria-haspopup="true"
            aria-expanded={dropdownOpen}
            className={`flex items-center gap-2.5 rounded-[5px] px-2 py-1.5 transition-colors ${
              inSettings ? "bg-brand/10 dark:bg-brand/20" : "hover:bg-brand/10 dark:hover:bg-brand/20"
            }`}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
              {initials}
            </span>
            <div className="hidden text-left xl:block">
              <p className="text-sm font-semibold leading-tight text-ink dark:text-white">
                {displayName || "—"}
              </p>
              {roleLabel && (
                <p className="text-[10px] font-medium leading-tight text-ink-muted dark:text-night-muted">
                  {roleLabel}
                </p>
              )}
            </div>
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-[5px] border border-surface-border bg-white shadow-lg dark:border-night-border dark:bg-night-card">
              <div className="border-b border-surface-border px-4 py-3 dark:border-night-border">
                <p className="truncate text-sm font-semibold text-ink dark:text-white">
                  {displayName || "—"}
                </p>
                {user?.email && (
                  <p className="truncate text-xs text-ink-muted dark:text-night-muted">{user.email}</p>
                )}
              </div>
              <div className="py-1">
                <button
                  type="button"
                  onClick={handleProfile}
                  className={`flex min-h-[44px] w-full items-center gap-2.5 px-4 py-2.5 text-sm transition-colors md:min-h-0 ${
                    inSettings
                      ? "bg-brand/10 font-semibold text-brand dark:bg-brand/20 dark:text-brand-on-dark"
                      : "text-ink hover:bg-brand/10 dark:text-gray-300 dark:hover:bg-brand/20"
                  }`}
                >
                  <svg
                    className={`h-4 w-4 ${inSettings ? "text-brand dark:text-brand-on-dark" : "text-ink-muted"}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Profile
                </button>
              </div>
            </div>
          )}
        </div>
        {/* Viho's btn-primary-light: tinted brand fill, brand text, no border.
            Last in the row, hard against the corner — the theme puts it there and
            so does the owner. The account menu sits to its left. */}
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="ml-2 inline-flex items-center gap-2 rounded-[8px] bg-brand/10 px-4 py-2.5 text-sm font-semibold text-brand transition-colors hover:bg-brand hover:text-white focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-brand/20 dark:text-brand-on-dark dark:hover:bg-brand dark:hover:text-white"
        >
          <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
          </svg>
          {loggingOut ? "Signing out…" : "Log out"}
        </button>

      </div>
    </header>
  );
}
