"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The settings sub-navigation.
 *
 * Three tabs, matching LeapDesk's `layouts/settings/layout.tsx` exactly —
 * including the omission: **Two-Factor Auth is not here.** LeapDesk keeps that
 * route but has the nav entry commented out, and PM's 2FA controls already live on
 * the profile page next to the sessions list. Adding a fourth tab would move a
 * working control for the sake of symmetry.
 */
const TABS: { title: string; href: string; icon: React.ReactNode }[] = [
  {
    title: "Profile",
    href: "/settings/profile",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  {
    title: "Password",
    href: "/settings/password",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
  },
  {
    title: "Appearance",
    href: "/settings/appearance",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
      </svg>
    ),
  },
];

export default function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="space-y-1 p-2" aria-label="Settings">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-orange-50 text-[#F97316] dark:bg-orange-950/40 dark:text-orange-400"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
            }`}
          >
            <span className="shrink-0">{tab.icon}</span>
            {tab.title}
          </Link>
        );
      })}
    </nav>
  );
}
