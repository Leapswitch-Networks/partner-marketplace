"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import GlobalSearch from "@/components/dashboard/GlobalSearch";
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
 * with them: the bare search, language, bookmarks, notifications and messages.
 *
 * **Search came back on 2026-08-17, and the gap is worth recording.** This
 * docstring said "Global Search is an unbuilt parity module" and closed with
 * "add each of the others back here, live, when its feature lands". The feature
 * landed — `GET /api/v1/search`, `search_service`, a configurable entity list at
 * `/dashboard/search`, and a finished `GlobalSearch` component — and the
 * re-adding step was never done, so the component sat in the tree importing
 * nothing and imported by nothing for six days. Nothing was broken; a hand-off
 * was simply left half-finished, which is the failure mode a note like the one
 * above does not prevent on its own.
 *
 * So what is here is real: **search**, **fullscreen**, **dark mode**, **log out**,
 * and the account menu. Language, bookmarks, notifications and messages are still
 * out, and stay out until each has something behind it —
 * `VIHO_THEME_REFERENCE.md` § Dashboard Shell records the full row.
 *
 * **No permission gates the search box**, deliberately. `GET /api/v1/search` is
 * authentication-only and `search_service` scopes every hit to what the caller may
 * already see, so gating the input would hide the feature from people whose
 * results would simply have been narrower. The one search permission that exists,
 * `search-entity-manage`, governs *which records are searchable* — the admin page,
 * not the box.
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
      className="flex h-10 w-10 items-center justify-center rounded-full text-ink transition-colors hover:bg-brand/10 hover:text-brand focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 ring-offset-surface-wash dark:ring-offset-night-card dark:text-gray-200 dark:hover:bg-brand/20 dark:hover:text-brand-on-dark"
    >
      {children}
    </button>
  );
}

export default function TopNav({
  sidebarCollapsed,
  onToggleSidebar,
}: {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}) {
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
    <header className="hidden h-16 shrink-0 items-center justify-between gap-2 border-b border-brand/20 bg-surface-wash px-4 sm:px-3 md:flex lg:px-2 dark:border-night-border dark:bg-night-card">
      {/* Left corner: the sidebar toggle, moved out of the sidebar's own header
          on 2026-08-17. It reads the collapsed state but does not own it —
          `AppShell` does, because the thing being resized is this header's
          sibling. Only rendered at `md+`, same as this whole bar and the desktop
          sidebar; below that the sidebar is a drawer with its own hamburger. */}
      <HeaderIcon
        label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        onClick={onToggleSidebar}
      >
        <svg className={ICON} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          {sidebarCollapsed ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7M19 19l-7-7 7-7" />
          )}
        </svg>
      </HeaderIcon>

      {/* Middle: global search.
          `flex-1 justify-center` rather than absolute centring. The two side
          groups are `shrink-0` and unequal — one icon on the left, five controls
          and a Log out button on the right — so an
          `absolute left-1/2 -translate-x-1/2` box would be truly centred and
          would overlap the right-hand group at the narrower `md` widths this bar
          starts at. Centred within the space that is actually free never
          collides, and `GlobalSearch` caps itself at `max-w-md` so it does not
          stretch into the action row on a 2560px display.

          The popover positions itself from `getBoundingClientRect`, so it follows
          this box wherever the flex layout puts it — nothing here needs to know
          about it. */}
      <div className="flex min-w-0 flex-1 justify-center px-2">
        <GlobalSearch />
      </div>

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
          /*
            The account disc, in the action colour — 2026-08-20. Lilac fill, ink
            initials at 11.01:1, and an ink border because a lilac fill measures
            **1.23:1 against the chrome** and would otherwise have no edge at all
            (`BACKOFFICE_DESIGN.md` § 4.2). The public surface's own precedent for a
            lilac disc with an ink border is `VerificationBadge`'s middle tier.

            **The active state inverts the same two colours** rather than reaching
            for a third: on `/settings/*` it becomes an ink disc with lilac
            initials, which is the same 11.01:1 read the other way round. It
            replaces `bg-brand-dark`, which is no longer in the pair.

            No `dark:` colours: lilac and ink are absolute, so one declaration
            serves both themes. Lilac on `night-card` is 13.50:1.
          */
          className={`ml-4 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ink text-[10px] font-bold transition-transform hover:scale-[.98] motion-reduce:transform-none focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 ring-offset-surface-wash dark:ring-offset-night-card ${
            inSettings
              ? "bg-ink text-primary ring-2 ring-ink/25"
              : "bg-primary text-primary-foreground"
          }`}
        >
          {initials}
        </Link>

        {/* Log out, in the action colour — 2026-08-20. This was Viho's
            `btn-primary-light` (a brand-tinted fill inverting to solid brand on
            hover); it is now the same lilac-on-ink treatment as every other primary
            control, so the header's two controls read as one pair.

            Hover **shrinks** rather than recolouring, which is the reference's
            whole motion vocabulary and what `common/Button.tsx` now does too.

            ⚠️ Still hand-rolled rather than using `<Button variant="primary">`,
            and only because the geometry is bespoke — `px-4 py-2.5 text-xs`,
            `rounded-[8px]`, hard against the corner, which the owner placed
            deliberately. The colours are tokens, so it can no longer drift from the
            shared definition on colour; it can still drift on geometry.

            Last in the row, hard against the corner. The avatar disc sits to its
            left. */}
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="ml-4 inline-flex items-center gap-2 rounded-[8px] border border-ink bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground transition-transform hover:scale-[.98] active:scale-[.96] motion-reduce:transform-none focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 ring-offset-surface-wash dark:ring-offset-night-card disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
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
