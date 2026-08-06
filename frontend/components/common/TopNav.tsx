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
 * Rebuilt 2026-08-06 against `dashboard-default-light-top.png`, which has, left
 * to right: a **bare search** (magnifier + placeholder, no bordered input and no
 * fill), then the action cluster — fullscreen, language, bookmark, notifications,
 * dark mode, chat — and finally a **tinted `Log out` button**: `bg-brand/10` with
 * brand text and a brand icon, which is Viho's `.btn-primary-light` pattern.
 *
 * **Sign-out lives here now, not in the sidebar footer**, matching the theme.
 *
 * Honest inventory, because most of these icons decorate features we do not have:
 *
 * | Icon | Real behaviour |
 * |---|---|
 * | Search | **Disabled.** Global Search is an unbuilt LEAPDESK_PARITY_PLAN module |
 * | Fullscreen | **Real** — toggles the Fullscreen API |
 * | Language | Disabled — English only |
 * | Bookmarks | Disabled — no such feature |
 * | Notifications | Disabled. **The theme's red unread dot is deliberately omitted**: a badge that can never clear is worse than no badge. It returns with the feature |
 * | Dark mode | **Real** — same `useTheme` cycle as `ThemeToggle` |
 * | Messages | Disabled — no such feature |
 * | Log out | **Real** |
 *
 * The dead ones are `aria-disabled` with a "coming soon" title so keyboard and
 * screen-reader users are told rather than left guessing, and each becomes live
 * in place when its feature lands. They are rendered because the owner asked for
 * the theme's full action row.
 */

const ICON = "h-[22px] w-[22px]";

function HeaderIcon({
  label,
  onClick,
  disabled = false,
  children,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      aria-label={label}
      aria-disabled={disabled || undefined}
      title={disabled ? `${label} — coming soon` : label}
      className={`flex h-10 w-10 items-center justify-center rounded-full text-ink transition-colors focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 dark:text-gray-200 ${
        disabled
          ? "cursor-default opacity-45"
          : "hover:bg-brand/10 hover:text-brand dark:hover:bg-brand/20 dark:hover:text-brand-on-dark"
      }`}
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
    <header className="hidden h-16 shrink-0 items-center gap-2 border-b border-surface-border bg-white px-4 sm:px-6 md:flex lg:px-8 dark:border-night-border dark:bg-night-card">
      {/* Bare search — no border, no fill, exactly as the theme renders it. */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <svg
          className="h-5 w-5 shrink-0 text-ink dark:text-gray-300"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
        </svg>
        <input
          type="search"
          disabled
          aria-label="Search (coming soon)"
          title="Search — coming soon"
          placeholder="Search.."
          className="w-full max-w-md cursor-default border-0 bg-transparent p-0 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-0 dark:text-white dark:placeholder:text-night-muted"
        />
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        <HeaderIcon label="Fullscreen" onClick={toggleFullscreen}>
          <svg className={ICON} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 9V5a1 1 0 011-1h4M20 9V5a1 1 0 00-1-1h-4M4 15v4a1 1 0 001 1h4M20 15v4a1 1 0 01-1 1h-4" />
          </svg>
        </HeaderIcon>

        <HeaderIcon label="Language" disabled>
          <svg className={ICON} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <circle cx="12" cy="12" r="9" />
            <path strokeLinecap="round" d="M3 12h18M12 3a15 15 0 010 18M12 3a15 15 0 000 18" />
          </svg>
        </HeaderIcon>

        <HeaderIcon label="Bookmarks" disabled>
          <svg className={ICON} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.5l2.2 4.46 4.92.72-3.56 3.47.84 4.9-4.4-2.31-4.4 2.31.84-4.9L4.36 8.68l4.92-.72 2.2-4.46z" />
          </svg>
        </HeaderIcon>

        <HeaderIcon label="Notifications" disabled>
          <svg className={ICON} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
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

        <HeaderIcon label="Messages" disabled>
          <svg className={ICON} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 5h16a1 1 0 011 1v9a1 1 0 01-1 1H9l-5 4V6a1 1 0 011-1z" />
          </svg>
        </HeaderIcon>

        {/* Viho's btn-primary-light: tinted brand fill, brand text, no border. */}
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

        {/* The account menu stays. The theme has no equivalent, but Profile needs
            somewhere to live now that the sidebar footer is gone. */}
        <div className="relative ml-1" ref={dropdownRef}>
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
      </div>
    </header>
  );
}
