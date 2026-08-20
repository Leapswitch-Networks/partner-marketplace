"use client";

import { useTheme, type Appearance } from "@/lib/hooks/useTheme";

/**
 * Light / Dark / System, as a segmented control.
 *
 * Ports LeapDesk's `appearance-tabs.tsx`. `System` is the reason this exists as
 * three buttons rather than the nav bar's two-state toggle — it is not a third
 * colour but an instruction to keep following the OS, which a toggle cannot say.
 */
const TABS: { value: Appearance; label: string; icon: React.ReactNode }[] = [
  {
    value: "light",
    label: "Light",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 7a5 5 0 100 10A5 5 0 0012 7z" />
      </svg>
    ),
  },
  {
    value: "dark",
    label: "Dark",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
      </svg>
    ),
  },
  {
    value: "system",
    label: "System",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
];

export default function AppearanceTabs() {
  const { appearance, updateAppearance } = useTheme();

  return (
    <div>
      <div
        role="radiogroup"
        aria-label="Appearance"
        className="inline-flex gap-1 rounded-none bg-gray-100 p-1 dark:bg-night-card"
      >
        {TABS.map((tab) => {
          const active = appearance === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => updateAppearance(tab.value)}
              className={`flex items-center gap-1.5 rounded-[5px] px-3.5 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-white text-gray-900 dark:bg-gray-700 dark:text-gray-100"
                  : "text-ink-label dark:text-night-muted hover:bg-gray-200/60 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700/60 dark:hover:text-gray-100"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-ink-label dark:text-night-muted">
        {appearance === "system"
          ? "Following your operating system, and will keep following it if you change that setting."
          : `Always ${appearance}, regardless of your operating system setting.`}
      </p>
    </div>
  );
}
