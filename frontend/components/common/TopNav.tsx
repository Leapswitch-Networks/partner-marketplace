"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import useAppSelector from "@/lib/hooks/useAppSelector";
import useAppDispatch from "@/lib/hooks/useAppDispatch";
import { logoutUser } from "@/lib/store/authSlice";
import { useTheme } from "@/lib/hooks/useTheme";
import { getUserDisplayName } from "@/lib/utils/user";

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
  const [loggingOut, setLoggingOut] = useState(false);

  const displayName = getUserDisplayName(user);
  const initials =
    displayName
      .split(" ")
      .map((w: string) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "SA";

  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    await dispatch(logoutUser());
    router.push("/sign-in");
  }, [dispatch, router]);

  const toggleFullscreen = useCallback(() => {
    if (typeof document === "undefined") return;
    if (document.fullscreenElement) void document.exitFullscreen?.();
    else void document.documentElement.requestFullscreen?.();
  }, []);

  return (
    <header className="hidden h-16 shrink-0 items-center justify-end gap-2 border-b border-surface-border bg-white px-4 sm:px-6 md:flex lg:px-8 dark:border-night-border dark:bg-night-card">
      <div className="flex shrink-0 items-center gap-2">
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

        {/* Just the avatar badge. The name and role used to sit beside it and the
            email inside a dropdown — all of it removed on the owner's call: the
            badge already identifies you, and repeating the name in the chrome of
            every page earns nothing.

            With Log out promoted to its own button, the dropdown had exactly one
            item left, so it is gone too and the avatar links straight to profile
            settings. A menu that opens to reveal a single choice is ceremony.

            The name survives as the accessible name, so screen-reader and
            hover users still get it. */}
        <Link
          href="/settings/profile"
          aria-label={`${displayName || "Account"} — profile settings`}
          title={displayName || "Profile settings"}
          className={`ml-4 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white transition-colors focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 ${
            inSettings ? "bg-brand-dark ring-2 ring-brand/30" : "bg-brand hover:bg-brand-dark"
          }`}
        >
          {initials}
        </Link>

        {/* Viho's btn-primary-light: tinted brand fill, brand text, no border.
            Last in the row, hard against the corner — the theme puts it there and
            so does the owner. The avatar badge sits to its left. */}
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="ml-4 inline-flex items-center gap-2 rounded-[8px] bg-brand/10 px-4 py-2.5 text-xs font-semibold text-brand transition-colors hover:bg-brand hover:text-white focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-brand/20 dark:text-brand-on-dark dark:hover:bg-brand dark:hover:text-white"
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
